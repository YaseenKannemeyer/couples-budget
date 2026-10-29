import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { ProgressBar } from '@/components/ui/progress-bar';
import { SummaryRow } from '@/components/ui/summary-row';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useFlowMoney } from '@/features/cashflow/ui';
import { GuideSlot } from '@/features/guides/guide-slot';
import type { Household } from '@/features/household/schema';
import { formatCalendarDate } from '@/features/payments/dates';
import { SpaceContext } from '@/hooks/use-theme';
import { goalProgress, sinkingMonthlyNeed } from './model';
import type { Goal, GoalWorkspace } from './schema';
import { GoalLoading, useGoalData } from './ui';

export function GoalsScreen() {
  const { household, query, error, refresh } = useGoalData();
  if (!household.data || !query.data) return <GoalLoading error={error} retry={refresh} />;
  return <SpaceContext value="shared"><GoalsList data={query.data} household={household.data.household}
    error={error} refreshing={query.isFetching} onRefresh={refresh} /></SpaceContext>;
}
export function GoalsList({ data, household, error, refreshing, onRefresh }: {
  data: GoalWorkspace; household: Household; error?: boolean; refreshing?: boolean; onRefresh: () => unknown;
}) {
  const { t } = useTranslation();
  const { money, locale } = useFlowMoney(household.baseCurrency, household.timezone);
  const row = (goal: Goal) => {
    const progress = goalProgress(goal);
    return <View key={goal.id} style={styles.row}>
      {goal.kind === 'sinking' && <ThemedText type="small" themeColor="textSecondary">{t('relationships.sinkingFund')}</ThemedText>}
      <ThemedText type="section" accessibilityRole="header">{goal.name}</ThemedText>
      <SummaryRow label={t('goals.saved')} value={money(goal.saved_minor)} />
      {goal.kind === 'sinking' && <><SummaryRow label={t('goals.remaining')} value={money(progress.remaining)} /><SummaryRow label={t('relationships.monthlyNeeded')} value={money(sinkingMonthlyNeed(goal, data.today))} /></>}
      <ProgressBar value={progress.percent} label={t('goals.progress', { name: goal.name })}
        summary={t('goals.progressSummary', { saved: money(goal.saved_minor), target: money(goal.target_minor) })} />
      <ThemedText type="small" themeColor="textSecondary">{t('goals.targetDate', { amount: money(goal.target_minor), date: formatCalendarDate(goal.deadline_on, locale) })}</ThemedText>
      {progress.completed && <ThemedText type="smallBold" themeColor="success">{t('goals.reached')}</ThemedText>}
      {!progress.completed && !goal.archived && goal.deadline_on < data.today && <ThemedText type="small" themeColor="attention">{t('goals.overdue')}</ThemedText>}
      <Button title={t('goals.open', { name: goal.name })} variant="secondary" onPress={() => router.push({ pathname: '/goal', params: { id: goal.id } })} />
    </View>;
  };
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('goals.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('goals.intro')}</ThemedText>
    {!!error && <ThemedText accessibilityRole="alert" themeColor="attention">{t('goals.loadError')}</ThemedText>}
    <GuideSlot target="goals-overview" offer="goals" />
    <Button title={t('goals.create')} disabled={!!error} onPress={() => router.push('/goal-edit')} />
    <Button title={t('relationships.createSinking')} variant="secondary" disabled={!!error} onPress={() => router.push({ pathname: '/goal-edit', params: { kind: 'sinking' } })} />
    <Button title={t('relationships.boosters')} variant="secondary" onPress={() => router.push('/boosters')} />
    {!data.goals.some(g => !g.archived) && <ThemedText themeColor="textSecondary">{t('goals.empty')}</ThemedText>}
    {data.goals.filter(g => !g.archived).map(row)}
    {data.goals.some(g => g.archived) && <Disclosure title={t('goals.archived')}>{data.goals.filter(g => g.archived).map(row)}</Disclosure>}
    <Button title={t('goals.refresh')} variant="secondary" loading={refreshing} onPress={onRefresh} />
    <Button title={t('payments.home')} variant="ghost" onPress={() => router.replace('/')} />
  </Screen>;
}
const styles = StyleSheet.create({ row: { gap: Spacing.two, paddingVertical: Spacing.two } });
