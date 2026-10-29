import { router } from 'expo-router';
import { useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Choice, Choices } from '@/components/ui/choices';
import { Disclosure } from '@/components/ui/disclosure';
import { RevealInScreen, Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { isCalendarDate, MAX_BUDGET_MINOR } from '@/features/budget/schema';
import { useFlowMoney } from '@/features/cashflow/ui';
import { useGuideAction } from '@/features/guides/context';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useMyHousehold } from '@/features/household/api';
import type { Member, Household } from '@/features/household/schema';
import { shiftCalendarDays, formatCalendarDate } from '@/features/payments/dates';
import { PaymentError } from '@/features/payments/ui';
import { SpaceContext } from '@/hooks/use-theme';
import { splitShared } from '@/lib/split';
import { useReconciliation, useReconciliationAction } from './api';
import type { ReconciliationAction, ReconciliationWorkspace } from './schema';

export function ReconciliationScreen() {
  const household = useMyHousehold();
  const query = useReconciliation(household.data?.household.id);
  const { t } = useTranslation();
  if (!household.data || !query.data) return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('reconciliation.title')}</ThemedText>
    <ThemedText accessibilityRole={household.isError || query.isError ? 'alert' : undefined}>
      {t(household.isError || query.isError ? 'reconciliation.loadError' : 'dashboard.loading')}
    </ThemedText>
    {(household.isError || query.isError) && <Button title={t('common.tryAgain')} onPress={() => { void household.refetch(); void query.refetch(); }} />}
    <Button title={t('payments.home')} variant="ghost" onPress={() => router.replace('/')} />
  </Screen>;
  return <SpaceContext value="shared"><ConnectedReconciliation
    key={`${household.data.household.id}:${household.data.me.userId}`}
    data={query.data} household={household.data.household} userId={household.data.me.userId}
    members={household.data.members} error={query.isError || household.isError}
    refreshing={query.isFetching} onRefresh={() => { void household.refetch(); void query.refetch(); }} />
  </SpaceContext>;
}

export type ReconciliationProps = {
  data: ReconciliationWorkspace; household: Household; userId: string; members: Member[];
  error?: boolean; refreshing?: boolean; onRefresh: () => void;
};

function ConnectedReconciliation(props: ReconciliationProps) {
  const save = useReconciliationAction(props.household.id, props.userId);
  return <Reconciliation {...props} save={save} />;
}

