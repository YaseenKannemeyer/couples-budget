/** Local design-review entry. Synthetic fixtures only; never an application route. */
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '../src/i18n/provider';
import { DisplayFontContext } from '../src/components/ui/font-context';
import { ThemeSchemeContext } from '../src/hooks/use-theme';
import { Dashboard } from '../src/features/dashboard/dashboard';
import { SharedBudget } from '../src/features/shared-budget/shared-budget-screen';
import { PrivateSpace } from '../src/features/private-space/private-space-screen';
import { CashflowCalendar } from '../src/features/cashflow/cashflow-screen';
import { household, me, partner, workspace, schedule } from '../test/fixtures/payments';
import { cashflow } from '../test/fixtures/cashflow';
import SettingsScreen from '../src/app/(tabs)/settings';
import { PaymentsScreen } from '../src/features/payments/payments-screen';
import { PaymentHistoryScreen } from '../src/features/payments/payment-history';
import { ExpensesScreen } from '../src/features/expenses/expenses-screen';
import { IncomeScreen } from '../src/features/cashflow/income-screens';
import SignInScreen from '../src/app/(auth)/sign-in';
import SetupScreen from '../src/app/setup';
import HouseholdScreen from '../src/app/(onboarding)/household';
import OfflineScreen from '../src/app/offline';
import { BudgetWizard } from '../src/features/budget/budget-wizard';
import { PaymentEditor } from '../src/features/payments/payment-editor';
import { PaymentPaid } from '../src/features/payments/payment-paid';
import { CategoriesView } from '../src/features/categories/categories-screen';
import { CategoryEditor } from '../src/features/categories/category-editor';
import { ExpenseClassification } from '../src/features/expenses/expense-classification';
import { IncomeEntry } from '../src/features/cashflow/income-screens';
import { QuickLogEntry, QuickLogForm } from '../src/features/quick-log/quick-log-screen';
import { PendingLogs } from '../src/features/quick-log/pending-screen';
import { Conversation } from '../src/features/conversation/conversation-screen';
import { Screen } from '../src/components/ui/screen';
import { BudgetLink } from '../src/features/cashflow/plan-screens';

const noop = () => {};
const asyncNoop = async () => {};
const expense = { id: '00000000-0000-4000-8000-000000000090', description: 'Our groceries', amountMinor: 73500, occurredOn: '2026-10-25', categoryId: schedule.categoryId, frequency: 'one_time' as const, scheduledPaymentRef: null, version: 1 };
const previewNames = ['home','shared','private','cashflow','sign-in','setup','household','budget','payment','payment-paid','categories','category','classification','income-entry','quick-log-choice','quick-log','pending','conversation','budget-link','offline','settings','payments','payment-history','expenses','income'];
const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
// Disabled anonymous query keys receive synthetic data; no auth provider or sync engine is mounted.
client.setQueryData(['household', undefined], { household, me, partner, members: [me,partner] });
client.setQueryData(['payments', household.id, undefined], workspace);
client.setQueryData(['categories', household.id, undefined], workspace.categories);
client.setQueryData(['expenses', household.id, undefined, 'shared'], { pages: [[expense]], pageParams: [0] });
client.setQueryData(['expenses', household.id, undefined, 'private'], { pages: [[expense]], pageParams: [0] });
client.setQueryData(['own-income', household.id, undefined], { sources: [], occurrences: [] });
client.setQueryData(['payment-history', household.id, undefined, undefined], { pages: [[{
 id: 'history', name: 'Internet', amountMinor: 7500, paidOn: '2026-10-15', dueStart: '2026-10-14', dueEnd: '2026-10-16',
 visibility: 'shared', categoryName: 'Utilities', payerId: me.userId, note: null, transactionId: null, scheduleId: schedule.id,
}]], pageParams: [0] });
const data = { ...cashflow, budgets: [{ id: 'demo-budget', name: 'Our plan', amount_minor: 180000, category_id: workspace.categories[0].id, version: 1 }],
  transactions: [{ id: 'demo-entry', amount_minor: 73500, on_date: '2026-10-22', category_id: workspace.categories[0].id, scheduled_payment_ref: null, description: 'Groceries' }] };
const activity = { allowances: [{ user_id: me.userId, display_name: me.displayName, remaining_minor: 27500 }, { user_id: partner.userId, display_name: partner.displayName, remaining_minor: 16500 }],
  paid: [{ id: 'demo-paid', name: 'Water', amount_minor: 4200, paid_on: '2026-10-24', due_start: '2026-10-24', due_end: '2026-10-24', schedule_ref: 's' }], recent: [] };
