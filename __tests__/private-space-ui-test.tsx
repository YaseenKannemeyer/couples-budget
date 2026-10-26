import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { PrivateSpace, type PrivateSpaceProps } from '@/features/private-space/private-space-screen';
import { LocalizationProvider } from '@/i18n/provider';
import { household, me, partner, schedule, workspace } from '../test/fixtures/payments';
import { Palettes } from '@/constants/theme';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/private-space/api', () => ({ useOwnAllowance: jest.fn(), usePrivateSpaceRefresh: jest.fn() }));
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/features/expenses/api', () => ({ useExpenses: jest.fn() }));
jest.mock('@/features/payments/api', () => ({ usePaymentWorkspace: jest.fn() }));
jest.mock('@/hooks/use-session', () => ({ useSession: jest.fn() }));
jest.mock('@/hooks/use-color-scheme', () => ({ useColorScheme: () => 'light' }));
const entry = { id: 'e', description: 'My coffee', amountMinor: 2500, occurredOn: '2026-10-25', categoryId: schedule.categoryId,
  frequency: 'one_time' as const, scheduledPaymentRef: null, version: 1 };
const props: PrivateSpaceProps = { householdId: household.id, userId: me.userId, today: '2026-10-25', currency: 'USD', timezone: household.timezone,
  balance: { user_id: me.userId, allowance_minor: 30000, spent_minor: 2500, remaining_minor: 27500 },
  expenses: [entry], categories: workspace.categories,
  schedules: [{ ...schedule, name: 'My private bill', visibility: 'private' }, { ...schedule, name: 'Shared bill' },
    { ...schedule, id: 'p', name: 'Partner secret', ownerId: partner.userId, visibility: 'private' }],
  balanceError: false, expensesError: false, paymentsError: false, refreshing: false,
  onRetryBalance: jest.fn(), onRetryExpenses: jest.fn(), onRetryPayments: jest.fn(), onRefresh: jest.fn() };
const show = (patch: Partial<PrivateSpaceProps> = {}) => render(<LocalizationProvider><PrivateSpace {...props} {...patch} /></LocalizationProvider>);
beforeEach(() => jest.clearAllMocks());
it('shows own allowance, private payments and spending in the private theme', async () => {
  const view = await show();
  expect(view.getByText('$275.00')).toBeTruthy(); expect(view.getByText('My private bill')).toBeTruthy();
  expect(view.queryByText('Shared bill')).toBeNull(); expect(view.queryByText('Partner secret')).toBeNull();
  expect(view.getByText('My coffee')).toBeTruthy();
  expect(view.getByRole('header', { name: 'My private space' })).toHaveStyle({ color: Palettes.private.light.text });
});
it('keeps other sections usable after a balance failure and never shows cached balances as current', async () => {
  const view = await show({ balanceError: true });
  expect(view.queryByText('$275.00')).toBeNull(); expect(view.getByText('My coffee')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(props.onRetryBalance).toHaveBeenCalled();
});
it('opens spending, scheduled payments and new payments with explicit private context', async () => {
  const view = await show();
  for (const [name, pathname] of [['All my private spending', '/expenses'], ['All my private payments', '/payments'], ['Add a private payment', '/payment']]) {
    await fireEvent.press(view.getByRole('button', { name }));
    expect(router.push).toHaveBeenLastCalledWith({ pathname, params: { visibility: 'private' } });
  }
  await fireEvent.press(view.getByRole('button', { name: 'Review My coffee' }));
  expect(router.push).toHaveBeenLastCalledWith({ pathname: '/expense-category', params: { id: 'e', visibility: 'private' } });
});
it('labels refunds and future entries without recomputing the authoritative allowance', async () => {
  const view = await show({ expenses: [{ ...entry, amountMinor: -500, occurredOn: '2026-10-30' }] });
  expect(view.getByText('Refund')).toBeTruthy(); expect(view.getByText('Future-dated entry')).toBeTruthy();
  expect(view.getByText('$275.00')).toBeTruthy();
});
it('distinguishes empty data, loading, failed lists and a mismatched account balance', async () => {
  const view = await show({ balance: undefined, expenses: undefined, schedules: undefined });
  expect(view.queryByText('$0.00')).toBeNull(); expect(view.queryByText('No upcoming private payments in the next 90 days.')).toBeNull();
  await view.rerender(<LocalizationProvider><PrivateSpace {...props} balance={{ ...props.balance!, user_id: partner.userId }} expenses={[]} schedules={[]} /></LocalizationProvider>);
  expect(view.queryByText('$275.00')).toBeNull(); expect(view.getByRole('alert')).toBeTruthy();
  expect(view.getByText('No upcoming private payments in the next 90 days.')).toBeTruthy();
  await view.rerender(<LocalizationProvider><PrivateSpace {...props} expensesError paymentsError /></LocalizationProvider>);
  expect(view.queryByText('My coffee')).toBeNull(); expect(view.queryByText('My private bill')).toBeNull(); expect(view.getByText('$275.00')).toBeTruthy();
});
it('bounds the overview to ten expenses and five bills, with a named busy refresh action', async () => {
  const view = await show({ refreshing: true, expenses: Array.from({ length: 12 }, (_, i) => ({ ...entry, id: `e${i}`, description: `Expense ${i}` })),
    schedules: Array.from({ length: 7 }, (_, i) => ({ ...schedule, visibility: 'private', id: `s${i}`, name: `Bill ${i}` })) });
  expect(view.queryByText('Expense 10')).toBeNull(); expect(view.getByText('Expense 9')).toBeTruthy();
  expect(view.queryByText('Bill 5')).toBeNull(); expect(view.getByText('Bill 4')).toBeTruthy();
  expect(view.getByRole('button', { name: 'Refresh my private space' }).props.accessibilityState.busy).toBe(true);
});
