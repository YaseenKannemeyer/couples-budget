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
it('shows the household plan, allowance aggregates, pending/paid payments and shared activity', async () => {
  const view = await show({ workspace: { ...cashflow, budgets: [{ id: 'b', name: 'Monthly plan', amount_minor: 50000, category_id: cashflow.categories[0].id, version: 1 }] } });
  expect(view.getByText('Our month · October 2026')).toBeTruthy();
  expect(view.getByRole('progressbar', { name: 'Shared monthly budget used' })).toBeTruthy();
  expect(view.getByText('$123.45')).toBeTruthy(); expect(view.getByText('$65.00')).toBeTruthy();
  expect(view.getByText('Internet')).toBeTruthy(); expect(view.getByText('Unpaid · Due soon')).toBeTruthy();
  expect(view.getByText('Paid · Oct 24, 2026')).toBeTruthy();
  expect(view.getByText('Our groceries')).toBeTruthy(); expect(view.getByText('Sam paid · Oct 24, 2026')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Review Internet' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/payment-detail', params: { id: cashflow.payments[0].id } });
});
it('keeps forecast and confirmed amounts separate and offers setup when no balance exists', async () => {
  const view = await show({ workspace: { ...cashflow, balance: null } });
  expect(view.getByText('Start with a confirmed shared closing balance to see a forecast.')).toBeTruthy();
  expect(view.queryByText('Confirmed balance from entries')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Our cash-flow calendar' }));
  expect(router.push).toHaveBeenCalledWith('/cash-flow');
});
it('shows fetch errors instead of zero balances and keeps successful sections usable', async () => {
  const retry = jest.fn();
  const view = await show({ activity: undefined, activityError: true, onRetryActivity: retry });
  expect(view.getAllByText('$0.00').length).toBeGreaterThan(0); // real zero plan, not a fabricated allowance
  expect(view.queryByText('$123.45')).toBeNull();
  expect(view.getByText('Internet')).toBeTruthy();
  await fireEvent.press(view.getAllByRole('button', { name: 'Try again' })[0]);
  expect(retry).toHaveBeenCalled();
});
it('shows provisional income and no progress bar for an empty plan', async () => {
  const view = await show({ household: { household, me, partner: null, members: [me] }, invite: <></> });
  expect(view.getByText('Monthly income entered so far')).toBeTruthy();
  expect(view.queryByRole('progressbar')).toBeNull();
});

it('keeps the refresh action named while it is busy', async () => {
  const view = await show({ refreshing: true });
  const button = view.getByRole('button', { name: 'Refresh Home' });
  expect(button.props.accessibilityState.busy).toBe(true);
});
