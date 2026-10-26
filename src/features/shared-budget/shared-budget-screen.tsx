import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { HeroCard, HeroRow } from '@/components/ui/hero-card';
import { CategoryRow } from '@/components/ui/category-row';
import { PillActions } from '@/components/ui/pill-actions';
import { SpendDonut, MiniGauge } from '@/components/ui/charts';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { Spacing } from '@/constants/theme';
import type { Workspace } from '@/features/cashflow/schema';
import { categoryLabel } from '@/features/categories/schema';
import { paymentWindow } from '@/features/dashboard/model';
import { useMyHousehold } from '@/features/household/api';
import { dueState, useHouseholdToday } from '@/features/payments/dates';
import { dueLabel } from '@/features/payments/ui';
import { useFormatters } from '@/hooks/use-formatters';
import { SpaceContext, useTheme } from '@/hooks/use-theme';
import { useSharedBudget } from './api';
import { sharedBudgetModel } from './model';

export function SharedBudgetScreen() {
  const household = useMyHousehold();
  const h = household.data?.household;
  const today = useHouseholdToday(h?.timezone ?? 'UTC');
  const query = useSharedBudget(h?.id, today);
  return <SpaceContext value="shared"><SharedBudget
    workspace={query.data} currency={h?.baseCurrency ?? 'USD'} timezone={h?.timezone ?? 'UTC'}
    error={household.isError || query.isError} refreshing={query.isFetching || household.isFetching}
    onRefresh={() => { void household.refetch(); void query.refetch(); }} />
  </SpaceContext>;
}

export type SharedBudgetProps = {
  workspace?: Workspace; currency: string; timezone: string;
  error: boolean; refreshing: boolean; onRefresh: () => unknown;
};

