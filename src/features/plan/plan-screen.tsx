import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { GroupGap, ListRow, ListSection } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { TabHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { useCashflow } from '@/features/cashflow/api';
import type { Workspace } from '@/features/cashflow/schema';
import { featureVisual } from '@/features/categories/visual';
import { useHomeActivity } from '@/features/dashboard/api';
import type { HomeActivity } from '@/features/dashboard/schema';
import { useGoals } from '@/features/goals/api';
import type { GoalWorkspace } from '@/features/goals/schema';
import { useMyHousehold } from '@/features/household/api';
import { formatCalendarDate, useHouseholdToday } from '@/features/payments/dates';
import { useFormatters } from '@/hooks/use-formatters';
import { goalsSummary, planModel } from './model';

type HouseholdData = NonNullable<ReturnType<typeof useMyHousehold>['data']>;

export function PlanScreen() {
  const household = useMyHousehold();
  const today = useHouseholdToday(household.data?.household.timezone ?? 'UTC');
  const cashflow = useCashflow(household.data?.household.id, today);
  const goals = useGoals(household.data?.household.id);
  const activity = useHomeActivity(household.data?.household.id, today);
  if (!household.data) return null;
  return <Plan household={household.data} workspace={cashflow.data} goals={goals.data} activity={activity.data}
    flowError={cashflow.isError} goalsError={goals.isError} activityError={activity.isError}
    refreshing={cashflow.isFetching || goals.isFetching || activity.isFetching}
    onRefresh={() => Promise.all([cashflow.refetch(), goals.refetch(), activity.refetch(), household.refetch()])} />;
}

export type PlanProps = {
  household: HouseholdData; workspace?: Workspace; goals?: GoalWorkspace; activity?: HomeActivity;
  flowError: boolean; goalsError: boolean; activityError: boolean; refreshing: boolean; onRefresh: () => unknown;
};

/** Grouped entry points into existing features. Subtitles are facts or plain descriptions — never placeholders. */
export function Plan({ household: data, workspace, goals, activity, flowError, goalsError, activityError, refreshing, onRefresh }: PlanProps) {
  const { t } = useTranslation();
  const { household, me, members } = data;
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const format = useFormatters(household.timezone);
  const money = (amount: number) => format.money(amount, household.baseCurrency);
  const model = useMemo(() => {
    if (!workspace || flowError) return null;
    try { return planModel(workspace, members); } catch { return null; }
  }, [workspace, flowError, members]);
  const saved = goals && !goalsError ? goalsSummary(goals.goals) : null;
  const monthOf = (style: 'long' | 'month') => workspace ? new Intl.DateTimeFormat(locale, style === 'long'
    ? { month: 'long', year: 'numeric', timeZone: 'UTC' } : { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${workspace.today.slice(0, 7)}-15T12:00:00Z`)) : '';
  const unavailable = t('banking.overview.unavailable');

  return <Screen withTabBar withAction refreshing={refreshing} onRefresh={onRefresh}>
    <TabHeader title={t('banking.plan.title')} subtitle={monthOf('long') || undefined}
      trailing={{ kind: 'profile', initial: Array.from(me.displayName.trim())[0]?.toUpperCase() ?? '?', label: t('banking.profile'), onPress: () => router.push('/settings') }} />

    <ListSection title={t('banking.plan.sharedPlan')}>
      <ListRow title={t('banking.plan.spending')} visual={featureVisual.spending}
        subtitle={!model ? (flowError ? unavailable : t('dashboard.loading')) : model.hasPlan
          ? t('banking.plan.spendingHint', { spent: money(model.spent), plan: money(model.plan) }) : t('banking.plan.spendingEmpty')}
        onPress={() => router.push('/shared-budget')} />
      <ListRow title={t('banking.plan.bills')} visual={featureVisual.bills}
        subtitle={!model ? (flowError ? unavailable : t('dashboard.loading')) : model.overdue
          ? t('banking.plan.billsOverdue', { count: model.overdue }) : model.dueThisWeek
            ? t('banking.plan.billsDue', { count: model.dueThisWeek }) : t('banking.plan.billsNone')}
        tone={model?.overdue ? 'attention' : 'default'} onPress={() => router.push('/payments')} />
      <ListRow title={t('banking.plan.goals')} visual={featureVisual.goals}
        subtitle={!saved ? (goalsError ? unavailable : t('dashboard.loading')) : saved.count
          ? t('banking.plan.goalsSummary', { count: saved.count, saved: money(saved.saved) }) : t('banking.plan.goalsEmpty')}
        onPress={() => router.push('/goals')} />
      <ListRow title={t('banking.plan.contributions')} visual={featureVisual.contributions} last
        subtitle={t('banking.plan.contributionsHint', { split: t(`split.${household.splitMode}.label`) })}
        onPress={() => router.push('/income')} />
    </ListSection>

    <GroupGap />
    <View>
      <ListRow title={t('banking.plan.forecast')} visual={featureVisual.forecast}
        subtitle={model?.lowest ? t('banking.plan.forecastLow', { amount: money(model.lowest.amount), date: formatCalendarDate(model.lowest.on, locale) })
          : t('banking.plan.forecastHint')}
        onPress={() => router.push('/cash-flow')} />
      <ListRow title={t('banking.plan.review')} visual={featureVisual.review}
        subtitle={t('banking.plan.reviewHint', { month: monthOf('month') || t('moneyDate.title') })} onPress={() => router.push('/money-date')} />
      <ListRow title={t('banking.plan.balance')} visual={featureVisual.balance} last
        subtitle={t('banking.plan.balanceHint')} onPress={() => router.push('/reconciliation')} />
    </View>

    <GroupGap />
    <ListSection title={t('banking.plan.allowances')}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>{t('banking.plan.allowancesHint')}</ThemedText>
      {activity && !activityError ? members.map((member, index) => {
        const balance = activity.allowances.find(a => a.user_id === member.userId);
        return <ListRow key={member.userId} title={member.displayName} visual={featureVisual.allowance} last={index === members.length - 1}
          value={balance ? money(balance.remaining_minor) : t('dashboard.unavailable')}
          valueHint={balance ? t('sharedBudget.remaining') : undefined} />;
      }) : <View style={styles.state}>
        <ThemedText accessibilityRole={activityError ? 'alert' : undefined} themeColor={activityError ? 'attention' : 'textSecondary'}>
          {t(activityError ? 'dashboard.loadError' : 'dashboard.loading')}
        </ThemedText>
        {activityError && <Button title={t('common.tryAgain')} variant="secondary" onPress={onRefresh} />}
      </View>}
    </ListSection>

    <GroupGap />
    <ListSection title={t('banking.plan.tools')}>
      <ListRow title={t('banking.plan.boosters')} visual={featureVisual.boosters} subtitle={t('banking.plan.boostersHint')} onPress={() => router.push('/boosters')} />
      <ListRow title={t('banking.plan.categories')} visual={featureVisual.categories} subtitle={t('banking.plan.categoriesHint')} onPress={() => router.push('/categories')} />
      <ListRow title={t('banking.plan.budgetSetup')} visual={featureVisual.budget} last
        subtitle={t(me.budgetCompletedAt ? 'banking.plan.budgetSetupHint' : me.budgetSetupStep > 0 ? 'budget.resume' : 'budget.start')}
        onPress={() => router.push('/budget')} />
    </ListSection>
  </Screen>;
}

const styles = StyleSheet.create({
  hint: { paddingTop: Spacing.two },
  state: { gap: Spacing.two, paddingVertical: Spacing.three },
});
