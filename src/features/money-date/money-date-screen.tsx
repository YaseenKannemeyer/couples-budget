import type { TFunction } from 'i18next';
import { router } from 'expo-router';
import { useContext, useEffect, useRef, useState, type ComponentRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Platform, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ActionReview } from '@/components/ui/action-review';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Choice, Choices } from '@/components/ui/choices';
import { Disclosure } from '@/components/ui/disclosure';
import { ProgressBar } from '@/components/ui/progress-bar';
import { RevealInScreen, Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useFlowMoney } from '@/features/cashflow/ui';
import { useGuideAction } from '@/features/guides/context';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useMyHousehold } from '@/features/household/api';
import type { Household } from '@/features/household/schema';
import { formatCalendarDate, shiftCalendarDays } from '@/features/payments/dates';
import { PaymentError } from '@/features/payments/ui';
import { SpaceContext } from '@/hooks/use-theme';
import { SPLIT_MODES } from '@/lib/split';
import { useMoneyDate, useMoneyDateAction } from './api';
import { MoneyDateCelebration } from './celebration';
import { moneyDateModel, optionsAction } from './model';
import type { DateOptions, MoneyDateAction, MoneyDateWorkspace } from './schema';

export function MoneyDateScreen() {
  const household = useMyHousehold();
  const [month, setMonth] = useState<string>();
  const query = useMoneyDate(household.data?.household.id, month);
  // Pin the server-selected month before closing. Otherwise a default query
  // would advance to the next open month and discard the success view.
  if (!month && query.data) setMonth(query.data.period.starts_on);
  const { t } = useTranslation();
  const refresh = () => { void household.refetch(); void query.refetch(); };
  if (!household.data || !query.data) return <Screen>
    <ThemedText type="subtitle">{t('moneyDate.title')}</ThemedText>
    <ThemedText>{t(household.isError || query.isError ? 'moneyDate.loadError' : 'payments.loading')}</ThemedText>
    {(household.isError || query.isError) && <Button title={t('common.tryAgain')} onPress={refresh} />}
    <Button title={t('payments.home')} variant="ghost" onPress={() => router.replace('/')} />
  </Screen>;
  return <SpaceContext value="shared"><ConnectedMoneyDate key={`${household.data.household.id}:${household.data.me.userId}:${query.data.period.id}`}
    data={query.data} household={household.data.household} userId={household.data.me.userId}
    onMonth={setMonth} error={household.isError || query.isError} refreshing={query.isFetching} onRefresh={refresh} /></SpaceContext>;
}
export type MoneyDateMutation = ReturnType<typeof useMoneyDateAction>;
export type MoneyDateProps = { data: MoneyDateWorkspace; household: Household; userId: string; onMonth: (month: string) => void;
  error?: boolean; refreshing?: boolean; onRefresh: () => unknown };
