import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { useCashflowAction } from '@/features/cashflow/api';
import { useFlowData } from '@/features/cashflow/ui';
import { BudgetCategoriesScreen } from '@/features/shared-budget/budget-categories-screen';
import { LocalizationProvider } from '@/i18n/provider';
import { cashflow } from '../test/fixtures/cashflow';
import { household, me } from '../test/fixtures/payments';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), replace: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/cashflow/api', () => ({ useCashflowAction: jest.fn() }));
jest.mock('@/features/cashflow/ui', () => ({ ...jest.requireActual('@/features/cashflow/ui'), useFlowData: jest.fn() }));
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/features/payments/api', () => ({ usePaymentWorkspace: jest.fn() }));
const data = { ...cashflow, budgets: [{ id: 'b', name: 'Internet plan', amount_minor: 10000, category_id: null, version: 3 }] };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useFlowData).mockReturnValue({ household: { household, me, partner: null, members: [me] },
    query: { data, isError: false, refetch: jest.fn() } } as unknown as ReturnType<typeof useFlowData>);
});
it('assigns a planned cost with its captured version and returns to the shared screen', async () => {
  const mutate = jest.fn((_input, options) => options.onSuccess());
  jest.mocked(useCashflowAction).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useCashflowAction>);
  const view = await render(<LocalizationProvider><BudgetCategoriesScreen /></LocalizationProvider>);
  expect(view.queryByText('null Utilities')).toBeNull();
  await fireEvent.press(view.getByRole('radio', { name: 'Utilities' }));
  await fireEvent.press(view.getByRole('button', { name: 'Save category link' }));
  expect(mutate).toHaveBeenCalledWith({ kind: 'plan', type: 'budget', id: 'b', version: 3, values: { categoryId: cashflow.categories[0].id } }, expect.anything());
  expect(router.replace).toHaveBeenCalledWith('/shared-budget');
});
it('retains a draft’s expected version when another partner edits the assignment', async () => {
  const mutate = jest.fn();
  jest.mocked(useCashflowAction).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useCashflowAction>);
  const view = await render(<LocalizationProvider><BudgetCategoriesScreen /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('radio', { name: 'Utilities' }));
  jest.mocked(useFlowData).mockReturnValue({ household: { household, me, partner: null, members: [me] },
    query: { data: { ...data, budgets: [{ ...data.budgets[0], version: 4 }] }, isError: false, refetch: jest.fn() } } as unknown as ReturnType<typeof useFlowData>);
  await view.rerender(<LocalizationProvider><BudgetCategoriesScreen /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button', { name: 'Save category link' }));
  expect(mutate.mock.calls[0][0].version).toBe(3);
});
it('reloads a rejected allocation explicitly and retries with the latest saved version', async () => {
  const mutate = jest.fn();
  const refresh = jest.fn(async () => ({ isError: false }));
  jest.mocked(useCashflowAction).mockReturnValue({ mutate, isPending: false, error: { message: 'Forecast changed' } } as unknown as ReturnType<typeof useCashflowAction>);
  const view = await render(<LocalizationProvider><BudgetCategoriesScreen /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('radio', { name: 'Utilities' }));
  jest.mocked(useFlowData).mockReturnValue({ household: { household, me, partner: null, members: [me] },
    query: { data: { ...data, budgets: [{ ...data.budgets[0], version: 4 }] }, isError: false, refetch: refresh } } as unknown as ReturnType<typeof useFlowData>);
  await view.rerender(<LocalizationProvider><BudgetCategoriesScreen /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button', { name: 'Reload latest data' }));
  expect(refresh).toHaveBeenCalledTimes(1);
  await fireEvent.press(view.getByRole('radio', { name: 'Utilities' }));
  await fireEvent.press(view.getByRole('button', { name: 'Save category link' }));
  expect(mutate.mock.calls[0][0].version).toBe(4);
});
it('keeps a selected allocation and its captured version through background failure and recovery', async () => {
  const mutate = jest.fn();
  const refetch = jest.fn(async () => ({ isError: false }));
  jest.mocked(useCashflowAction).mockReturnValue({ mutate, isPending: false } as unknown as ReturnType<typeof useCashflowAction>);
  const view = await render(<LocalizationProvider><BudgetCategoriesScreen /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('radio', { name: 'Utilities' }));
  const refreshed = { ...data, budgets: [{ ...data.budgets[0], version: 4 }] };
  const setQuery = (isError: boolean) => jest.mocked(useFlowData).mockReturnValue({ household: { household, me, partner: null, members: [me] },
    query: { data: refreshed, isError, refetch } } as unknown as ReturnType<typeof useFlowData>);
  setQuery(true);
  await view.rerender(<LocalizationProvider><BudgetCategoriesScreen /></LocalizationProvider>);
  expect(view.getByRole('alert')).toBeTruthy();
  expect(view.getByRole('radio', { name: 'Utilities' }).props.accessibilityState.checked).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
  setQuery(false);
  await view.rerender(<LocalizationProvider><BudgetCategoriesScreen /></LocalizationProvider>);
  expect(view.queryByRole('alert')).toBeNull();
  expect(view.getByRole('radio', { name: 'Utilities' }).props.accessibilityState.checked).toBe(true);
  await fireEvent.press(view.getByRole('button', { name: 'Save category link' }));
  expect(mutate.mock.calls[0][0].version).toBe(3);
});
