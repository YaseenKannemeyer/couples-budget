import { GuideSlot } from '@/features/guides/guide-slot';
import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { HeroCard } from '@/components/ui/hero-card';
import { Icon } from '@/components/ui/icon';
import { ListRow, ListSection } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { TabHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import type { Workspace } from '@/features/cashflow/schema';
import { categoryVisual, featureVisual } from '@/features/categories/visual';
import type { useMyHousehold } from '@/features/household/api';
import { formatCalendarDate, dueState } from '@/features/payments/dates';
import { dueLabel } from '@/features/payments/ui';
import { useFormatters } from '@/hooks/use-formatters';
import { useTheme } from '@/hooks/use-theme';
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

/** Overview: one shared-budget summary, one timely attention message, next bills and recent shared activity. */
export function Dashboard({ household: data, workspace, activity, flowError, activityError,
  onRetryFlow, onRetryActivity, onRefresh, refreshing, invite }: DashboardProps) {
  const { t } = useTranslation();
  const { household, me, partner, members } = data;
  const format = useFormatters(household.timezone);
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const model = useMemo(() => workspace ? homeModel(workspace, members) : null, [workspace, members]);
  const money = (amount: number) => format.money(amount, household.baseCurrency);
  const displayDate = (on: string) => formatCalendarDate(on, locale);
  const month = workspace ? new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
    .format(new Date(`${workspace.today.slice(0, 7)}-15T12:00:00Z`)) : '';
  const names = partner ? t('banking.names', { first: me.displayName, second: partner.displayName }) : me.displayName;
  const usable = model && !flowError;
  const categoryFor = (id?: string) => workspace?.categories.find(category => category.id === id);
  const budgetTitle = t(me.budgetCompletedAt ? 'budget.review' : me.budgetSetupStep > 0 ? 'budget.resume' : 'budget.start');

  const pending = usable ? model.pending.map(item => {
    const dates = paymentWindow(item);
    return { item, dates, state: dueState(dates.dueStart, dates.dueEnd, workspace!.today), id: item.key.split(':')[1] };
  }) : [];
  const overdue = pending.find(entry => entry.state === 'overdue');
  const attention = !me.budgetCompletedAt ? { text: t('banking.overview.setup'), action: budgetTitle, onPress: () => router.push('/budget') }
    : overdue ? { text: t('banking.overview.overdue', { name: overdue.item.name }), action: t('dashboard.reviewPayment', { name: overdue.item.name }),
      onPress: () => router.push({ pathname: '/payment-detail', params: { id: overdue.id } }) }
    : usable && model.projection.low ? { text: t('banking.overview.low'), action: t('cashflow.title'), onPress: () => router.push('/cash-flow') }
    : usable && model.projection.gaps.length > 0 ? { text: t('dashboard.forecastGaps'), action: t('cashflow.title'), onPress: () => router.push('/cash-flow') }
    : null;

  return <Screen withTabBar withAction refreshing={refreshing} onRefresh={onRefresh}>
    <TabHeader title={t('navigation.overview')} subtitle={month ? t('banking.nameMonth', { names, month }) : names}
      trailing={{ kind: 'profile', initial: Array.from(me.displayName.trim())[0]?.toUpperCase() ?? '?', label: t('banking.profile'), onPress: () => router.push('/settings') }} />
    {!partner && invite}

    {usable && <GuideSlot target="home-summary" offer="first-visit" />}
    {usable ? <View style={styles.summary}>
      {model.progress !== null ? <HeroCard
        title={t(model.remaining < 0 ? 'banking.overview.overPlan' : 'banking.overview.remaining')}
        value={money(model.remaining < 0 ? -model.remaining : model.remaining)}
        subtitle={t('banking.overview.spentOf', { spent: money(model.spent), plan: money(model.plan) })}
        progress={model.progress} progressLabel={t('dashboard.progress')}
        progressSummary={t('dashboard.spentOfPlan', { spent: money(model.spent), plan: money(model.plan) })}
        warning={model.remaining < 0 ? t('dashboard.overPlan', { amount: money(-model.remaining) }) : undefined}
        link={{ label: t('banking.overview.viewBudget'), onPress: () => router.push('/shared-budget') }} />
        : <HeroCard title={t('banking.overview.spentNoPlan')} value={money(model.spent)} subtitle={t('banking.overview.noPlan')}
          link={{ label: t('banking.overview.viewBudget'), onPress: () => router.push('/shared-budget') }} />}
      <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>{t('banking.overview.notBank')}</ThemedText>
    </View> : <SectionState error={flowError} retry={onRetryFlow} message={flowError ? t('banking.overview.budgetUnavailable') : undefined} />}

    {attention && <Attention text={attention.text} action={attention.action} onPress={attention.onPress} />}

    <ListSection title={t('banking.overview.upcoming')} action={{ label: t('banking.seeAll'), accessibilityLabel: t('banking.seeAllBills'), onPress: () => router.push('/payments') }}>
      {usable ? <>
        {!pending.length && <Empty text={t('banking.overview.noUpcoming')} />}
        {pending.map(({ item, dates, state, id }, index) => {
          const category = categoryFor(workspace!.payments.find(payment => payment.id === id)?.category_id);
          return <ListRow key={item.key} title={item.name} visual={category ? categoryVisual(category) : featureVisual.bills}
            subtitle={t('banking.overview.unpaidState', { due: dueLabel(dates, locale), state: t(`payments.${state}`) }) + (item.corrected ? ` · ${t('cashflow.corrected')}` : '')}
            tone={state === 'overdue' ? 'attention' : 'default'} last={index === pending.length - 1}
            value={item.amount === null ? t('payments.unknownAmount') : money(item.amount)}
            accessibilityLabel={`${t('dashboard.reviewPayment', { name: item.name })}, ${item.amount === null ? t('payments.unknownAmount') : money(item.amount)}, ${t(`payments.${state}`)}`}
            onPress={() => router.push({ pathname: '/payment-detail', params: { id } })} />;
        })}
      </> : <SectionState error={flowError} retry={onRetryFlow} />}
    </ListSection>

    <ListSection title={t('banking.overview.recent')} action={{ label: t('banking.seeAll'), accessibilityLabel: t('banking.seeAllActivity'), onPress: () => router.push('/expenses') }}>
      {activity && !activityError ? <>
        {!activity.recent.length && <Empty text={t('banking.overview.noActivity')} />}
        {activity.recent.map((entry, index) => {
          const name = members.find(m => m.userId === entry.paid_by)?.displayName ?? t('common.unknown');
          const category = categoryFor(workspace?.transactions.find(transaction => transaction.id === entry.id)?.category_id);
          const title = entry.description || t('cashflow.transaction');
          return <ListRow key={entry.id} title={title} visual={category ? categoryVisual(category) : featureVisual.spending}
            subtitle={t(entry.amount_minor < 0 ? 'banking.overview.refundMeta' : 'banking.overview.activityMeta', { name, date: displayDate(entry.occurred_on) })}
            value={money(-entry.amount_minor)} last={index === activity.recent.length - 1}
            accessibilityLabel={`${title}, ${money(-entry.amount_minor)}, ${t('dashboard.activityBy', { name, date: displayDate(entry.occurred_on) })}`}
            accessibilityHint={t('conversation.open')}
            onPress={() => router.push({ pathname: '/expense-thread', params: { id: entry.id } })} />;
        })}
      </> : <SectionState error={activityError} retry={onRetryActivity} />}
    </ListSection>
  </Screen>;
}

function Attention({ text, action, onPress }: { text: string; action: string; onPress: () => void }) {
  const theme = useTheme();
  return <Pressable accessibilityRole="button" accessibilityLabel={`${text} ${action}`} onPress={onPress}
    style={({ pressed }) => [styles.attention, { backgroundColor: theme.backgroundElement, opacity: pressed ? 0.75 : 1 }]}>
    <Icon name="alert" color={theme.attention} size={20} />
    <View style={{ flex: 1, gap: 2 }}>
      <ThemedText type="small">{text}</ThemedText>
      <ThemedText type="smallBold" themeColor="accent">{action}</ThemedText>
    </View>
    <Icon name="chevronRight" color={theme.textSecondary} size={16} />
  </Pressable>;
}

function Empty({ text }: { text: string }) {
  return <ThemedText themeColor="textSecondary" style={styles.empty}>{text}</ThemedText>;
}

function SectionState({ error, retry, message }: { error: boolean; retry: () => unknown; message?: string }) {
  const { t } = useTranslation();
  return <View style={styles.state}>
    <ThemedText accessibilityRole={error ? 'alert' : undefined} themeColor={error ? 'attention' : 'textSecondary'}>
      {message ?? t(error ? 'dashboard.loadError' : 'dashboard.loading')}
    </ThemedText>
    {error && <Button title={t('common.tryAgain')} variant="secondary" onPress={retry} />}
  </View>;
}

const styles = StyleSheet.create({
  summary: { gap: Spacing.two },
  caption: { paddingHorizontal: Spacing.two },
  attention: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: Spacing.three, borderRadius: 12, minHeight: 48 },
  empty: { paddingVertical: Spacing.three },
  state: { gap: Spacing.two, paddingVertical: Spacing.three },
});