function ConnectedMoneyDate(props: MoneyDateProps) {
  const save = useMoneyDateAction(props.household.id, props.userId);
  return <MoneyDate {...props} save={save} />;
}
const steps = ['wins', 'cleanup', 'lookahead', 'adjust', 'agree'] as const;
export function MoneyDate({ data, household, userId, save, onMonth, error, refreshing, onRefresh, initialStep = 0 }: MoneyDateProps & {
  save: MoneyDateMutation; initialStep?: number;
}) {
  const { t } = useTranslation();
  const { money, locale } = useFlowMoney(household.baseCurrency, household.timezone);
  const signal = useGuideAction();
  const [step, setStep] = useState(initialStep);
  const [revealStep, setRevealStep] = useState(false);
  const [confirmation, setConfirmation] = useState<{ token: string; action: MoneyDateAction } | null>(null);
  const [success, setSuccess] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const model = moneyDateModel(data, userId);
  const facts = data.facts;
  const busy = save.isPending || !!error || !!refreshing;
  const date = (on: string) => formatCalendarDate(on, locale);
  const month = (on: string) => new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${on}T12:00:00Z`));
  const name = (id: string) => facts.members.find(m => m.user_id === id)?.display_name ?? t('reconciliation.partner');
  const confirm = (action: MoneyDateAction) => { if (data.token) { setSuccess(false); setConfirmation({ token: data.token, action }); } };
  const submit = () => {
    if (!confirmation || confirmation.token !== data.token) return;
    const action = confirmation.action;
    save.mutate({ ...action, token: confirmation.token, month: data.period.starts_on }, { onSuccess: result => {
      setConfirmation(null); setSuccess(true);
      if (result.locked) { setCelebrate(true); signal('month-closed'); }
    } });
  };
  const next = (value: number) => { setStep(value); setRevealStep(true); setConfirmation(null); setSuccess(false); };
  const comparison = <>
    <SummaryRow label={t('reconciliation.actual')} value={facts.draft.actual_minor === null ? t('moneyDate.notChecked') : money(facts.draft.actual_minor)} />
    <SummaryRow label={t('reconciliation.expected')} value={facts.expected_minor === null ? t('moneyDate.noAnchorShort') : money(facts.expected_minor)} />
    {facts.expected_minor === null && <ThemedText type="small" themeColor="attention">{t('moneyDate.noAnchor')}</ThemedText>}
    {facts.gap_minor !== null && <SummaryRow label={t('reconciliation.difference')} value={money(facts.gap_minor)} />}
  </>;
  const review = <>
    {comparison}
    {facts.draft.gap_shares.map(s => <SummaryRow key={s.user_id} label={t('moneyDate.allowanceCharge', { name: name(s.user_id) })} value={money(s.amount_minor)} />)}
    {facts.gap_minor !== null && facts.gap_minor > 0 && facts.draft.surplus_correction && <ThemedText type="small">{t('moneyDate.surplusReviewed')}</ThemedText>}
    <SummaryRow label={t('moneyDate.nextSplit', { month: month(data.period.ends_on) })} value={t(`split.${facts.next_split}.label`)} />
    {facts.draft.drawdowns.map(d => <SummaryRow key={d.goal_id} label={t('moneyDate.releaseFrom', { name: facts.goals.find(g => g.id === d.goal_id)?.name })} value={money(d.amount_minor)} />)}
    {facts.next_allowances.map(a => <SummaryRow key={a.user_id} label={t('moneyDate.nextAllowance', { name: name(a.user_id) })} value={money(a.amount_minor)} />)}
  </>;
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('moneyDate.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{month(data.period.starts_on)}</ThemedText>
    <ThemedText>{t('moneyDate.intro')}</ThemedText>
    <Disclosure title={t('moneyDate.changeMonth')}>
      {data.periods.map(p => <Button key={p.month_on} title={`${month(p.month_on)} · ${t(p.status === 'locked' ? 'moneyDate.closed' : 'moneyDate.open')}`}
        variant="secondary" disabled={busy || p.month_on === data.period.starts_on} onPress={() => onMonth(p.month_on)} />)}
    </Disclosure>
    {!!error && <ThemedText accessibilityRole="alert" themeColor="attention">{t('moneyDate.loadError')}</ThemedText>}
    <PaymentError error={save.error} />
    {success && !celebrate && <ThemedText accessibilityLiveRegion="polite" themeColor="success">{t('moneyDate.saved')}</ThemedText>}
    {celebrate && <MoneyDateCelebration />}
    {model.locked && <ThemedText themeColor="success">{t('moneyDate.closedHint')}</ThemedText>}
    {!model.completed && <ThemedText themeColor="textSecondary">{t('moneyDate.preview', { date: date(data.period.ends_on) })}</ThemedText>}
    {!facts.plan && <ThemedText accessibilityRole="alert" themeColor="attention">{t('moneyDate.noPlan')}</ThemedText>}
    <GuideSlot target="money-date-review" offer="money-date" />
    <ProgressBar value={(step + 1) * 20} label={t('moneyDate.progress')} summary={t('moneyDate.step', { number: step + 1, total: 5 })} />
    <StepHeading key={step} reveal={revealStep} title={t('moneyDate.stepTitle', { number: step + 1, title: t(`moneyDate.${steps[step]}`) })} />
    {step === 0 && <>
      <ThemedText themeColor="textSecondary">{t(model.completed ? 'moneyDate.winsHint' : 'moneyDate.winsSoFar')}</ThemedText>
      {model.wins.length === 0 && <ThemedText>{t('moneyDate.noWins')}</ThemedText>}
      {model.wins.map(c => <View key={c.category_id} style={styles.section}>
        <ThemedText type="smallBold">{c.name}</ThemedText>
        <SummaryRow label={t('moneyDate.underPlan')} value={money(c.planned_minor - c.spent_minor)} />
        <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.categoryTotals', { spent: money(c.spent_minor), planned: money(c.planned_minor) })}</ThemedText>
      </View>)}
      <ThemedText type="section">{t('moneyDate.goalProgress')}</ThemedText>
      {!facts.goals.length && <ThemedText>{t('moneyDate.noGoals')}</ThemedText>}
      {facts.goals.map(g => <View key={g.id} style={styles.section}>
        <SummaryRow label={g.name} value={money(g.saved_minor)} />
        <ProgressBar value={g.saved_minor / g.target_minor * 100} label={g.name} summary={t('goals.progressSummary', { saved: money(g.saved_minor), target: money(g.target_minor) })} />
      </View>)}
      {!model.locked && <Button title={t('goals.title')} variant="ghost" onPress={() => router.push('/goals')} />}
    </>}
    {step === 1 && <>
      {!!facts.bill_splits?.length && <Disclosure title={t('relationships.billPlans')}>
        {facts.bill_splits.map(s => <View key={s.transaction_id} style={styles.section}>
          <ThemedText type="smallBold">{s.description || t('expenses.untitled')}</ThemedText>
          <ThemedText type="small">{t(`relationships.modes.${s.mode}`)}</ThemedText>
          {s.shares.map(share => <SummaryRow key={share.user_id} label={facts.members.find(m => m.user_id === share.user_id)?.display_name ?? t('common.unknown')} value={money(share.amount_minor)} />)}
          {s.stale && <ThemedText themeColor="attention">{t('relationships.stalePlan')}</ThemedText>}
          {!model.locked && <Button title={t('relationships.billSplit')} variant="secondary" onPress={() => router.push({ pathname: '/bill-split', params: { id: s.transaction_id } })} />}
        </View>)}
      </Disclosure>}
      <ThemedText themeColor="textSecondary">{t('moneyDate.closingDate', { date: date(shiftCalendarDays(data.period.ends_on, -1)) })}</ThemedText>
      <Card>{comparison}</Card>
      {facts.baseline_changed && <ThemedText accessibilityRole="alert" themeColor="attention">{t('moneyDate.baselineChanged')}</ThemedText>}
      <ThemedText type="small" themeColor="textSecondary">{t('reconciliation.confirmedOnly')}</ThemedText>
      {!model.locked && model.completed && <BalanceForm key={`${data.period.id}:${facts.draft.version}`} household={household} disabled={busy}
        initial={facts.draft.actual_minor} onSave={actualMinor => confirm({ action: 'check', values: { actualMinor } })} />}
      {!model.locked && <>
        <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.checkHint')}</ThemedText>
        <Button title={t('reconciliation.logMissing')} variant="secondary" disabled={save.isPending} onPress={() => router.push('/quick-log')} />
        <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.syncHint')}</ThemedText>
        {facts.gap_minor !== null && facts.gap_minor < 0 && <GapForm key={`${facts.draft.version}:${facts.gap_minor}`} household={household} data={data} userId={userId} disabled={busy}
          onSave={gap_shares => confirm(optionsAction({ ...facts.draft, gap_shares }))} />}
        {facts.gap_minor !== null && facts.gap_minor > 0 && <Button title={t(facts.draft.surplus_correction ? 'moneyDate.removeCorrection' : 'reconciliation.keepCorrection')} variant="secondary" disabled={busy}
          onPress={() => confirm(optionsAction({ ...facts.draft, surplus_correction: !facts.draft.surplus_correction }))} />}
      </>}
    </>}
    {step === 2 && <>
      <ThemedText themeColor="textSecondary">{t('moneyDate.lookaheadHint', { from: date(facts.today), to: date(model.forecast.horizon) })}</ThemedText>
      <SummaryRow label={t('moneyDate.projected')} value={model.forecast.projected === null ? t('moneyDate.unknown') : money(model.forecast.projected)} />
      <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.forecastHint')}</ThemedText>
      {model.forecast.gaps.length > 0 && <ThemedText themeColor="attention">{t('moneyDate.forecastGaps')}</ThemedText>}
      {model.bills.length === 0 && <ThemedText>{t('moneyDate.noBills')}</ThemedText>}
      {model.bills.map(b => <View key={b.key} style={styles.section}>
        <SummaryRow label={b.name} value={b.amount === null ? t('moneyDate.unknown') : money(b.amount)} />
        <ThemedText type="small" themeColor="textSecondary">{t(b.on < facts.today ? 'moneyDate.overdueBill' : b.end && b.end !== b.on ? 'moneyDate.billWindow' : 'moneyDate.billDate', { date: date(b.on), end: b.end ? date(b.end) : '' })}</ThemedText>
      </View>)}
      {!model.locked && <Button title={t('cashflow.title')} variant="secondary" onPress={() => router.push('/cash-flow')} />}
    </>}
    {step === 3 && <>
      <ThemedText themeColor="textSecondary">{t('moneyDate.adjustHint', { month: month(data.period.ends_on) })}</ThemedText>
      {model.locked ? review : <OptionsForm key={`${data.period.id}:${facts.draft.version}`} household={household} data={data} disabled={busy}
        onSave={value => confirm(optionsAction(value))} />}
    </>}
    {step === 4 && <>
      <GuideSlot target="money-date-close" />
      <Card>{review}</Card>
      <ThemedText themeColor="textSecondary">{t('moneyDate.closeHint')}</ThemedText>
      {data.approvals.map(a => <SummaryRow key={a.user_id} label={name(a.user_id)} value={t(a.approved ? 'reconciliation.approved' : 'reconciliation.awaitingApproval')} />)}
      {!model.locked && <>
        {!data.ready && <ThemedText themeColor="attention">{t('moneyDate.notReady')}</ThemedText>}
        <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.consentHint')}</ThemedText>
        <Button title={t(model.ownApproved ? 'moneyDate.withdraw' : 'moneyDate.approve')} disabled={busy || (!model.ownApproved && !data.ready)}
          variant={model.ownApproved ? 'secondary' : 'primary'} onPress={() => confirm(model.ownApproved ? { action: 'withdraw', values: {} } : { action: 'approve', values: { synced: true } })} />
        <Button title={t('moneyDate.lock')} disabled={busy || !data.ready || !model.bothApproved} onPress={() => confirm({ action: 'lock', values: {} })} />
      </>}
      {data.period.snapshot && <Disclosure title={t('moneyDate.closedAllowances')}>
        <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.aggregatePrivacy')}</ThemedText>
        {data.period.snapshot.allowances.map(a => <View key={a.user_id} style={styles.section}>
          <ThemedText type="smallBold">{name(a.user_id)}</ThemedText>
          <SummaryRow label={t('moneyDate.allowance')} value={a.allowance_minor === null ? t('moneyDate.unknown') : money(a.allowance_minor)} />
          <SummaryRow label={t('moneyDate.spent')} value={money(a.spent_minor)} />
          <SummaryRow label={t('moneyDate.remaining')} value={a.allowance_minor === null ? t('moneyDate.unknown') : money(a.allowance_minor - a.spent_minor)} />
        </View>)}
      </Disclosure>}
    </>}
    {confirmation && <ActionReview title={t('moneyDate.reviewAction')}>
      {confirmation.token !== data.token && <ThemedText accessibilityRole="alert" themeColor="attention">{t('moneyDate.changed')}</ThemedText>}
      <ThemedText>{confirmationText(confirmation.action, money, t)}</ThemedText>
      {confirmation.action.action === 'check' && <ThemedText type="small">{t('moneyDate.checkHint')}</ThemedText>}
      {(confirmation.action.action === 'approve' || confirmation.action.action === 'lock') && <>{review}<ThemedText>{t('moneyDate.syncConsent')}</ThemedText><ThemedText>{t('moneyDate.lockWarning')}</ThemedText></>}
      {confirmation.action.action === 'options' && <>
        {confirmation.action.values.shares.map(s => <SummaryRow key={s.user_id} label={t('moneyDate.allowanceCharge', { name: name(s.user_id) })} value={money(s.amount_minor)} />)}
        <SummaryRow label={t('moneyDate.splitChoice')} value={t(`split.${confirmation.action.values.nextSplit ?? facts.default_split}.label`)} />
        {confirmation.action.values.drawdowns.map(d => <SummaryRow key={d.goal_id} label={facts.goals.find(g => g.id === d.goal_id)?.name ?? t('moneyDate.goalProgress')} value={money(d.amount_minor)} />)}
      </>}
      <Button title={t('moneyDate.confirmAction')} loading={save.isPending} disabled={busy || confirmation.token !== data.token} onPress={submit} />
      <Button title={t('common.cancel')} variant="ghost" disabled={save.isPending} onPress={() => setConfirmation(null)} />
    </ActionReview>}
    <View style={styles.section}>
      {step < 4 && <Button title={t('moneyDate.next', { title: t(`moneyDate.${steps[step + 1]}`) })} disabled={save.isPending} onPress={() => next(step + 1)} />}
      {step > 0 && <Button title={t('budget.back')} variant="ghost" disabled={save.isPending} onPress={() => next(step - 1)} />}
    </View>
    <Button title={t('moneyDate.refresh')} variant="secondary" loading={refreshing} disabled={save.isPending} onPress={onRefresh} />
    <Button title={t('payments.home')} variant="ghost" onPress={() => router.replace('/')} />
  </Screen>;
}
function StepHeading({ title, reveal }: { title: string; reveal: boolean }) {
  const inScreen = useContext(RevealInScreen);const heading = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    if (!reveal) return;
    let focus = 0;
    const frame = requestAnimationFrame(() => {
      if (Platform.OS === 'web') {
        const element = heading.current as unknown as HTMLElement | null;
        element?.scrollIntoView({ block: 'start', behavior: 'auto' });element?.focus({ preventScroll: true });
      } else if (heading.current) {
        inScreen(heading.current);
        focus = requestAnimationFrame(() => { if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus'); });
      }
    });
    return () => { cancelAnimationFrame(frame);cancelAnimationFrame(focus); };
  }, [inScreen, reveal]);
  return <View ref={heading} accessible accessibilityRole="header" accessibilityLabel={title} tabIndex={-1}>
    <ThemedText type="section">{title}</ThemedText>
  </View>;
}
function confirmationText(action: MoneyDateAction, money: (n: number) => string, t: TFunction) {
  if (action.action === 'check') return t('moneyDate.confirmCheck', { amount: money(action.values.actualMinor) });
  if (action.action === 'options') return t('moneyDate.confirmOptions');
  if (action.action === 'withdraw') return t('moneyDate.confirmWithdraw');
  if (action.action === 'lock') return t('moneyDate.confirmLock');
  return t('moneyDate.confirmApprove');
}
function BalanceForm({ household, initial, disabled, onSave }: { household: Household; initial: number | null; disabled: boolean; onSave: (n: number) => void }) {
  const { t } = useTranslation();const { edit, parse } = useFlowMoney(household.baseCurrency, household.timezone);
  const [text, setText] = useState(initial === null ? '' : `${initial < 0 ? '-' : ''}${edit(Math.abs(initial))}`);
  const negative = text.trim().startsWith('-');const parsed = parse(negative ? text.trim().slice(1) : text);
  return <View style={styles.section}>
    <TextField label={t('reconciliation.actual')} value={text} onChangeText={setText} keyboardType="numbers-and-punctuation" editable={!disabled} />
    <Button title={t('moneyDate.saveBalance')} disabled={disabled || parsed === null} onPress={() => { if (parsed !== null) onSave(negative ? -parsed : parsed); }} />
  </View>;
}
function GapForm({ household, data, userId, disabled, onSave }: { household: Household; data: MoneyDateWorkspace; userId: string; disabled: boolean; onSave: (shares: DateOptions['gap_shares']) => void }) {
  const { t } = useTranslation();const { edit, parse, money } = useFlowMoney(household.baseCurrency, household.timezone);
  const gap = -(data.facts.gap_minor ?? 0);const partner = data.facts.members.find(m => m.user_id !== userId);
  const [text, setText] = useState(edit(data.facts.draft.gap_shares.find(s => s.user_id === userId)?.amount_minor ?? gap));
  const own = parse(text);const other = own === null ? null : gap - own;
  return <View style={styles.section}>
    <ThemedText type="section">{t('moneyDate.gapTitle')}</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.gapHint')}</ThemedText>
    <TextField label={t('moneyDate.ownShare')} value={text} onChangeText={setText} keyboardType="decimal-pad" editable={!disabled} />
    {!!partner && <SummaryRow label={t('moneyDate.allowanceCharge', { name: partner.display_name })} value={other === null || other < 0 ? t('moneyDate.unknown') : money(other)} />}
    <Button title={t('moneyDate.saveShares')} disabled={disabled || own === null || own < 0 || own > gap || (!partner && own !== gap) || (other ?? 0) > 1e12}
      onPress={() => { if (own !== null && other !== null) onSave([...(own > 0 ? [{ user_id: userId, amount_minor: own }] : []), ...(partner && other > 0 ? [{ user_id: partner.user_id, amount_minor: other }] : [])]); }} />
  </View>;
}
function OptionsForm({ household, data, disabled, onSave }: { household: Household; data: MoneyDateWorkspace; disabled: boolean; onSave: (options: DateOptions) => void }) {
  const { t } = useTranslation();const { edit, parse, money } = useFlowMoney(household.baseCurrency, household.timezone);
  const draft = data.facts.draft;
  const [mode, setMode] = useState(draft.next_split);
  const [amounts, setAmounts] = useState<Record<string, string>>(Object.fromEntries(draft.drawdowns.map(d => [d.goal_id, edit(d.amount_minor)])));
  const goals = data.facts.goals.filter(g => g.saved_minor > 0);
  const values = goals.map(g => ({ goal_id: g.id, amount_minor: amounts[g.id]?.trim() ? parse(amounts[g.id]) : 0, saved: g.saved_minor }));
  const valid = values.every(v => v.amount_minor !== null && v.amount_minor >= 0 && v.amount_minor <= v.saved) && values.filter(v => (v.amount_minor ?? 0) > 0).length <= 20;
  return <View style={styles.section}>
    <Choices label={t('moneyDate.splitChoice')}>
      <Choice label={t('moneyDate.keepSplit')} selected={mode === null} disabled={disabled} onPress={() => setMode(null)} />
      {SPLIT_MODES.map(m => <Choice key={m.mode} label={t(m.labelKey)} selected={mode === m.mode} disabled={disabled} onPress={() => setMode(m.mode)} />)}
    </Choices>
    <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.splitHint')}</ThemedText>
    <ThemedText type="section">{t('moneyDate.releaseTitle')}</ThemedText>
    <ThemedText type="small" themeColor="textSecondary">{t('moneyDate.releaseHint')}</ThemedText>
    {!goals.length && <ThemedText>{t('moneyDate.noSavedGoals')}</ThemedText>}
    {goals.map(g => <View key={g.id} style={styles.section}>
      <SummaryRow label={g.name} value={money(g.saved_minor)} />
      <TextField label={t('moneyDate.releaseAmount', { name: g.name })} value={amounts[g.id] ?? ''} placeholder={edit(0)} keyboardType="decimal-pad" editable={!disabled}
        onChangeText={value => setAmounts(current => ({ ...current, [g.id]: value }))} />
    </View>)}
    {!valid && <ThemedText themeColor="attention">{t('moneyDate.releaseInvalid')}</ThemedText>}
    <Button title={t('moneyDate.saveOptions')} disabled={disabled || !valid} onPress={() => onSave({ ...draft, next_split: mode,
      drawdowns: values.flatMap(v => v.amount_minor !== null && v.amount_minor > 0 ? [{ goal_id: v.goal_id, amount_minor: v.amount_minor }] : []) })} />
  </View>;
}
const styles = StyleSheet.create({ section: { gap: Spacing.two, paddingVertical: Spacing.two } });
