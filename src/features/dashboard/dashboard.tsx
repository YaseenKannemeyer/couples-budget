import { Disclosure } from '@/components/ui/disclosure';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { HeroCard, HeroRow } from '@/components/ui/hero-card';
import { StatTile } from '@/components/ui/stat-tile';
import { PillActions } from '@/components/ui/pill-actions';
import { Spacing } from '@/constants/theme';
import type { Workspace } from '@/features/cashflow/schema';
import type { useMyHousehold } from '@/features/household/api';
import { formatCalendarDate, dueState } from '@/features/payments/dates';
import { dueLabel } from '@/features/payments/ui';
import { useFormatters } from '@/hooks/use-formatters';
import { homeModel, paymentWindow } from './model';
import type { HomeActivity } from './schema';

type HouseholdData = NonNullable<ReturnType<typeof useMyHousehold>['data']>;
export type DashboardProps = {
  household: HouseholdData;
  workspace?: Workspace;
  activity?: HomeActivity;
  flowError: boolean;
  activityError: boolean;
  onRetryFlow: () => unknown;
  onRetryActivity: () => unknown;
  onRefresh: () => unknown;
  refreshing: boolean;
  invite?: ReactNode;
};

export function Dashboard({ household: data, workspace, activity, flowError, activityError,
  onRetryFlow, onRetryActivity, onRefresh, refreshing, invite }: DashboardProps) {
  const { t } = useTranslation();
  const { household, me, partner, members } = data;
  const format = useFormatters(household.timezone);
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const model = useMemo(() => workspace ? homeModel(workspace, members) : null, [workspace, members]);
  const money = (amount: number) => format.money(amount, household.baseCurrency);
  const displayDate = (on: string) => formatCalendarDate(on, locale);
  const reviewBudget = () => router.push('/budget');
  const budgetTitle = t(me.budgetCompletedAt ? 'budget.review' : me.budgetSetupStep > 0 ? 'budget.resume' : 'budget.start');
  const month = workspace ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${workspace.today.slice(0, 7)}-15T12:00:00Z`)) : '';
  const usable = model && !flowError;

  return <Screen withTabBar>
    {Platform.OS === 'web' && <View style={styles.webTabSpacer} />}
    <View style={styles.heading}>
      <ThemedText type="subtitle" accessibilityRole="header">{t('home.greeting', { name: me.displayName })}</ThemedText>
      <ThemedText themeColor="textSecondary">{household.name}</ThemedText>
    </View>
    {!partner && invite}

    {usable && <GuideSlot target="home-summary" offer="first-visit" />}
    {!me.budgetCompletedAt && <ThemedText themeColor="textSecondary">{t('budget.firstSuccess')}</ThemedText>}
    {usable ? <>
      <HeroCard title={t('dashboard.month', { month })} value={money(model.spent)} subtitle={t('dashboard.spent')}
        progress={model.progress} progressLabel={t('dashboard.progress')}
        progressSummary={t('dashboard.spentOfPlan', { spent: money(model.spent), plan: money(model.plan) })}
        warning={model.remaining < 0 && model.progress !== null ? t('dashboard.overPlan', { amount: money(-model.remaining) }) : undefined}>
        <HeroRow label={t('dashboard.planned')} value={money(model.plan)} />
        {model.progress !== null ? <HeroRow label={t('dashboard.remaining')} value={money(model.remaining)} /> :
          <ThemedText themeColor="heroSecondary">{t('dashboard.noPlan')}</ThemedText>}
      </HeroCard>
      <View style={styles.tiles}>
        <StatTile icon="income" label={t(model.incomeComplete ? 'budget.jointIncome' : 'dashboard.incomeSoFar')}
          value={money(model.income)} hint={!model.incomeComplete ? t('dashboard.incomePending') : undefined} />
        <StatTile icon="bill" label={t('dashboard.commitments')} value={money(model.commitments)}
          hint={model.unknownCommitments ? t('dashboard.unknownCommitments') : undefined} />
      </View>
      <Disclosure title={t('phase18.totalsDetails')}><ThemedText type="small" themeColor="textSecondary">{t('dashboard.budgetHint')}</ThemedText></Disclosure>
    </> : <Card><ThemedText type="smallBold">{t('dashboard.month', { month })}</ThemedText><SectionState error={flowError} retry={onRetryFlow} /></Card>}
    <PillActions actions={[
      { label: budgetTitle, icon: 'bill', onPress: reviewBudget },
      { label: t('sharedBudget.title'), icon: 'chart', onPress: () => router.push('/shared-budget') },
      { label: t('reconciliation.title'), icon: 'bill', onPress: () => router.push('/reconciliation') },
      { label: t('moneyDate.title'), icon: 'bill', onPress: () => router.push('/money-date') },
      { label: t('goals.title'), icon: 'chart', onPress: () => router.push('/goals') },
    ]} />

    <View style={styles.section}>
      <ThemedText type="section" accessibilityRole="header">{t('dashboard.allowances')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('dashboard.allowancePrivacy')}</ThemedText>
      {activity && !activityError ? <Card>{members.map(member => {
        const balance = activity.allowances.find(a => a.user_id === member.userId);
        return <SummaryRow key={member.userId} label={member.displayName}
          value={balance ? money(balance.remaining_minor) : t('dashboard.unavailable')} />;
      })}</Card> : <SectionState error={activityError} retry={onRetryActivity} />}
    </View>

    <View style={styles.section}>
      <ThemedText type="section" accessibilityRole="header">{t('payments.upcomingTitle')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('dashboard.sharedOnly')}</ThemedText>
      {usable ? <>
        {!model.pending.length && <ThemedText themeColor="textSecondary">{t('dashboard.noPayments')}</ThemedText>}
        {model.pending.map(item => {
          const dates = paymentWindow(item);
          const state = dueState(dates.dueStart, dates.dueEnd, workspace!.today);
          return <View key={item.key} style={styles.entry}>
            <SummaryRow label={item.name} value={item.amount === null ? t('payments.unknownAmount') : money(item.amount)} />
            <ThemedText themeColor="textSecondary">{dueLabel(dates, locale)}</ThemedText>
            <ThemedText type="small" themeColor={state === 'overdue' ? 'attention' : 'textSecondary'}>
              {t('dashboard.unpaid')} · {t(`payments.${state}`)}{item.corrected ? ` · ${t('cashflow.corrected')}` : ''}
            </ThemedText>
            <Button variant="ghost" title={t('dashboard.reviewPayment', { name: item.name })}
              onPress={() => router.push({ pathname: '/payment-detail', params: { id: item.key.split(':')[1] } })} />
          </View>;
        })}
      </> : <SectionState error={flowError} retry={onRetryFlow} />}
      {activity && !activityError && activity.paid.length > 0 && <>
        <ThemedText type="smallBold">{t('dashboard.paidThisMonth')}</ThemedText>
        {activity.paid.map(record => <View key={record.id} style={styles.entry}>
          <SummaryRow label={record.name} value={money(record.amount_minor)} />
          <ThemedText type="small" themeColor="success">{t('dashboard.paidOn', { date: displayDate(record.paid_on) })}</ThemedText>
        </View>)}
      </>}
      <Button variant="secondary" title={t('payments.all')} onPress={() => router.push('/payments')} />
    </View>

    <Card>
      <ThemedText type="section" accessibilityRole="header">{t('dashboard.cashflow')}</ThemedText>
      {usable ? <>
        <SummaryRow label={t('dashboard.nextIncome')} value={model.nextIncome ? displayDate(model.nextIncome.on) : t('dashboard.noIncome')} />
        {model.nextIncome?.amount != null && <SummaryRow label={t('cashflow.contribution')} value={money(model.nextIncome.amount)} />}
        <SummaryRow label={t('dashboard.commitments')} value={money(model.commitments)} />
        {model.unknownCommitments && <ThemedText themeColor="attention">{t('dashboard.unknownCommitments')}</ThemedText>}
        {model.projection.lowest === null ? <ThemedText themeColor="textSecondary">{t('cashflow.needBalance')}</ThemedText> : <>
          <SummaryRow label={t('cashflow.confirmedBalance')} value={money(model.projection.confirmed!)} />
          {model.projection.reservedSavings > 0 && <SummaryRow label={t('goals.reserved')} value={money(model.projection.reservedSavings)} />}
          <SummaryRow label={t('cashflow.lowest', { date: displayDate(model.projection.lowestOn) })} value={money(model.projection.lowest)} />
          {model.projection.low && <ThemedText accessibilityRole="alert" themeColor="attention">{t('cashflow.lowWarning', { amount: money(model.projection.beforePayday!) })}</ThemedText>}
        </>}
        {model.projection.gaps.length > 0 && <ThemedText type="small" themeColor="attention">{t('dashboard.forecastGaps')}</ThemedText>}
        <ThemedText type="small" themeColor="textSecondary">{t('dashboard.forecastHint')}</ThemedText>
      </> : <SectionState error={flowError} retry={onRetryFlow} />}
      <Button title={t('cashflow.title')} variant="secondary" onPress={() => router.push('/cash-flow')} />
    </Card>

    <View style={styles.section}>
      <ThemedText type="section" accessibilityRole="header">{t('dashboard.activity')}</ThemedText>
      {activity && !activityError ? <>
        {!activity.recent.length && <ThemedText themeColor="textSecondary">{t('dashboard.noActivity')}</ThemedText>}
        {activity.recent.map(entry => <View key={entry.id} style={styles.entry}>
          <SummaryRow label={entry.description || t('cashflow.transaction')} value={money(-entry.amount_minor)} />
          <ThemedText type="small" themeColor="textSecondary">{t('dashboard.activityBy', {
            name: members.find(m => m.userId === entry.paid_by)?.displayName ?? t('common.unknown'), date: displayDate(entry.occurred_on),
          })}</ThemedText>
          {entry.amount_minor < 0 && <ThemedText type="small" themeColor="success">{t('dashboard.refund')}</ThemedText>}
          <Button title={t('conversation.open')} variant="ghost"
            onPress={() => router.push({ pathname: '/expense-thread', params: { id: entry.id } })} />
        </View>)}
      </> : <SectionState error={activityError} retry={onRetryActivity} />}
      <Button title={t('expenses.title')} variant="secondary" onPress={() => router.push('/expenses')} />
    </View>
    <Button title={t('dashboard.refresh')} accessibilityLabel={t('dashboard.refresh')} variant="ghost" loading={refreshing} onPress={onRefresh} />
  </Screen>;
}

function SectionState({ error, retry }: { error: boolean; retry: () => unknown }) {
  const { t } = useTranslation();
  return <View style={styles.entry}>
    <ThemedText accessibilityRole={error ? 'alert' : undefined} themeColor={error ? 'attention' : 'textSecondary'}>
      {t(error ? 'dashboard.loadError' : 'dashboard.loading')}
    </ThemedText>
    {error && <Button title={t('common.tryAgain')} variant="secondary" onPress={retry} />}
  </View>;
}

const styles = StyleSheet.create({
  webTabSpacer: { height: 0 },
  heading: { gap: Spacing.one },
  section: { gap: Spacing.three, paddingVertical: Spacing.two },
  entry: { gap: Spacing.two, paddingVertical: Spacing.two },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.three },
});