function Preview() {
  const query = new URLSearchParams(window.location.search);
  const [screen, setScreen] = useState(query.get('screen') ?? 'home');
  const [dark, setDark] = useState(query.get('theme') === 'dark');
  const [loaded, error] = useFonts({ Manrope: { uri: 'http://localhost:8090/Manrope.ttf' } });
  if (!loaded && !error) return null;
  return <SafeAreaProvider><QueryClientProvider client={client}><LocalizationProvider><DisplayFontContext value={loaded}>
    <ThemeSchemeContext value={dark ? 'dark' : 'light'}><View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', padding: 8, gap: 8, backgroundColor: dark ? '#202538' : '#E9ECFF' }}>
        <Text style={{ color: dark ? 'white' : '#191B24' }}>Synthetic preview · {loaded ? 'Manrope loaded' : error?.message ?? 'Loading font'}</Text>
        <select aria-label="Preview screen" value={screen} onChange={event => setScreen(event.target.value)}>{previewNames.map(name => <option key={name} value={name}>{name}</option>)}</select>
        <Pressable onPress={() => setDark(!dark)} style={{ padding: 4 }}><Text style={{ color: dark ? 'white' : '#191B24' }}>{dark ? 'Light' : 'Dark'}</Text></Pressable>
      </View>
      {screen === 'settings' && <SettingsScreen />}
      {screen === 'payments' && <PaymentsScreen />}
      {screen === 'payment-history' && <PaymentHistoryScreen />}
      {screen === 'expenses' && <ExpensesScreen />}
      {screen === 'income' && <IncomeScreen />}
      {screen === 'sign-in' && <SignInScreen />}
      {screen === 'setup' && <SetupScreen />}
      {screen === 'household' && <HouseholdScreen />}
      {screen === 'offline' && <OfflineScreen />}
      {screen === 'budget' && <BudgetWizard data={{ household, me, partner, members: [me,partner], costs: [], sources: [] }} onReload={asyncNoop} reloading={false} />}
      {screen === 'payment' && <PaymentEditor initial={schedule} household={household} me={me} members={[me,partner]} workspace={workspace} reload={asyncNoop} />}
      {screen === 'payment-paid' && <PaymentPaid initial={schedule} household={household} members={[me,partner]} reload={asyncNoop} />}
      {screen === 'categories' && <CategoriesView householdId={household.id} categories={workspace.categories} reload={noop} />}
      {screen === 'category' && <CategoryEditor householdId={household.id} userId={me.userId} categories={workspace.categories} initial={workspace.categories[0]} reload={asyncNoop} />}
      {screen === 'classification' && <ExpenseClassification initial={expense} householdId={household.id} userId={me.userId} space="shared" categories={workspace.categories} reload={asyncNoop} />}
      {screen === 'income-entry' && <IncomeEntry householdId={household.id} currency="USD" timezone="UTC" today="2026-10-25" />}
      {screen === 'quick-log-choice' && <QuickLogEntry household={household} me={me} members={[me,partner]} workspace={workspace} />}
      {screen === 'quick-log' && <QuickLogForm household={household} me={me} members={[me,partner]} workspace={workspace} space="shared" cached={false} onChooseSpace={noop} />}
      {screen === 'pending' && <PendingLogs householdId={household.id} currency="USD" />}
      {screen === 'conversation' && <Conversation expense={expense} userId={me.userId} householdId={household.id} members={[me,partner]} currency="USD" timezone="UTC" comments={[]} reactions={[]} commentsError={false} reactionsError={false} parentError={false} onAction={asyncNoop} onRefresh={noop} hasOlder={false} loadingOlder={false} onOlder={noop} />}
      {screen === 'budget-link' && <Screen><BudgetLink data={data} householdId={household.id} currency="USD" timezone="UTC" budget={data.budgets[0]} /></Screen>}
      {screen === 'home' && <Dashboard household={{ household, me, partner, members: [me,partner] }} workspace={data} activity={activity}
        flowError={false} activityError={false} onRetryFlow={noop} onRetryActivity={noop} onRefresh={noop} refreshing={false} />}
      {screen === 'shared' && <SharedBudget workspace={data} currency="USD" timezone="UTC" error={false} refreshing={false} onRefresh={noop} />}
      {screen === 'private' && <PrivateSpace householdId={household.id} userId={me.userId} today={data.today} currency="USD" timezone="UTC"
        balance={{ user_id: me.userId, allowance_minor: 30000, spent_minor: 2500, remaining_minor: 27500 }}
        expenses={[{ id: 'e', description: 'My coffee', amountMinor: 2500, occurredOn: data.today, categoryId: schedule.categoryId, frequency: 'one_time', scheduledPaymentRef: null, version: 1 }]}
        categories={workspace.categories} schedules={[{ ...schedule, name: 'My private bill', visibility: 'private' }]}
        balanceError={false} expensesError={false} paymentsError={false} refreshing={false} onRetryBalance={noop} onRetryExpenses={noop} onRetryPayments={noop} onRefresh={noop} />}
      {screen === 'cashflow' && <CashflowCalendar data={data} currency="USD" timezone="UTC" onRefresh={noop} />}
    </View></ThemeSchemeContext>
  </DisplayFontContext></LocalizationProvider></QueryClientProvider></SafeAreaProvider>;
}
registerRootComponent(Preview);
