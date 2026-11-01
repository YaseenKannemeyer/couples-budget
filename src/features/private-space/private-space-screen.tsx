import { Disclosure } from '@/components/ui/disclosure';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { AnimatedAmount } from '@/components/ui/animated-amount';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { GroupGap, ListRow, ListSection } from '@/components/ui/list-row';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { TabHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import type { Category } from '@/features/categories/schema';
import { categoryVisual, featureVisual } from '@/features/categories/visual';
import { useExpenses } from '@/features/expenses/api';
import type { Expense } from '@/features/expenses/schema';
import { useMyHousehold } from '@/features/household/api';
import { usePaymentWorkspace } from '@/features/payments/api';
import { dueState, formatCalendarDate, useHouseholdToday } from '@/features/payments/dates';
import type { Schedule } from '@/features/payments/schema';
import { dueLabel } from '@/features/payments/ui';
import { useFormatters } from '@/hooks/use-formatters';
import { useSession } from '@/hooks/use-session';
import { SpaceContext, useTheme } from '@/hooks/use-theme';
import { useOwnAllowance, usePrivateSpaceRefresh } from './api';
import { privateUpcoming, type OwnAllowance } from './data';

export function PrivateSpaceScreen() {
  const { session } = useSession();
  const household = useMyHousehold();
  const h = household.data?.household;
  const today = useHouseholdToday(h?.timezone ?? 'UTC');
  const balance = useOwnAllowance(h?.id, today);
  const expenses = useExpenses(h?.id, 'private');
  const payments = usePaymentWorkspace(h?.id);
  usePrivateSpaceRefresh(h?.id);
  return <PrivateSpace householdId={h?.id ?? ''} userId={session?.user.id ?? ''} today={today}
    currency={h?.baseCurrency ?? 'USD'} timezone={h?.timezone ?? 'UTC'} balance={balance.data}
    expenses={expenses.data?.pages[0]} schedules={payments.data?.schedules} categories={payments.data?.categories}
    balanceError={household.isError || balance.isError} expensesError={household.isError || expenses.isError}
    paymentsError={household.isError || payments.isError} refreshing={balance.isFetching || expenses.isFetching || payments.isFetching}
    onRetryBalance={() => { void household.refetch(); void balance.refetch(); }}
    onRetryExpenses={() => { void household.refetch(); void expenses.refetch(); }}
    onRetryPayments={() => { void household.refetch(); void payments.refetch(); }}
    onRefresh={() => { void household.refetch(); void balance.refetch(); void expenses.refetch(); void payments.refetch(); }} />;
}

export type PrivateSpaceProps = {
  householdId: string; userId: string; today: string; currency: string; timezone: string;
  balance?: OwnAllowance; expenses?: Expense[]; schedules?: Schedule[]; categories?: Category[];
  balanceError: boolean; expensesError: boolean; paymentsError: boolean; refreshing: boolean;
  onRetryBalance: () => unknown; onRetryExpenses: () => unknown; onRetryPayments: () => unknown; onRefresh: () => unknown;
};

export function PrivateSpace(props: PrivateSpaceProps) {
  return <SpaceContext value="private"><PrivateDesk {...props} /></SpaceContext>;
}
function PrivateDesk({ householdId, userId, today, currency, timezone, balance, expenses, schedules, categories,
  balanceError, expensesError, paymentsError, refreshing, onRetryBalance, onRetryExpenses, onRetryPayments, onRefresh }: PrivateSpaceProps) {
  const { t } = useTranslation();
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const format = useFormatters(timezone);
  const theme = useTheme();
  const money = (amount: number) => format.money(amount, currency);
  const pending = privateUpcoming(schedules ?? [], householdId, userId, today).slice(0, 5);
  const month = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${today.slice(0, 7)}-15T12:00:00Z`));
  // Owner filter stays explicit: a cached row for another account never renders here.
  const ownBalance = balance?.user_id === userId ? balance : undefined;
  const categoryFor = (id: string | null) => !paymentsError ? categories?.find(c => c.id === id && (c.visibility === 'shared' || c.ownerId === userId)) : undefined;
  return <Screen withTabBar withAction refreshing={refreshing} onRefresh={onRefresh}>
    <TabHeader title={t('banking.personal.title')} subtitle={month}
      trailing={{ kind: 'icon', icon: 'settings', label: t('banking.settings.title'), onPress: () => router.push('/settings') }} />
    {ownBalance && !balanceError && <GuideSlot target="private-summary" offer="private-allowance" />}
    {ownBalance && !balanceError ? <View accessible accessibilityLabel={[t('banking.personal.yourAllowance'), money(ownBalance.remaining_minor),
      ownBalance.remaining_minor < 0 ? t('banking.personal.overBy', { amount: money(-ownBalance.remaining_minor) })
        : t('banking.personal.remainingOf', { allowance: money(ownBalance.allowance_minor) })].join(', ')} style={styles.allowance}>
      <View style={styles.allowanceLabel}><Icon name="lock" color={theme.heading} size={20} />
        <ThemedText type="section" accessibilityRole="header">{t('banking.personal.yourAllowance')}</ThemedText></View>
      <AnimatedAmount type="amount" style={styles.centred}>{money(ownBalance.remaining_minor)}</AnimatedAmount>
      {ownBalance.remaining_minor < 0
        ? <ThemedText accessibilityRole="alert" themeColor="attention" style={styles.centred}>{t('banking.personal.overBy', { amount: money(-ownBalance.remaining_minor) })}</ThemedText>
        : <ThemedText themeColor="textSecondary" style={styles.centred}>{t('banking.personal.remainingOf', { allowance: money(ownBalance.allowance_minor) })}</ThemedText>}
      {ownBalance.allowance_minor > 0 && <ProgressBar value={ownBalance.spent_minor / ownBalance.allowance_minor * 100} label={t('design.allowanceUsed')}
        warning={ownBalance.remaining_minor < 0}
        summary={t('design.allowanceSummary', { spent: money(ownBalance.spent_minor), allowance: money(ownBalance.allowance_minor) })} />}
    </View> : <SectionState error={balanceError || (!!balance && !ownBalance)} retry={onRetryBalance} message={t('banking.personal.unavailable')} />}
    <View style={[styles.privacy, { borderTopColor: theme.border }]}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{t('banking.personal.privacy1')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{t('banking.personal.privacy2')}</ThemedText>
    </View>
    <Disclosure title={t('phase18.balanceDetails')}><ThemedText type="small" themeColor="textSecondary">{t('privateSpace.balanceHint')}</ThemedText></Disclosure>

    <ListSection title={t('banking.personal.transactions')} action={{ label: t('banking.seeAll'), accessibilityLabel: t('privateSpace.allExpenses'),
      onPress: () => router.push({ pathname: '/expenses', params: { visibility: 'private' } }) }}>
      {expenses && !expensesError ? <>
        {!expenses.length && <ThemedText themeColor="textSecondary" style={styles.empty}>{t('privateSpace.noExpenses')}</ThemedText>}
        {expenses.slice(0, 10).map((expense, index, list) => {
          const category = categoryFor(expense.categoryId);
          const title = expense.description || t('expenses.untitled');
          const meta = [formatCalendarDate(expense.occurredOn, locale), category?.name, expense.frequency === 'monthly' ? t('payments.monthly') : null,
            expense.amountMinor < 0 ? t('dashboard.refund') : null, expense.occurredOn > today ? t('banking.personal.future') : null].filter(Boolean).join(' · ');
          return <ListRow key={expense.id} title={title} subtitle={meta} value={money(-expense.amountMinor)}
            visual={category ? categoryVisual(category) : featureVisual.spending} last={index === list.length - 1}
            accessibilityLabel={`${t('privateSpace.reviewExpense', { name: title })}, ${money(-expense.amountMinor)}, ${meta}`}
            onPress={() => router.push({ pathname: '/expense-category', params: { id: expense.id, visibility: 'private' } })} />;
        })}
      </> : <SectionState error={expensesError} retry={onRetryExpenses} />}
    </ListSection>

    <ListSection title={t('banking.personal.bills')} action={{ label: t('banking.seeAll'), accessibilityLabel: t('privateSpace.allPayments'),
      onPress: () => router.push({ pathname: '/payments', params: { visibility: 'private' } }) }}>
      {schedules && !paymentsError ? <>
        {!pending.length && <ThemedText themeColor="textSecondary" style={styles.empty}>{t('privateSpace.noPayments')}</ThemedText>}
        {pending.map(payment => {
          const state = dueState(payment.dueStart, payment.dueEnd, today);
          const amount = payment.estimateMinor === null ? t('payments.unknownAmount') :
            t(payment.expectedAmountMinor === null ? 'payments.estimatedValue' : 'payments.expectedValue', { amount: money(payment.estimateMinor) });
          const category = categoryFor(payment.categoryId);
          return <ListRow key={payment.id} title={payment.name} value={amount} visual={category ? categoryVisual(category) : featureVisual.bills}
            subtitle={`${dueLabel(payment, locale)} · ${t(`payments.${state}`)}`} tone={state === 'overdue' ? 'attention' : 'default'}
            accessibilityLabel={`${t('privateSpace.reviewPayment', { name: payment.name })}, ${amount}, ${t(`payments.${state}`)}`}
            onPress={() => router.push({ pathname: '/payment-detail', params: { id: payment.id } })} />;
        })}
      </> : <SectionState error={paymentsError} retry={onRetryPayments} />}
      <ListRow title={t('banking.personal.addBill')} visual={featureVisual.bills} last
        onPress={() => router.push({ pathname: '/payment', params: { visibility: 'private' } })} />
    </ListSection>

    <GroupGap />
    <View>
      <ListRow title={t('banking.personal.income')} subtitle={t('banking.personal.incomeHint')} visual={featureVisual.income} onPress={() => router.push('/income')} />
      <ListRow title={t('banking.personal.allowanceReview')} subtitle={t('privateSpace.reviewAllowance')} visual={featureVisual.allowance} last
        onPress={() => router.push('/budget')} />
    </View>
  </Screen>;
}
function SectionState({ error, retry, message }: { error: boolean; retry: () => unknown; message?: string }) {
  const { t } = useTranslation();
  return <View style={styles.state}>
    <ThemedText accessibilityRole={error ? 'alert' : undefined} themeColor={error ? 'attention' : 'textSecondary'}>
      {error ? message ?? t('privateSpace.loadError') : t('dashboard.loading')}
    </ThemedText>
    {error && <Button title={t('common.tryAgain')} variant="secondary" onPress={retry} />}
  </View>;
}
const styles = StyleSheet.create({
  allowance: { alignItems: 'stretch', gap: Spacing.two, paddingVertical: Spacing.two },
  allowanceLabel: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two },
  centred: { textAlign: 'center' },
  privacy: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.three, gap: 2 },
  empty: { paddingVertical: Spacing.three },
  state: { gap: Spacing.two, paddingVertical: Spacing.three },
});
