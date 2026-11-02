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
const second = { ...category, id: '22222222-2222-4222-8222-222222222222', name: 'Groceries', sortOrder: 9, starterKey: null, emoji: null };
it('shows the wheel, category rows with plan/remaining and the shared month', async () => {
  const view = await show();
  expect(view.getByText('Shared · October 2026')).toBeTruthy();
  expect(view.getByRole('image', { name: /Utilities \$25\.00.*Total \$25\.00/ })).toBeTruthy();
  expect(view.getByRole('button', { name: /^Utilities, Spent \$25\.00, \$100\.00 planned · \$75\.00 left/ })).toBeTruthy();
});
it('summarises received shared income, net spending with refunds and the net as recorded movement only', async () => {
  const view = await show({ workspace: { ...props.workspace!,
    income: [{ on_date: cashflow.today, amount_minor: 90000, confirmed: true }, { on_date: cashflow.today, amount_minor: 40000, confirmed: false },
      { on_date: '2026-09-30', amount_minor: 70000, confirmed: true }],
    transactions: [...props.workspace!.transactions, { id: 'r', name: 'Refund', amount_minor: -500, category_id: category.id, on_date: cashflow.today }] } });
  expect(view.getByLabelText('Income, $900.00')).toBeTruthy();
  expect(view.getByLabelText('Total spending, $20.00')).toBeTruthy();
  expect(view.getByLabelText('Net balance, $880.00')).toBeTruthy();
  expect(view.getByText('Recorded shared income less spending')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'About these figures' }));
  expect(view.getByText(/not a bank balance/)).toBeTruthy();
});
it('switches to a signed list when refunds exceed a category, and never draws an empty slice', async () => {
  const signed = await show({ workspace: { ...props.workspace!, categories: [...cashflow.categories, second],
    transactions: [{ id: 'e', name: 'Router', amount_minor: 2500, category_id: category.id, on_date: cashflow.today },
      { id: 'r', name: 'Return', amount_minor: -900, category_id: second.id, on_date: cashflow.today }] } });
  expect(signed.queryByRole('image')).toBeNull();
  expect(signed.getByText(/listed with their signs/)).toBeTruthy();
  expect(signed.getByText('-$9.00')).toBeTruthy();
  const empty = await show({ workspace: { ...props.workspace!, transactions: [] } });
  expect(empty.getByRole('image', { name: 'No shared spending recorded this month yet.' })).toBeTruthy();
});
it('selecting a category row highlights its chart segment without navigating', async () => {
  const view = await show();
  const row = view.getByRole('button', { name: /^Utilities, Spent/ });
  await fireEvent.press(row);
  expect(view.getByRole('button', { name: /Selected in chart/ }).props.accessibilityState.selected).toBe(true);
  expect(router.push).not.toHaveBeenCalled();
});
it('keeps unassigned costs visible and opens the allocation page', async () => {
  const view = await show({ workspace: { ...props.workspace!, budgets: [{ ...props.workspace!.budgets[0], category_id: null }] } });
  expect(view.getByText('Plan still to assign')).toBeTruthy();
  expect(view.getByText('Our internet')).toBeTruthy();
  expect(view.getByText('No plan assigned')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Assign planned costs' }));
  expect(router.push).toHaveBeenCalledWith('/budget-categories');
});
it('offers recovery without displaying cached money as current after a refresh failure', async () => {
  const view = await show({ error: true });
  expect(view.queryByText('$75.00')).toBeNull(); expect(view.queryByText('Utilities')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(props.onRefresh).toHaveBeenCalled();
});
it('distinguishes loading from a confirmed empty month', async () => {
  const view = await show({ workspace: undefined });
  expect(view.queryByText('$0.00')).toBeNull(); expect(view.getByText('Loading our latest figures…')).toBeTruthy();
});
it('leaves refresh to the pull gesture and preserves explicit shared expense navigation', async () => {
  const view = await show({ refreshing: true });
  expect(view.queryByRole('button', { name: 'Refresh shared budget' })).toBeNull();
  await fireEvent.press(view.getByRole('link', { name: 'Review expenses' }));
  expect(router.push).toHaveBeenCalledWith({ pathname: '/expenses', params: { visibility: 'shared' } });
});
it('shows overspending in words and fails closed on unsafe totals', async () => {
  const view = await show({ workspace: { ...props.workspace!, budgets: [{ ...props.workspace!.budgets[0], amount_minor: 1000 }] } });
  expect(view.getByText('$10.00 planned · $15.00 over')).toBeTruthy();
  await view.rerender(<LocalizationProvider><SharedBudget {...props} workspace={{ ...cashflow, budgets: [
    { ...props.workspace!.budgets[0], amount_minor: Number.MAX_SAFE_INTEGER }, props.workspace!.budgets[0]] }} /></LocalizationProvider>);
  expect(view.getByRole('alert')).toBeTruthy(); expect(view.queryByText(/planned ·/)).toBeNull();
});
