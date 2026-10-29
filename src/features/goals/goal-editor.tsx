import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { ActionReview } from '@/components/ui/action-review';
import { Button } from '@/components/ui/button';
import { CategoryPicker } from '@/components/ui/category-picker';
import { Choice, Choices } from '@/components/ui/choices';
import { Disclosure } from '@/components/ui/disclosure';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { TextField } from '@/components/ui/text-field';
import { isCalendarDate } from '@/features/budget/schema';
import { useFlowMoney } from '@/features/cashflow/ui';
import { categoryLabel } from '@/features/categories/schema';
import { useGuideAction } from '@/features/guides/context';
import { GuideSlot } from '@/features/guides/guide-slot';
import type { Household } from '@/features/household/schema';
import { PaymentError } from '@/features/payments/ui';
import { SpaceContext } from '@/hooks/use-theme';
import { useGoalAction } from './api';
import type { GoalWorkspace } from './schema';
import { GoalLoading, useGoalData, type GoalMutation, type GoalReview } from './ui';

export function GoalEditorScreen() {
  const { id, kind } = useLocalSearchParams<{ id?: string; kind?: string }>();
  const { household, query, error, refresh } = useGoalData();
  const [reload, setReload] = useState(0);
  if (!household.data || !query.data) return <GoalLoading error={error} retry={refresh} />;
  if (id && !query.data.goals.some(g => g.id === id)) return <GoalLoading unavailable retry={refresh} />;
  return <SpaceContext value="shared"><ConnectedEditor key={`${household.data.household.id}:${household.data.me.userId}:${id}:${reload}`}
    data={query.data} household={household.data.household} userId={household.data.me.userId} id={id} initialKind={kind === 'sinking' ? 'sinking' : 'goal'} error={error}
    onReload={async () => { await refresh(); setReload(value => value + 1); }} /></SpaceContext>;
}
type Props = { data: GoalWorkspace; household: Household; userId: string; id?: string; initialKind?: 'goal' | 'sinking'; error?: boolean; onReload: () => unknown };
function ConnectedEditor(props: Props) {
  const save = useGoalAction(props.household.id, props.userId);
  return <GoalEditor {...props} save={save} />;
}
export function GoalEditor({ data, household, id, initialKind, error, onReload, save }: Props & { save: GoalMutation }) {
  const { t } = useTranslation();
  const { edit, parse, money } = useFlowMoney(household.baseCurrency, household.timezone);
  const [initial] = useState(() => data.goals.find(g => g.id === id));
  const [kind, setKind] = useState<'goal' | 'sinking'>(initial?.kind ?? initialKind ?? 'goal');
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(initial ? edit(initial.target_minor) : '');
  const [deadline, setDeadline] = useState(initial?.deadline_on ?? data.today);
  const [category, setCategory] = useState(initial?.category_id ?? data.categories.find(c => !c.archived && c.bucket === 'savings')?.id ?? '');
  const [plan, setPlan] = useState<{ id: string; version: number } | null>(null);
  const [review, setReview] = useState<GoalReview | null>(null);
  const signal = useGuideAction();
  const amount = parse(target);
  const valid = name.trim().length > 0 && name.trim().length <= 80 && amount !== null && amount > 0 && amount >= (initial?.saved_minor ?? 0) &&
    isCalendarDate(deadline) && deadline >= (initial?.starts_on ?? data.today) && deadline <= `${Number(data.today.slice(0, 4)) + 10}${data.today.slice(4)}` &&
    data.categories.some(c => c.id === category && !c.archived) && (!plan || data.forecast_plans.some(p => p.id === plan.id && p.version === plan.version));
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t(initial ? 'goals.edit' : 'goals.create')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('goals.planHint')}</ThemedText>
    <GuideSlot target="goal-form" />
    <Choices label={t('relationships.goalType')}>
      <Choice label={t('relationships.savingsGoal')} selected={kind === 'goal'} onPress={() => setKind('goal')} disabled={save.isPending} />
      <Choice label={t('relationships.sinkingFund')} selected={kind === 'sinking'} onPress={() => setKind('sinking')} disabled={save.isPending} />
    </Choices>
    {kind === 'sinking' && <ThemedText themeColor="textSecondary">{t('relationships.sinkingHint')}</ThemedText>}
    {!!error && <ThemedText themeColor="attention" accessibilityRole="alert">{t('goals.loadError')}</ThemedText>}
    <TextField label={t('goals.name')} value={name} onChangeText={setName} maxLength={80} />
    <TextField label={t('goals.target', { currency: household.baseCurrency })} value={target} onChangeText={setTarget} keyboardType="decimal-pad" />
    <TextField label={t('goals.deadline')} value={deadline} onChangeText={setDeadline} hint={t('cashflow.dateHint')} autoCapitalize="none" />
    <CategoryPicker label={t('goals.category')} value={category} options={data.categories.filter(c => !c.archived).map(c => ({ id: c.id, label: categoryLabel(c) }))} onChange={setCategory} disabled={save.isPending} />
    {initial && <ThemedText type="small" themeColor="textSecondary">{t('goals.editHint', { amount: money(initial.saved_minor) })}</ThemedText>}
    {!initial && data.forecast_plans.length > 0 && <Disclosure title={t('goals.replaceReservation')}>
      <ThemedText type="small" themeColor="textSecondary">{t('goals.replaceHint')}</ThemedText>
      <Choices label={t('goals.replaceReservation')}>
        <Choice label={t('goals.keepReservations')} selected={!plan} onPress={() => setPlan(null)} />
        {data.forecast_plans.map(p => <Choice key={p.id} label={`${p.name} · ${money(p.amount_minor)}`} selected={plan?.id === p.id} onPress={() => setPlan({ id: p.id, version: p.version })} />)}
      </Choices>
    </Disclosure>}
    <PaymentError error={save.error} />
    <Button title={t('goals.reviewPlan')} disabled={!valid || save.isPending || !!error} onPress={() => setReview({ revision: data.revision,
      label: t('goals.planReviewHint'), details: [{ label: t('relationships.goalType'), value: t(kind === 'sinking' ? 'relationships.sinkingFund' : 'relationships.savingsGoal') }, { label: t('goals.name'), value: name.trim() }, { label: t('goals.targetPlain'), value: money(amount!) }, { label: t('goals.deadline'), value: deadline }],
      action: { action: 'save', values: { id: initial?.id ?? null, version: initial?.version ?? 0, kind, name: name.trim(), targetMinor: amount!, deadlineOn: deadline, categoryId: category,
        replacePlanId: plan?.id ?? null, replacePlanVersion: plan?.version ?? 0 } } })} />
    {review && <ActionReview title={t('goals.reviewTitle')}>
      <ThemedText>{review.label}</ThemedText>
      {review.details.map(detail => <SummaryRow key={detail.label} {...detail} />)}
      {plan && <ThemedText themeColor="attention">{t('goals.replaceWarning')}</ThemedText>}
      {data.revision !== review.revision && <ThemedText themeColor="attention" accessibilityRole="alert">{t('goals.changed')}</ThemedText>}
      <Button title={t('goals.confirmPlan')} loading={save.isPending} disabled={!!error || data.revision !== review.revision}
        onPress={() => save.mutate({ ...review.action, revision: review.revision }, { onSuccess: result => {
          signal('goal-saved'); router.replace({ pathname: '/goal', params: { id: result.id } });
        } })} />
      <Button title={t('common.cancel')} variant="ghost" disabled={save.isPending} onPress={() => setReview(null)} />
    </ActionReview>}
    <Button title={t('goals.reloadDraft')} variant="secondary" disabled={save.isPending} onPress={onReload} />
    <ThemedText type="small" themeColor="textSecondary">{t('goals.reloadHint')}</ThemedText>
    <Button title={t('common.cancel')} variant="ghost" disabled={save.isPending} onPress={() => router.replace('/goals')} />
  </Screen>;
}
