import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { SharedBudget, type SharedBudgetProps } from '@/features/shared-budget/shared-budget-screen';
import { LocalizationProvider } from '@/i18n/provider';
import { cashflow } from '../test/fixtures/cashflow';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/shared-budget/api', () => ({ useSharedBudget: jest.fn() }));
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/features/payments/api', () => ({ usePaymentWorkspace: jest.fn() }));
const category = cashflow.categories[0];
const props: SharedBudgetProps = { workspace: { ...cashflow,
  budgets: [{ id: 'b', name: 'Our internet', amount_minor: 10000, category_id: category.id, version: 1 }],
  transactions: [{ id: 'e', name: 'Router', amount_minor: 2500, category_id: category.id, on_date: cashflow.today }] },
  currency: 'USD', timezone: 'Africa/Johannesburg', error: false, refreshing: false, onRefresh: jest.fn() };
const show = (patch: Partial<SharedBudgetProps> = {}) => render(<LocalizationProvider><SharedBudget {...props} {...patch} /></LocalizationProvider>);
beforeEach(() => jest.clearAllMocks());
it('shows category remaining, the household month and upcoming shared payment windows', async () => {
  const view = await show();
  expect(view.getByText('October 2026')).toBeTruthy();
  expect(view.getByRole('header', { name: 'Utilities' })).toBeTruthy(); expect(view.getAllByText('$75.00')).toHaveLength(3);
  expect(view.getByText('Unpaid · Due soon')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Review Internet' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/payment-detail', params: { id: cashflow.payments[0].id } });
});
it('keeps unassigned costs visible and opens the allocation page', async () => {
  const view = await show({ workspace: { ...props.workspace!, budgets: [{ ...props.workspace!.budgets[0], category_id: null }] } });
  expect(view.getByText('Plan still to assign')).toBeTruthy();
  expect(view.getByText('Our internet')).toBeTruthy();
  expect(view.getByText('No plan assigned to this category yet.')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Assign planned costs' }));
  expect(router.push).toHaveBeenCalledWith('/budget-categories');
});
it('offers recovery without displaying cached money as current after a refresh failure', async () => {
  const view = await show({ error: true });
  expect(view.queryByText('$75.00')).toBeNull(); expect(view.queryByText('Utilities')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(props.onRefresh).toHaveBeenCalled();
});
it('distinguishes loading, empty plans and unknown variable amounts', async () => {
  const view = await show({ workspace: undefined });
  expect(view.queryByText('$0.00')).toBeNull();
  await view.rerender(<LocalizationProvider><SharedBudget {...props} workspace={{ ...cashflow, payments: [{ ...cashflow.payments[0], estimate_minor: null }] }} /></LocalizationProvider>);
  expect(view.getByText('No monthly plan yet')).toBeTruthy();
  expect(view.getByText('No plan assigned to this category yet.')).toBeTruthy();
  expect(view.queryByText('Assigned plan')).toBeNull();
});
it('uses a named busy refresh action and preserves explicit shared expense navigation', async () => {
  const view = await show({ refreshing: true });
  expect(view.getByRole('button', { name: 'Refresh shared budget' }).props.accessibilityState.busy).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Review expenses' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/expenses', params: { visibility: 'shared' } });
});
it('shows overspending in calm language and fails closed on unsafe totals', async () => {
  const view = await show({ workspace: { ...props.workspace!, budgets: [{ ...props.workspace!.budgets[0], amount_minor: 1000 }] } });
  expect(view.getByText('We’re $15.00 above this category’s plan.')).toBeTruthy();
  await view.rerender(<LocalizationProvider><SharedBudget {...props} workspace={{ ...cashflow, budgets: [
    { ...props.workspace!.budgets[0], amount_minor: Number.MAX_SAFE_INTEGER }, props.workspace!.budgets[0]] }} /></LocalizationProvider>);
  expect(view.getByRole('alert')).toBeTruthy(); expect(view.queryByText('Assigned plan')).toBeNull();
});
