import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ThemedText } from '@/components/themed-text';
import { ActionReview } from '@/components/ui/action-review';
import { Button } from '@/components/ui/button';
import { Choice, Choices } from '@/components/ui/choices';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { TextField } from '@/components/ui/text-field';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { useFlowMoney } from '@/features/cashflow/ui';
import { GoalLoading } from '@/features/goals/ui';
import { useGuideAction } from '@/features/guides/context';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useMyHousehold } from '@/features/household/api';
import type { Household } from '@/features/household/schema';
import { formatCalendarDate } from '@/features/payments/dates';
import { PaymentError } from '@/features/payments/ui';
import { SpaceContext } from '@/hooks/use-theme';
import { useRelationshipAction, useRelationshipWorkspace, type RelationshipMutation } from './api';
import { uncertainDecision } from './decision';
import { billPreview } from './bill-model';
import { billModes, billWorkspace, type BillAction, type BillMode, type BillWorkspace } from './schema';

export function BillSplitScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const validId = z.uuid().safeParse(id).success ? id : undefined;
  const household = useMyHousehold();
  const query = useRelationshipWorkspace(household.data?.household.id, validId, 'bill');
  const retry = () => { void household.refetch(); void query.refetch(); };
  if (!validId) return <GoalLoading unavailable retry={retry} />;
  if (!household.data || !query.data) return <GoalLoading error={household.isError || query.isError} retry={retry} />;
  return <SpaceContext value="shared"><ConnectedSplit key={`${household.data.household.id}:${household.data.me.userId}:${id}`}
    household={household.data.household} userId={household.data.me.userId} data={billWorkspace.parse(query.data)}
    error={household.isError || query.isError} refreshing={query.isFetching} onRefresh={retry} /></SpaceContext>;
}
type Props = { household: Household; userId: string; data: BillWorkspace; error?: boolean; refreshing?: boolean; onRefresh: () => unknown };
function ConnectedSplit(props: Props) {
  const save = useRelationshipAction(props.household.id, props.userId, props.data.expense.id);
  return <BillSplitPanel {...props} save={save} />;
}
export function BillSplitPanel({ household, data, error, refreshing, onRefresh, save }: Props & { save: RelationshipMutation }) {
  const { t } = useTranslation();
  const { money, edit, parse, locale } = useFlowMoney(household.baseCurrency, household.timezone);
  const signal = useGuideAction();
  const [mode, setMode] = useState<BillMode>(data.saved?.mode ?? data.default_mode);
  const [inputs, setInputs] = useState<Record<string, string>>(() => Object.fromEntries(data.saved?.weights.map(w => [w.userId,
    data.saved!.mode === 'fixed' ? edit(w.weight) : data.saved!.mode === 'percentage' ? budgetAmountText(w.weight, 'USD', locale) : String(w.weight)]) ?? []));
  const [review, setReview] = useState<{ action: BillAction; shares: { user_id: string; amount_minor: number }[] } | null>(null);
  const [notice, setNotice] = useState(false);
  const preview = billPreview(data, mode, inputs, mode === 'percentage' ? value => parseBudgetAmount(value, 'USD', locale) : parse);
  const uncertain = uncertainDecision(save.error);
  const busy = save.isPending || !!error || data.locked || uncertain;
  const incomeReady = data.members.length === 2 && data.members.every(m => m.setup_step >= 1) && data.members.some(m => m.income_minor > 0);
  const name = (id: string) => data.members.find(m => m.user_id === id)?.display_name ?? t('common.unknown');
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('relationships.billSplit')}</ThemedText>
    <ThemedText>{data.expense.description || t('expenses.untitled')}</ThemedText>
    <SummaryRow label={t('relationships.loggedAmount')} value={money(data.expense.amount_minor)} />
    <SummaryRow label={t('relationships.paidBy')} value={name(data.expense.paid_by)} />
    <ThemedText type="small" themeColor="textSecondary">{formatCalendarDate(data.expense.occurred_on, locale)}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('relationships.splitHint')}</ThemedText>
    {!!error && <ThemedText themeColor="attention" accessibilityRole="alert">{t('goals.loadError')}</ThemedText>}
    {data.locked && <ThemedText themeColor="attention">{t('goals.periodLocked')}</ThemedText>}
    {data.stale && <ThemedText themeColor="attention" accessibilityRole="alert">{t('relationships.splitStale')}</ThemedText>}
    <ThemedText type="section" accessibilityRole="header">{t(data.saved ? 'relationships.savedShares' : 'relationships.suggestedShares')}</ThemedText>
    {!data.saved && !data.default_ready && <ThemedText>{t('relationships.incomePending')}</ThemedText>}
    {(data.saved?.shares ?? data.default_shares).map(s => <SummaryRow key={s.user_id} label={name(s.user_id)} value={money(s.amount_minor)} />)}
    <GuideSlot target="bill-split-form" offer="bill-split" />
    <Choices label={t('relationships.splitMethod')}>
      {billModes.map(value => <Choice key={value} label={t(`relationships.modes.${value}`)} selected={mode === value} disabled={busy}
        onPress={() => { setMode(value); setInputs({}); setReview(null); setNotice(false); }} />)}
    </Choices>
    {mode === 'income' && !incomeReady && <ThemedText themeColor="textSecondary">{t('relationships.incomePending')}</ThemedText>}
    {data.members.length !== 2 && <ThemedText>{t('relationships.partnerPending')}</ThemedText>}
    {(['percentage', 'fixed', 'custom'] as BillMode[]).includes(mode) && <>
      <ThemedText type="small" themeColor="textSecondary">{t(mode === 'percentage' ? 'relationships.percentageHint' : mode === 'fixed' ? 'relationships.fixedHint' : 'relationships.customHint')}</ThemedText>
      {data.members.map(m => <TextField key={m.user_id} label={m.display_name} value={inputs[m.user_id] ?? ''}
        onChangeText={value => { setInputs(current => ({ ...current, [m.user_id]: value })); setNotice(false); }} keyboardType={mode === 'custom' ? 'number-pad' : 'decimal-pad'} editable={!busy} />)}
    </>}
    {preview && <>
      <ThemedText type="section" accessibilityRole="header">{t('relationships.proposedShares')}</ThemedText>
      {preview.shares.map(s => <SummaryRow key={s.user_id} label={name(s.user_id)} value={money(s.amount_minor)} />)}
    </>}
    <PaymentError error={save.error} />
    {uncertain && <ThemedText accessibilityRole="alert" themeColor="attention">{t('relationships.uncertain')}</ThemedText>}
    {notice && <ThemedText accessibilityLiveRegion="polite" themeColor="success">{t('relationships.saved')}</ThemedText>}
    <Button title={t('relationships.reviewSplit')} disabled={busy || !preview} onPress={() => {
      if (preview) setReview({ action: { token: data.token, mode, weights: preview.weights }, shares: preview.shares });
    }} />
    {review && <ActionReview title={t('goals.reviewTitle')}>
      <SummaryRow label={t('relationships.splitMethod')} value={t(`relationships.modes.${review.action.mode}`)} />
      {review.shares.map(s => <SummaryRow key={s.user_id} label={name(s.user_id)} value={money(s.amount_minor)} />)}
      <ThemedText>{t('relationships.splitHint')}</ThemedText>
      {review.action.token !== data.token && <ThemedText accessibilityRole="alert" themeColor="attention">{t('relationships.splitChanged')}</ThemedText>}
      <Button title={t('goals.confirmDecision')} loading={save.isPending} disabled={!!error || !uncertain && (data.locked || review.action.token !== data.token)}
        onPress={() => save.mutate(review.action, { onSuccess: () => { setNotice(true); setReview(null); signal('bill-split-saved'); } })} />
      <Button title={t('common.cancel')} variant="ghost" disabled={save.isPending || uncertain} onPress={() => setReview(null)} />
    </ActionReview>}
    <Button title={t('goals.refresh')} variant="secondary" loading={refreshing} disabled={save.isPending} onPress={onRefresh} />
    <Button title={t('categories.back')} variant="ghost" onPress={() => router.back()} />
  </Screen>;
}
