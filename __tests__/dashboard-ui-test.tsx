import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { cashflow } from '../test/fixtures/cashflow';
import { household, me, partner } from '../test/fixtures/payments';
import { Dashboard, type DashboardProps } from '@/features/dashboard/dashboard';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/payments/api', () => ({ usePaymentWorkspace: jest.fn() }));
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));

const props: DashboardProps = {
  household: { household, me, partner, members: [me, partner] }, workspace: cashflow,
  activity: { allowances: [{ user_id: me.userId, display_name: 'Alex', remaining_minor: 12345 }, { user_id: partner.userId, display_name: 'Sam', remaining_minor: 6500 }],
    recent: [{ id: 'entry', description: 'Our groceries', amount_minor: 2500, occurred_on: '2026-10-24', created_at: '2026-10-25T08:00:00Z', paid_by: partner.userId }],
    paid: [{ id: 'record', name: 'Water', amount_minor: 4200, paid_on: '2026-10-24', due_start: '2026-10-24', due_end: '2026-10-24', schedule_ref: 's' }] },
  flowError: false, activityError: false, onRetryFlow: jest.fn(), onRetryActivity: jest.fn(), onRefresh: jest.fn(), refreshing: false,
};
const show = (patch: Partial<DashboardProps> = {}) => render(<LocalizationProvider><Dashboard {...props} {...patch} /></LocalizationProvider>);
beforeEach(() => jest.clearAllMocks());
it('leads with shared budget remaining, labels it as an estimate and lists next bills and shared activity', async () => {
  const view = await show({ workspace: { ...cashflow, budgets: [{ id: 'b', name: 'Monthly plan', amount_minor: 50000, category_id: cashflow.categories[0].id, version: 1 }] } });
  expect(view.getByText('Overview')).toBeTruthy(); expect(view.getByText(/· October$/)).toBeTruthy();
  expect(view.getByRole('header', { name: 'Shared budget remaining' })).toBeTruthy();
  expect(view.getByText('Budget estimate · Not your bank balance')).toBeTruthy();
  expect(view.getByRole('progressbar', { name: 'Shared monthly budget used' })).toBeTruthy();
  expect(view.getByText('Internet')).toBeTruthy(); expect(view.getByText(/Unpaid · Due soon|Due soon/)).toBeTruthy();
  expect(view.getByText('Our groceries')).toBeTruthy(); expect(view.getByText('Sam · Oct 24, 2026')).toBeTruthy();
  // Partner allowance aggregates and paid history live in Plan and Bills, not on Overview.
  expect(view.queryByText('$123.45')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: /^Review Internet/ }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/payment-detail', params: { id: cashflow.payments[0].id } });
  await fireEvent.press(view.getByRole('link', { name: 'View budget' }));
  expect(router.push).toHaveBeenCalledWith('/shared-budget');
  await fireEvent.press(view.getByRole('button', { name: /^Our groceries, .*Sam paid/ }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/expense-thread', params: { id: 'entry' } });
});
it('opens Settings from the profile button and keeps See all links named', async () => {
  const view = await show();
  await fireEvent.press(view.getByRole('button', { name: 'Profile and settings' }));
  expect(router.push).toHaveBeenCalledWith('/settings');
  await fireEvent.press(view.getByRole('link', { name: 'See all bills' }));
  expect(router.push).toHaveBeenCalledWith('/payments');
  await fireEvent.press(view.getByRole('link', { name: 'See all shared activity' }));
  expect(router.push).toHaveBeenCalledWith('/expenses');
});
it('states over-plan spending explicitly instead of relying on colour', async () => {
  const view = await show({ workspace: { ...cashflow, budgets: [{ id: 'b', name: 'Small plan', amount_minor: 100, category_id: null, version: 1 }],
    transactions: [{ id: 'e', name: 'Router', amount_minor: 2500, category_id: cashflow.categories[0].id, on_date: cashflow.today }] } });
  expect(view.getByRole('header', { name: 'Over shared plan' })).toBeTruthy();
  expect(view.getByText(/\$24\.00 above this month’s plan/)).toBeTruthy();
});
it('shows fetch errors instead of zero balances and keeps successful sections usable', async () => {
  const retry = jest.fn();
  const view = await show({ activity: undefined, activityError: true, onRetryActivity: retry });
  expect(view.getByText('Internet')).toBeTruthy();
  await fireEvent.press(view.getAllByRole('button', { name: 'Try again' })[0]);
  expect(retry).toHaveBeenCalled();
  const failed = await show({ workspace: undefined, flowError: true });
  expect(failed.getByText(/It isn’t zero/)).toBeTruthy();
  expect(failed.queryByRole('header', { name: 'Shared budget remaining' })).toBeNull();
});
it('shows spending without a progress bar for an empty plan and offers one attention message', async () => {
  const view = await show({ household: { household, me: { ...me, budgetCompletedAt: null }, partner: null, members: [me] }, invite: <></> });
  expect(view.getByRole('header', { name: 'Shared spending this month' })).toBeTruthy();
  expect(view.queryByRole('progressbar')).toBeNull();
  expect(view.getAllByText('Finish your budget setup to see what remains each month.')).toHaveLength(1);
});

it('leaves refreshing to pull-to-refresh instead of a bottom button', async () => {
  const view = await show({ refreshing: true });
  expect(view.queryByRole('button', { name: 'Refresh Home' })).toBeNull();
});
