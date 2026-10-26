import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { Spacing } from '@/constants/theme';
import { categoryLabel, type Category } from '@/features/categories/schema';
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
  const ownBalance = balance?.user_id === userId ? balance : undefined;
  return <Screen withTabBar>
    {Platform.OS === 'web' && <View style={styles.webTabSpacer} />}
    <View style={styles.section}>
      <ThemedText type="subtitle" accessibilityRole="header">{t('privateSpace.title')}</ThemedText>
      <ThemedText themeColor="textSecondary">{month}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('privateSpace.privacy')}</ThemedText>
    </View>
    <Card>
      <ThemedText type="smallBold" accessibilityRole="header">{t('privateSpace.allowance')}</ThemedText>
      {ownBalance && !balanceError ? <>
        <SummaryRow label={t('privateSpace.monthlyAllowance')} value={money(ownBalance.allowance_minor)} />
        <SummaryRow label={t('privateSpace.spent')} value={money(ownBalance.spent_minor)} />
        <SummaryRow label={t('privateSpace.remaining')} value={money(ownBalance.remaining_minor)} />
        {ownBalance.remaining_minor < 0 && <ThemedText themeColor="attention">{t('privateSpace.over', { amount: money(-ownBalance.remaining_minor) })}</ThemedText>}
        <ThemedText type="small" themeColor="textSecondary">{t('privateSpace.balanceHint')}</ThemedText>
      </> : <SectionState error={balanceError || (!!balance && !ownBalance)} retry={onRetryBalance} />}
      <Button title={t('privateSpace.reviewAllowance')} variant="secondary" onPress={() => router.push('/(onboarding)/budget')} />
    </Card>
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">{t('privateSpace.payments')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('privateSpace.paymentHint')}</ThemedText>
      {schedules && !paymentsError ? <>
        {!pending.length && <ThemedText themeColor="textSecondary">{t('privateSpace.noPayments')}</ThemedText>}
        {pending.map(payment => {
          const state = dueState(payment.dueStart, payment.dueEnd, today);
          return <View key={payment.id} style={[styles.entry, { borderBottomColor: theme.border }]}>
            <SummaryRow label={payment.name} value={payment.estimateMinor === null ? t('payments.unknownAmount') :
              t(payment.expectedAmountMinor === null ? 'payments.estimatedValue' : 'payments.expectedValue', { amount: money(payment.estimateMinor) })} />
            <ThemedText themeColor="textSecondary">{dueLabel(payment, locale)}</ThemedText>
            <ThemedText type="small" themeColor={state === 'overdue' ? 'attention' : 'textSecondary'}>{t(`payments.${state}`)}</ThemedText>
            <Button title={t('privateSpace.reviewPayment', { name: payment.name })} variant="ghost"
              onPress={() => router.push({ pathname: '/payment-detail', params: { id: payment.id } })} />
          </View>;
        })}
      </> : <SectionState error={paymentsError} retry={onRetryPayments} />}
      <Button title={t('privateSpace.allPayments')} variant="secondary" onPress={() => router.push({ pathname: '/payments', params: { visibility: 'private' } })} />
      <Button title={t('privateSpace.addPayment')} variant="ghost" onPress={() => router.push({ pathname: '/payment', params: { visibility: 'private' } })} />
    </View>
    <View style={styles.section}>
      <ThemedText type="smallBold" accessibilityRole="header">{t('privateSpace.spending')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t('privateSpace.spendingHint')}</ThemedText>
      {expenses && !expensesError ? <>
        {!expenses.length && <ThemedText themeColor="textSecondary">{t('privateSpace.noExpenses')}</ThemedText>}
        {expenses.slice(0, 10).map(expense => {
          const category = !paymentsError && categories?.find(c => c.id === expense.categoryId &&
            (c.visibility === 'shared' || c.ownerId === userId));
          return <View key={expense.id} style={[styles.entry, { borderBottomColor: theme.border }]}>
            <SummaryRow label={expense.description || t('expenses.untitled')} value={money(expense.amountMinor)} />
            <ThemedText type="small" themeColor="textSecondary">{formatCalendarDate(expense.occurredOn, locale)} · {t(`payments.${expense.frequency}`)}</ThemedText>
            {!!category && <ThemedText type="small" themeColor="textSecondary">{categoryLabel(category)}</ThemedText>}
            {expense.amountMinor < 0 && <ThemedText type="small" themeColor="success">{t('dashboard.refund')}</ThemedText>}
            {expense.occurredOn > today && <ThemedText type="small" themeColor="textSecondary">{t('privateSpace.future')}</ThemedText>}
            <Button title={t('privateSpace.reviewExpense', { name: expense.description || t('expenses.untitled') })} variant="ghost"
              onPress={() => router.push({ pathname: '/expense-category', params: { id: expense.id, visibility: 'private' } })} />
          </View>;
        })}
      </> : <SectionState error={expensesError} retry={onRetryExpenses} />}
      <Button title={t('privateSpace.allExpenses')} variant="secondary" onPress={() => router.push({ pathname: '/expenses', params: { visibility: 'private' } })} />
    </View>
    <Button title={t('privateSpace.refresh')} accessibilityLabel={t('privateSpace.refresh')} variant="ghost" loading={refreshing} onPress={onRefresh} />
  </Screen>;
}
function SectionState({ error, retry }: { error: boolean; retry: () => unknown }) {
  const { t } = useTranslation();
  return <View style={styles.section}>
    <ThemedText accessibilityRole={error ? 'alert' : undefined} themeColor={error ? 'attention' : 'textSecondary'}>
      {t(error ? 'privateSpace.loadError' : 'dashboard.loading')}
    </ThemedText>
    {error && <Button title={t('common.tryAgain')} variant="secondary" onPress={retry} />}
  </View>;
}
const styles = StyleSheet.create({
  webTabSpacer: { height: Spacing.six },
  section: { gap: Spacing.three },
  entry: { gap: Spacing.two, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
});
