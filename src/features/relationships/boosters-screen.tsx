import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Switch } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ActionReview } from '@/components/ui/action-review';
import { Button } from '@/components/ui/button';
import { CategoryPicker } from '@/components/ui/category-picker';
import { Disclosure } from '@/components/ui/disclosure';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { TextField } from '@/components/ui/text-field';
import { isCalendarDate } from '@/features/budget/schema';
import { useFlowMoney } from '@/features/cashflow/ui';
import { categoryLabel } from '@/features/categories/schema';
import type { GoalWorkspace } from '@/features/goals/schema';
import { GoalLoading, useGoalData } from '@/features/goals/ui';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useGuideAction } from '@/features/guides/context';
import type { Household } from '@/features/household/schema';
import { formatCalendarDate, shiftCalendarDays } from '@/features/payments/dates';
import { PaymentError } from '@/features/payments/ui';
import { SpaceContext } from '@/hooks/use-theme';
import { useRelationshipAction, useRelationshipWorkspace, type RelationshipMutation } from './api';
import { uncertainDecision } from './decision';
import { boosterWorkspace, type BoosterAction, type BoosterWorkspace } from './schema';

export function BoostersScreen() {
  const { household, query, error, refresh } = useGoalData();
  const boosters = useRelationshipWorkspace(household.data?.household.id);
  const retry = () => { void refresh(); void boosters.refetch(); };
  if (!household.data || !query.data || !boosters.data) return <GoalLoading error={error || boosters.isError} retry={retry} />;
  return <SpaceContext value="shared"><ConnectedBoosters key={`${household.data.household.id}:${household.data.me.userId}`}
    household={household.data.household} userId={household.data.me.userId} goals={query.data} data={boosterWorkspace.parse(boosters.data)}
    error={error || boosters.isError} refreshing={boosters.isFetching || query.isFetching} onRefresh={retry} /></SpaceContext>;
}
type Props = { household: Household; userId: string; goals: GoalWorkspace; data: BoosterWorkspace; error?: boolean; refreshing?: boolean; onRefresh: () => unknown };
function ConnectedBoosters(props: Props) {
  const save = useRelationshipAction(props.household.id, props.userId);
  return <BoostersPanel {...props} save={save} />;
}
export function BoostersPanel({ household, goals, data, error, refreshing, onRefresh, save }: Props & { save: RelationshipMutation }) {
  const { t } = useTranslation();
  const { money, parse, locale } = useFlowMoney(household.baseCurrency, household.timezone);
  const signal = useGuideAction();
  const [selected, setSelected] = useState('');
  const [goalId, setGoalId] = useState('');
  const [amount, setAmount] = useState('');
  const [synced, setSynced] = useState(false);
  const [category, setCategory] = useState('');
  const [week, setWeek] = useState(data.next_week_on);
  const [budgetAmount, setBudgetAmount] = useState('');
  const [review, setReview] = useState<{ action: BoosterAction; goalRevision: number; details: { label: string; value: string }[] } | null>(null);
  const [notice, setNotice] = useState(false);
  const key = (c: BoosterWorkspace['candidates'][number]) => `${c.category_id}:${c.week_on}`;
  const candidates = data.candidates.filter(c => c.available_minor > 0 && !c.locked);
  const candidate = candidates.find(c => key(c) === selected);
  const goal = goals.goals.find(g => g.id === goalId && !g.archived && g.saved_minor < g.target_minor);
  const parsed = parse(amount), budget = parse(budgetAmount);
  const valid = !!candidate && !!goal && synced && parsed !== null && parsed > 0 && parsed <= Math.min(candidate.available_minor, goal.target_minor - goal.saved_minor);
  const budgetValid = data.today < week && week >= data.next_week_on && week <= shiftCalendarDays(data.today, 365) && isCalendarDate(week) &&
    new Date(`${week}T12:00:00Z`).getUTCDay() === 1 && budget !== null && budget >= 0 && budget <= 1e12 && goals.categories.some(c => c.id === category && !c.archived);
  const uncertain = uncertainDecision(save.error);
  const busy = save.isPending || !!error || uncertain;
  const date = (value: string) => formatCalendarDate(value, locale);
  const label = (id: string) => { const c = goals.categories.find(c => c.id === id); return c ? categoryLabel(c) : t('common.unknown'); };
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('relationships.boosters')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('relationships.boosterIntro')}</ThemedText>
    {!!error && <ThemedText themeColor="attention" accessibilityRole="alert">{t('goals.loadError')}</ThemedText>}
    <GuideSlot target="boosters-overview" offer="boosters" />
    {!candidates.length && <ThemedText>{t('relationships.noLeftovers')}</ThemedText>}
    {candidates.length > 0 && <>
      <CategoryPicker label={t('relationships.weekToBoost')} value={selected} onChange={setSelected} disabled={busy}
        options={[{ id: '', label: t('relationships.chooseWeek') }, ...candidates.map(c => ({ id: key(c), label: `${label(c.category_id)} · ${date(c.week_on)} · ${money(c.available_minor)}` }))]} />
      {candidate && <>
        <SummaryRow label={t('relationships.weekBudget')} value={money(candidate.amount_minor)} />
        <SummaryRow label={t('relationships.weekSpent')} value={money(candidate.spent_minor)} />
        <SummaryRow label={t('relationships.alreadyBoosted')} value={money(candidate.claimed_minor)} />
        <SummaryRow label={t('relationships.available')} value={money(candidate.available_minor)} />
      </>}
      <CategoryPicker label={t('relationships.destination')} value={goalId} onChange={setGoalId} disabled={busy}
        options={[{ id: '', label: t('relationships.chooseGoal') }, ...goals.goals.filter(g => !g.archived && g.saved_minor < g.target_minor).map(g => ({ id: g.id, label: g.name }))]} />
      <TextField label={t('goals.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!save.isPending} />
      <ThemedText type="smallBold">{t('relationships.syncLabel')}</ThemedText>
      <ThemedText>{t('relationships.synced')}</ThemedText>
      <Switch accessibilityLabel={t('relationships.synced')} value={synced} onValueChange={setSynced} disabled={busy} />
      <GuideSlot target="boosters-save" />
      <Button title={t('relationships.reviewBoost')} disabled={busy || !valid} onPress={() => {
        if (!valid || !candidate || !goal || parsed === null) return;
        setReview({ action: { token: data.token, action: 'boost', values: { categoryId: candidate.category_id, weekOn: candidate.week_on, amountMinor: parsed, goalId: goal.id, goalVersion: goal.version } }, goalRevision: goals.revision,
          details: [{ label: t('relationships.weekToBoost'), value: `${label(candidate.category_id)} · ${date(candidate.week_on)}` }, { label: t('relationships.destination'), value: goal.name }, { label: t('goals.amount'), value: money(parsed) }] });
      }} />
    </>}
    <GuideSlot target="boosters-budget" />
    <Disclosure title={t('relationships.weeklyBudgets')}>
      <ThemedText themeColor="textSecondary">{t('relationships.weeklyHint')}</ThemedText>
      <CategoryPicker label={t('goals.category')} value={category} onChange={setCategory} disabled={busy}
        options={[{ id: '', label: t('relationships.chooseCategory') }, ...goals.categories.filter(c => !c.archived).map(c => ({ id: c.id, label: categoryLabel(c) }))]} />
      <TextField label={t('relationships.startsMonday')} value={week} onChangeText={setWeek} hint={t('cashflow.dateHint')} editable={!save.isPending} />
      <TextField label={t('relationships.weekBudget')} value={budgetAmount} onChangeText={setBudgetAmount} keyboardType="decimal-pad" editable={!save.isPending} />
      <Button title={t('relationships.reviewBudget')} disabled={busy || !budgetValid} onPress={() => {
        if (!budgetValid || budget === null) return;
        setReview({ action: { token: data.token, action: 'budget', values: { categoryId: category, weekOn: week, amountMinor: budget,
          version: data.budgets.find(b => b.category_id === category && b.starts_on === week)?.version ?? 0 } }, goalRevision: goals.revision,
          details: [{ label: t('goals.category'), value: label(category) }, { label: t('relationships.startsMonday'), value: date(week) }, { label: t('relationships.weekBudget'), value: money(budget) }] });
      }} />
      {!data.budgets.length && <ThemedText themeColor="textSecondary">{t('relationships.noWeeklyBudgets')}</ThemedText>}
      {data.budgets.map(b => <SummaryRow key={`${b.category_id}:${b.starts_on}`} label={`${label(b.category_id)} · ${date(b.starts_on)}`} value={b.amount_minor ? money(b.amount_minor) : t('relationships.paused')} />)}
    </Disclosure>
    <PaymentError error={save.error} />
    {uncertain && <ThemedText accessibilityRole="alert" themeColor="attention">{t('relationships.uncertain')}</ThemedText>}
    {notice && <ThemedText accessibilityLiveRegion="polite" themeColor="success">{t('relationships.saved')}</ThemedText>}
    {review && <ActionReview title={t('goals.reviewTitle')}>
      {review.details.map(detail => <SummaryRow key={detail.label} {...detail} />)}
      <ThemedText>{t(review.action.action === 'boost' ? 'relationships.boostReviewHint' : 'relationships.weeklyHint')}</ThemedText>
      {(review.action.token !== data.token || review.goalRevision !== goals.revision) && <ThemedText themeColor="attention" accessibilityRole="alert">{t('goals.changed')}</ThemedText>}
      <Button title={t('goals.confirmDecision')} loading={save.isPending} disabled={!!error || !uncertain && (review.action.token !== data.token || review.goalRevision !== goals.revision)}
        onPress={() => save.mutate(review.action, { onSuccess: () => { setNotice(true); setReview(null); setAmount(''); setSynced(false); signal(review.action.action === 'boost' ? 'booster-saved' : 'weekly-budget-saved'); } })} />
      <Button title={t('common.cancel')} variant="ghost" disabled={save.isPending || uncertain} onPress={() => setReview(null)} />
    </ActionReview>}
    <Button title={t('goals.refresh')} variant="secondary" loading={refreshing} disabled={save.isPending} onPress={onRefresh} />
    <Button title={t('goals.back')} variant="ghost" onPress={() => router.replace('/goals')} />
  </Screen>;
}