export function Reconciliation({ data, household, userId, members, error, refreshing, onRefresh, save }: ReconciliationProps & {
  save: ReturnType<typeof useReconciliationAction>;
}) {
  const { t } = useTranslation();
  const { money, locale } = useFlowMoney(household.baseCurrency, household.timezone);
  const signal = useGuideAction();
  const pending = data.pending;
  const [saved, setSaved] = useState(false);
  const [confirmation, setConfirmation] = useState<ReconciliationAction | null>(null);
  const date = (on: string) => formatCalendarDate(on, locale);
  const submit = (action: ReconciliationAction) => {
    setSaved(false);
    save.mutate({ ...action, revision: data.revision }, { onSuccess: () => {
      setConfirmation(null); setSaved(true);
      if (action.action === 'check') signal('balance-checked');
    } });
  };
  // A confirmation is valid only for the exact comparison it was opened from.
  const [confirmationRevision, setConfirmationRevision] = useState<number | null>(null);
  const confirm = (action: ReconciliationAction) => { setConfirmation(action); setConfirmationRevision(data.revision); };
  const busy = save.isPending || !!error;
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('reconciliation.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('reconciliation.intro')}</ThemedText>
    {!!error && <ThemedText themeColor="attention" accessibilityRole="alert">{t('reconciliation.loadError')}</ThemedText>}
    <PaymentError error={save.error} />
    {save.isPending && <ThemedText accessibilityLiveRegion="polite">{t('reconciliation.saving')}</ThemedText>}
    {!!saved && <ThemedText accessibilityLiveRegion="polite" themeColor="success">{t('reconciliation.saved')}</ThemedText>}
    <GuideSlot target="reconciliation-compare" offer="reconciliation" />
    {pending && <View style={styles.section}>
      <ThemedText type="section" accessibilityRole="header">{t('reconciliation.comparison', { date: date(pending.as_of_on) })}</ThemedText>
      <Card>
        <SummaryRow label={t('reconciliation.actual')} value={money(pending.actual_minor)} />
        <SummaryRow label={t('reconciliation.expected')} value={money(pending.current_expected_minor)} />
        <SummaryRow label={t('reconciliation.difference')} value={money(pending.gap_minor)} />
      </Card>
      <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.confirmedOnly')}</ThemedText>
      {pending.baseline_changed ? <ThemedText accessibilityRole="alert" themeColor="attention">{t('reconciliation.baselineChanged')}</ThemedText> : <>
        <ThemedText themeColor={pending.gap_minor ? 'attention' : 'success'}>
          {t(pending.gap_minor < 0 ? 'reconciliation.shortfall' : pending.gap_minor > 0 ? 'reconciliation.surplus' : 'reconciliation.matched', { amount: money(Math.abs(pending.gap_minor)) })}
        </ThemedText>
        {pending.gap_minor === 0 && <Button title={t('reconciliation.confirmMatch')} loading={save.isPending} disabled={busy}
          onPress={() => confirm({ action: 'match', values: { id: pending.id } })} />}
        {pending.gap_minor !== 0 && <>
          <Button title={t(pending.gap_minor < 0 ? 'reconciliation.logMissing' : 'reconciliation.reviewRecords')}
            disabled={save.isPending} onPress={() => router.push(pending.gap_minor < 0 ? '/quick-log' : '/cash-flow')} />
          <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.logHint', { date: date(pending.as_of_on) })}</ThemedText>
        </>}
        {pending.gap_minor > 0 && <Button title={t('reconciliation.keepCorrection')} variant="secondary" disabled={busy}
          onPress={() => confirm({ action: 'correction', values: { id: pending.id } })} />}
        {pending.gap_minor < 0 && <>
          {!pending.shares.length ? <>
            <Button title={t('reconciliation.moveMine')} variant="secondary" disabled={busy || -pending.gap_minor > MAX_BUDGET_MINOR}
              onPress={() => confirm({ action: 'allocate', values: { id: pending.id, shares: [{ userId, amountMinor: -pending.gap_minor }] } })} />
            {members.length === 2 && <SplitForm key={`${pending.id}:${pending.gap_minor}`} amount={-pending.gap_minor}
              household={{ ...household, splitMode: data.effective_split ?? household.splitMode }} members={members} userId={userId} disabled={busy}
              onPropose={shares => confirm({ action: 'allocate', values: { id: pending.id, shares } })} />}
            <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.allowanceHint')}</ThemedText>
          </> : <>
            <ThemedText type="section" accessibilityRole="header">{t('reconciliation.proposedShares')}</ThemedText>
            {pending.shares.map(share => <View key={share.user_id} style={styles.section}>
              <SummaryRow label={members.find(m => m.userId === share.user_id)?.displayName ?? t('reconciliation.partner')} value={money(share.amount_minor)} />
              <ThemedText type="small" themeColor="textSecondary">{t(share.approved_at ? 'reconciliation.approved' : 'reconciliation.awaitingApproval')}</ThemedText>
            </View>)}
            <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.consentHint')}</ThemedText>
            {pending.shares.some(s => s.user_id === userId && !s.approved_at) &&
              <Button title={t('reconciliation.approveMine')} disabled={busy || pending.shares.reduce((sum, s) => sum + s.amount_minor, 0) !== -pending.gap_minor}
                onPress={() => confirm({ action: 'approve', values: { id: pending.id } })} />}
            {pending.shares.reduce((sum, s) => sum + s.amount_minor, 0) !== -pending.gap_minor &&
              <ThemedText themeColor="attention">{t('reconciliation.proposalChanged')}</ThemedText>}
            <Button title={t('reconciliation.cancelShares')} variant="secondary" disabled={busy}
              onPress={() => confirm({ action: 'cancel-shares', values: { id: pending.id } })} />
          </>}
        </>}
      </>}
    </View>}
    {confirmation && <ConfirmationPanel key={JSON.stringify(confirmation)}>
      <ThemedText>{t(confirmation.action === 'allocate' || confirmation.action === 'approve' ? 'reconciliation.consentHint' : confirmation.action === 'correction' ? 'reconciliation.correctionHint' : 'reconciliation.matchHint')}</ThemedText>
      {confirmation.action === 'allocate' && confirmation.values.shares.map(s =>
        <SummaryRow key={s.userId} label={members.find(m => m.userId === s.userId)?.displayName ?? t('reconciliation.partner')} value={money(s.amountMinor)} />)}
      {confirmation.action === 'approve' && pending && <SummaryRow label={t('reconciliation.myShare')}
        value={money(pending.shares.find(s => s.user_id === userId)?.amount_minor ?? 0)} />}
      {data.revision !== confirmationRevision && <ThemedText themeColor="attention" accessibilityRole="alert">{t('reconciliation.changed')}</ThemedText>}
      <Button title={t('reconciliation.confirmAction')} loading={save.isPending} disabled={busy || data.revision !== confirmationRevision} onPress={() => submit(confirmation)} />
      <Button title={t('common.cancel')} variant="ghost" disabled={save.isPending} onPress={() => setConfirmation(null)} />
    </ConfirmationPanel>}
    <GuideSlot target="reconciliation-check" />
    {pending ? <Disclosure title={t('reconciliation.newCheck')}>
      <CheckForm data={data} household={household} disabled={busy} onCheck={submit} />
    </Disclosure> : <CheckForm data={data} household={household} disabled={busy} onCheck={submit} />}
    <Button title={t('reconciliation.refresh')} variant="secondary" disabled={save.isPending} loading={refreshing} onPress={onRefresh} />
    <Disclosure title={t('reconciliation.history')}>
      {!data.history.length && <ThemedText themeColor="textSecondary">{t('reconciliation.noHistory')}</ThemedText>}
      {data.history.map(row => <View key={row.id} style={styles.section}>
        <SummaryRow label={date(row.as_of_on)} value={money(row.actual_minor)} />
        <ThemedText type="small" themeColor="textSecondary">{t(row.status === 'superseded' ? 'reconciliation.superseded' : `reconciliation.resolution.${row.resolution ?? 'matched'}`)}</ThemedText>
        {row.resolved_expected_minor !== null && <SummaryRow label={t('reconciliation.recordedDifference')} value={money(row.actual_minor - row.resolved_expected_minor)} />}
      </View>)}
      <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.historyHint')}</ThemedText>
    </Disclosure>
    <Button title={t('payments.home')} variant="ghost" onPress={() => router.replace('/')} />
  </Screen>;
}

function ConfirmationPanel({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const reveal = useContext(RevealInScreen);
  const panel = useRef<ComponentRef<typeof View>>(null);
  const heading = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    let focusFrame = 0;
    const frame = requestAnimationFrame(() => {
      if (Platform.OS === 'web') {
        (panel.current as unknown as HTMLElement | null)?.scrollIntoView({ block: 'start', behavior: 'auto' });
        (heading.current as unknown as HTMLElement | null)?.focus({ preventScroll: true });
        return;
      }
      if (panel.current) reveal(panel.current);
      focusFrame = requestAnimationFrame(() => {
        if (!heading.current) return;
        AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus');
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); };
  }, [reveal]);
  return <View ref={panel} onLayout={() => { if (Platform.OS !== 'web' && panel.current) reveal(panel.current); }}>
    <Card>
      <View ref={heading} accessible accessibilityRole="header" accessibilityLabel={t('reconciliation.reviewAction')} tabIndex={-1}>
        <ThemedText type="section">{t('reconciliation.reviewAction')}</ThemedText>
      </View>
      {children}
    </Card>
  </View>;
}

function CheckForm({ data, household, disabled, onCheck }: Pick<ReconciliationProps, 'data' | 'household'> & {
  disabled: boolean; onCheck: (action: ReconciliationAction) => void;
}) {
  const { t } = useTranslation();
  const { parse } = useFlowMoney(household.baseCurrency, household.timezone);
  const [amount, setAmount] = useState('');
  const [negative, setNegative] = useState(false);
  const [on, setOn] = useState(data.today);
  const parsed = parse(amount);
  const valid = parsed !== null && isCalendarDate(on) && on >= shiftCalendarDays(data.today, -365) && on <= data.today && (!data.baseline || on >= data.baseline.as_of_on);
  return <View style={styles.section}>
    <ThemedText type="section" accessibilityRole="header">{t('reconciliation.newCheck')}</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">{t(data.baseline ? 'reconciliation.closingHint' : 'reconciliation.openingHint')}</ThemedText>
    {data.pending && <ThemedText type="small" themeColor="attention">{t('reconciliation.replaceHint')}</ThemedText>}
    <TextField label={t('reconciliation.amount', { currency: household.baseCurrency })} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
    <Choices label={t('cashflow.balanceSign')}>
      <Choice label={t('cashflow.positive')} selected={!negative} onPress={() => setNegative(false)} />
      <Choice label={t('cashflow.negative')} selected={negative} onPress={() => setNegative(true)} />
    </Choices>
    <TextField label={t('cashflow.asOf')} hint={t('cashflow.dateHint')} value={on} onChangeText={setOn} autoCapitalize="none" />
    {!!data.baseline && <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.earliestDate', { date: data.baseline.as_of_on })}</ThemedText>}
    <Button title={t('reconciliation.saveCheck')} disabled={disabled || !valid} onPress={() => onCheck({ action: 'check', values: { on, actualMinor: parsed! * (negative ? -1 : 1) } })} />
    <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.onlineHint')}</ThemedText>
  </View>;
}

function SplitForm({ amount, household, members, userId, disabled, onPropose }: {
  amount: number; household: Household; members: Member[]; userId: string; disabled: boolean;
  onPropose: (shares: { userId: string; amountMinor: number }[]) => void;
}) {
  const { t } = useTranslation();
  const { edit, parse, money } = useFlowMoney(household.baseCurrency, household.timezone);
  const [mine, setMine] = useState(() => {
    if (household.splitMode !== 'equal' && members.some(m => m.budgetSetupStep < 1)) return '';
    const shares = splitShared(amount, members.map(m => ({ id: m.userId, monthlyIncomeMinor: m.monthlyIncomeMinor })), household.splitMode);
    return edit(shares.find(s => s.id === userId)?.amountMinor ?? 0);
  });
  const value = parse(mine);
  const partner = members.find(m => m.userId !== userId)!;
  const valid = value !== null && value > 0 && value < amount && amount - value <= MAX_BUDGET_MINOR;
  return <Disclosure title={t('reconciliation.splitGap')}>
    <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.splitHint')}</ThemedText>
    <TextField label={t('reconciliation.myShare')} value={mine} onChangeText={setMine} keyboardType="decimal-pad" />
    {value !== null && value <= amount && <SummaryRow label={partner.displayName} value={money(amount - value)} />}
    <Button title={t('reconciliation.proposeSplit')} variant="secondary" disabled={disabled || !valid}
      onPress={() => onPropose([{ userId, amountMinor: value! }, { userId: partner.userId, amountMinor: amount - value! }])} />
  </Disclosure>;
}

const styles = StyleSheet.create({ section: { gap: Spacing.two } });