export function SharedBudget({ workspace, currency, timezone, error, refreshing, onRefresh }: SharedBudgetProps) {
  const { t } = useTranslation();
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const format = useFormatters(timezone);
  const theme = useTheme();
  const result = useMemo(() => {
    if (!workspace || error) return null;
    try { return sharedBudgetModel(workspace); } catch { return null; }
  }, [workspace, error]);
  const failed = error || (!!workspace && !result);
  const money = (amount: number) => format.money(amount, currency);
  const month = workspace ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${workspace.today.slice(0, 7)}-15T12:00:00Z`)) : '';
  return <Screen withTabBar>
    {Platform.OS === 'web' && <View style={styles.webTabSpacer} />}
    <View style={styles.heading}>
      <ThemedText type="subtitle" accessibilityRole="header">{t('sharedBudget.title')}</ThemedText>
      <ThemedText themeColor="textSecondary">{month}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('sharedBudget.description')}</ThemedText>
    </View>
    {!result ? <View style={styles.section}>
      <ThemedText accessibilityRole={failed ? 'alert' : undefined} themeColor={failed ? 'attention' : 'textSecondary'}>
        {t(failed ? 'sharedBudget.loadError' : 'dashboard.loading')}
      </ThemedText>
      {failed && <Button title={t('common.tryAgain')} onPress={onRefresh} />}
    </View> : <>
      <HeroCard title={t('dashboard.spent')} value={money(result.spent)}
        progress={result.hasPlan && result.plan > 0 ? result.spent / result.plan * 100 : null}
        progressLabel={t('dashboard.progress')}
        progressSummary={t('dashboard.spentOfPlan', { spent: money(result.spent), plan: money(result.plan) })}
        warning={result.hasPlan && result.remaining < 0 ? t('dashboard.overPlan', { amount: money(-result.remaining) }) : undefined}>
        <HeroRow label={t('dashboard.planned')} value={result.hasPlan ? money(result.plan) : t('sharedBudget.noPlan')} />
        {result.hasPlan && <HeroRow label={t('dashboard.remaining')} value={money(result.remaining)} />}
      </HeroCard>
      <ThemedText type="small" themeColor="textSecondary">{t('sharedBudget.actualHint')}</ThemedText>
      {result.futureCount > 0 && <ThemedText type="small" themeColor="textSecondary">{t('sharedBudget.futureHint')}</ThemedText>}
      <PillActions actions={[
        { label: t('budget.review'), icon: 'bill', onPress: () => router.push('/(onboarding)/budget') },
        { label: t('sharedBudget.assign'), icon: 'chart', onPress: () => router.push('/budget-categories') },
        { label: t('categories.manage'), icon: 'settings', onPress: () => router.push('/categories') },
      ]} />
      <Card>
        <ThemedText type="section" accessibilityRole="header">{t('sharedBudget.categories')}</ThemedText>
        <SpendDonut label={t('dashboard.spent')} value={money(result.spent)}
          segments={result.rows.map(row => ({ id: row.category.id, label: categoryLabel(row.category), amount: row.spent }))
            .concat(result.uncategorisedCount ? [{ id: 'uncategorised', label: t('sharedBudget.uncategorised'), amount: result.uncategorisedSpent }] : [])}
          summary={t('design.categorySummary', { label: t('sharedBudget.categories'), value: money(result.spent),
            details: result.rows.map(row => `${categoryLabel(row.category)}: ${money(row.spent)}`)
              .concat(result.uncategorisedCount ? [`${t('sharedBudget.uncategorised')}: ${money(result.uncategorisedSpent)}`] : []).join('; ') })} />
        {result.hasPlan && <View style={styles.gauges}>
          <MiniGauge label={t('sharedBudget.plan')} value={money(result.plan)} summary={`${t('sharedBudget.plan')}: ${money(result.plan)}`} />
          <MiniGauge label={t('sharedBudget.spent')} value={money(result.spent)} ratio={result.plan > 0 ? result.spent / result.plan : null}
            summary={t('dashboard.spentOfPlan', { spent: money(result.spent), plan: money(result.plan) })} />
          <MiniGauge label={t('sharedBudget.remaining')} value={money(result.remaining)} ratio={result.plan > 0 ? result.remaining / result.plan : null}
            summary={`${t('sharedBudget.remaining')}: ${money(result.remaining)}`} />
        </View>}
        <ThemedText type="small" themeColor="textSecondary">{t('design.chartHint')}</ThemedText>
      </Card>

      <View style={styles.section}>
        <ThemedText type="small" themeColor="textSecondary">{t('sharedBudget.categoryHint')}</ThemedText>
        {result.rows.length === 0 && <ThemedText themeColor="textSecondary">{t('sharedBudget.emptyCategories')}</ThemedText>}
        {result.rows.map(row => <CategoryRow key={row.category.id} id={row.category.id} name={row.category.name} emoji={row.category.emoji}>
          <ThemedText type="small" themeColor="textSecondary">
            {t(`categories.buckets.${row.category.bucket}`)}{row.category.archived ? ` · ${t('payments.archived')}` : ''}
          </ThemedText>
          <SummaryRow label={t('sharedBudget.spent')} value={money(row.spent)} />
          {row.plan === null ? <ThemedText type="small" themeColor="textSecondary">{t('sharedBudget.notAssigned')}</ThemedText> : <>
            <SummaryRow label={t('sharedBudget.plan')} value={money(row.plan)} />
            <SummaryRow label={t('sharedBudget.remaining')} value={money(row.remaining!)} />
            {row.remaining! < 0 && <ThemedText type="small" themeColor="attention">
              {t('sharedBudget.categoryOver', { amount: money(-row.remaining!) })}
            </ThemedText>}
          </>}
        </CategoryRow>)}
        {result.uncategorisedCount > 0 && <View style={styles.category}>
          <SummaryRow label={t('sharedBudget.uncategorised')} value={money(result.uncategorisedSpent)} />
        </View>}
        {result.unassigned.length > 0 && <View style={styles.section}>
          <SummaryRow label={t('sharedBudget.unassigned')} value={money(result.unassignedAmount)} />
          <ThemedText type="small" themeColor="textSecondary">{t('sharedBudget.unassignedHint')}</ThemedText>
          {result.unassigned.map(line => <SummaryRow key={line.id} label={line.name} value={money(line.amount_minor)} />)}
        </View>}
      </View>

      <View style={styles.section}>
        <ThemedText type="section" accessibilityRole="header">{t('payments.upcomingTitle')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{t('sharedBudget.paymentHint')}</ThemedText>
        {!result.pending.length && <ThemedText themeColor="textSecondary">{t('dashboard.noPayments')}</ThemedText>}
        {result.pending.map(item => {
          const window = paymentWindow(item);
          const state = dueState(window.dueStart, window.dueEnd, workspace!.today);
          return <View key={item.key} style={[styles.category, { borderBottomColor: theme.border }]}>
            <SummaryRow label={item.name} value={item.amount === null ? t('payments.unknownAmount') : money(item.amount)} />
            <ThemedText themeColor="textSecondary">{dueLabel(window, locale)}</ThemedText>
            <ThemedText type="small" themeColor={state === 'overdue' ? 'attention' : 'textSecondary'}>
              {t('dashboard.unpaid')} · {t(`payments.${state}`)}{item.corrected ? ` · ${t('cashflow.corrected')}` : ''}
            </ThemedText>
            <Button variant="ghost" title={t('dashboard.reviewPayment', { name: item.name })}
              onPress={() => router.push({ pathname: '/payment-detail', params: { id: item.key.split(':')[1] } })} />
          </View>;
        })}
        <Button variant="secondary" title={t('payments.all')} onPress={() => router.push('/payments')} />
      </View>
    </>}
    <Button variant="secondary" title={t('expenses.title')} onPress={() => router.push({ pathname: '/expenses', params: { visibility: 'shared' } })} />
    <Button variant="ghost" title={t('sharedBudget.refresh')} accessibilityLabel={t('sharedBudget.refresh')}
      loading={refreshing} onPress={onRefresh} />
  </Screen>;
}

const styles = StyleSheet.create({
  webTabSpacer: { height: 0 },
  gauges: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
  heading: { gap: Spacing.two },
  section: { gap: Spacing.three, paddingVertical: Spacing.two },
  category: { gap: Spacing.two, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
});
