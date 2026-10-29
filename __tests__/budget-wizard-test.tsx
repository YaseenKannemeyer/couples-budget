import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';

import { type BudgetSetup, useSaveBudgetStep } from '@/features/budget/api';
import { BudgetWizard } from '@/features/budget/budget-wizard';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/global.css', () => ({}));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US' }],
  useLocales: () => [{ languageTag: 'en-US' }],
  useCalendars: () => [{ timeZone: 'Africa/Johannesburg' }],
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/budget/api', () => ({ useSaveBudgetStep: jest.fn() }));

const householdId = '00000000-0000-4000-8000-000000000001';
const me = {
  userId: '00000000-0000-4000-8000-00000000000a', householdId, displayName: 'Alex',
  monthlyIncomeMinor: 0, monthlyAllowanceMinor: 0, joinedAt: '2026-10-25T12:00:00Z',
  budgetSetupStep: 0, budgetCompletedAt: null,
};
const partner = {
  ...me, userId: '00000000-0000-4000-8000-00000000000b', displayName: 'Sam',
  monthlyIncomeMinor: 300000, budgetSetupStep: 1,
};
const data: BudgetSetup = {
  household: { id: householdId, name: 'Our home', baseCurrency: 'USD', timezone: 'Africa/Johannesburg',
    splitMode: 'proportional', moneyDateDay: 1, inviteCode: 'ABCDEFGH', budgetRevision: 10 },
  members: [me, partner], me, partner, costs: [], sources: [],
};
const save = jest.fn(async ({ revision }: { revision: number }) => revision + 1);

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useSaveBudgetStep).mockReturnValue({
    isPending: false, error: null, mutateAsync: save, reset: jest.fn(),
  } as unknown as ReturnType<typeof useSaveBudgetStep>);
});

const show = (setup: BudgetSetup = data) => render(
  <LocalizationProvider><BudgetWizard data={setup} onReload={jest.fn()} reloading={false} /></LocalizationProvider>
);

it('saves all four steps, computes live ratios, supports multiple paydays and finishes at home', async () => {
  const view = await show();
  await fireEvent.changeText(view.getByLabelText('Your monthly income (USD)'), '6000');
  expect(view.getByText('Alex · 67%')).toBeTruthy();
  expect(view.getByText('Sam · 33%')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  expect(save).toHaveBeenLastCalledWith({ step: 0, revision: 10, value: { amountMinor: 600000, splitMode: 'proportional' } });

  await fireEvent.changeText(view.getByLabelText('Alex’s allowance (USD)'), '300');
  await fireEvent.changeText(view.getByLabelText('Sam’s allowance (USD)'), '400');
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  expect(save).toHaveBeenLastCalledWith({ step: 1, revision: 11, value: [
    { userId: me.userId, amountMinor: 30000 }, { userId: partner.userId, amountMinor: 40000 },
  ] });

  await fireEvent.press(view.getByRole('button', { name: 'Add Rent' }));
  await fireEvent.changeText(view.getByLabelText('Monthly amount (USD)'), '1500');
  expect(view.getByText('$1,000.00')).toBeTruthy();
  expect(view.getByText('$500.00')).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  expect(save).toHaveBeenLastCalledWith({ step: 2, revision: 12, value: [{ name: 'Rent', amountMinor: 150000 }] });

  await fireEvent.press(view.getByRole('radio', { name: 'Weekly' }));
  await fireEvent.changeText(view.getByLabelText('Expected amount per payday (USD)'), '1500');
  await fireEvent.changeText(view.getByLabelText('Next payday (YYYY-MM-DD)'), '2026-11-02');
  await fireEvent.press(view.getByRole('button', { name: 'Add another income source' }));
  await fireEvent.changeText(view.getAllByLabelText('Income source name')[1], 'Bonus');
  await fireEvent.press(view.getAllByRole('radio', { name: 'Irregular' })[1]);
  await fireEvent.press(view.getByRole('button', { name: 'Save our budget' }));
  expect(save).toHaveBeenLastCalledWith({ step: 3, revision: 13, value: [
    { name: 'My income', cadence: 'weekly', amountMinor: 150000, nextPayday: '2026-11-02' },
    { name: 'Bonus', cadence: 'irregular', amountMinor: null, nextPayday: null },
  ] });
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('resumes from saved progress and preserves draft costs when going back', async () => {
  const view = await show({ ...data, me: { ...me, monthlyIncomeMinor: 600000, budgetSetupStep: 2 },
    costs: [{ id: 'rent', name: 'Rent', amountMinor: 150000 }] });
  expect(view.getByText('Step 3 of 4')).toBeTruthy();
  expect(view.getByDisplayValue('1500.00')).toBeTruthy();
  await fireEvent.changeText(view.getByLabelText('Monthly amount (USD)'), '1800');
  await fireEvent.press(view.getByRole('button', { name: 'Back' }));
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  expect(view.getByDisplayValue('1800')).toBeTruthy();
});

it('does not save invalid amounts and lets someone leave to invite their partner', async () => {
  const view = await show();
  await fireEvent.changeText(view.getByLabelText('Your monthly income (USD)'), '-1');
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  expect(save).not.toHaveBeenCalled();
  expect(view.getByText(/Enter a valid amount in USD/)).toBeTruthy();
  await fireEvent.press(view.getByRole('button', { name: 'Finish later' }));
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('offers an explicit reload when another device has changed the plan', async () => {
  jest.mocked(useSaveBudgetStep).mockReturnValue({
    isPending: false, error: { message: 'Budget plan changed' }, mutateAsync: save, reset: jest.fn(),
  } as unknown as ReturnType<typeof useSaveBudgetStep>);
  const view = await show();
  expect(view.getByText(/Our plan changed on another device/)).toBeTruthy();
  expect(view.getByRole('button', { name: 'Reload latest plan' })).toBeTruthy();
});

it('keeps invalid irregular-income amounts from silently becoming unknown amounts', async () => {
  const view = await show({ ...data, me: { ...me, budgetSetupStep: 3 }, sources: [
    { id: 'source', name: 'Bonus', cadence: 'irregular', amountMinor: null, nextPayday: null },
  ] });
  await fireEvent.changeText(view.getByLabelText('Expected amount, if known (USD)'), '-1');
  await fireEvent.press(view.getByRole('button', { name: 'Save our budget' }));
  expect(save).not.toHaveBeenCalled();
  expect(view.getByText(/Enter a valid amount/)).toBeTruthy();
});

it('retains a newly saved cost identity when going back to edit it', async () => {
  const setup = { ...data, me: { ...me, budgetSetupStep: 2 } };
  const view = await show(setup);
  await fireEvent.press(view.getByRole('button', { name: 'Add Rent' }));
  await fireEvent.changeText(view.getByLabelText('Monthly amount (USD)'), '1500');
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  const id = '00000000-0000-4000-8000-000000000099';
  await view.rerender(<LocalizationProvider><BudgetWizard data={{ ...setup, costs: [{ id, name: 'Rent', amountMinor: 150000 }] }} onReload={jest.fn()} reloading={false} /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button', { name: 'Back' }));
  await fireEvent.changeText(view.getByLabelText('Payment or expense name'), 'Our rent');
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  expect(save).toHaveBeenLastCalledWith({ step: 2, revision: 11, value: [{ id, name: 'Our rent', amountMinor: 150000 }] });
});

it('lets a joining partner review the saved shared agreement before explicitly changing it', async () => {
  const view = await show({ ...data, members: [partner, me] });
  expect(view.getByText('Your partner has started our plan')).toBeTruthy();
  expect(view.getByRole('radio', { name: 'Equal (50/50)' })).toBeDisabled();
  await fireEvent.press(view.getByRole('button', { name: 'Change the shared agreement' }));
  expect(view.getByRole('radio', { name: 'Equal (50/50)' })).toBeEnabled();
});

it('defers optional paydays without sending a guessed source or discarding saved sources', async () => {
  const view = await show({ ...data, me: { ...me, budgetSetupStep: 3 }, sources: [
    { id: '00000000-0000-4000-8000-000000000001', name: 'Saved income', cadence: 'irregular', amountMinor: null, nextPayday: null },
  ] });
  await fireEvent.press(view.getByRole('button', { name: 'Set up paydays later' }));
  expect(save).toHaveBeenLastCalledWith({ step: 'defer', revision: 10 });
  expect(router.replace).toHaveBeenCalledWith('/');
});

it('keeps household leftovers pending while a partner has not entered income', async () => {
  const pending = { ...partner, budgetSetupStep: 0, monthlyIncomeMinor: 0 };
  const view = await show({ ...data, partner: pending, members: [me, pending], me: { ...me, budgetSetupStep: 2 } });
  expect(view.getByText('The full household total and leftover will be available after both partners enter their income.')).toBeTruthy();
  expect(view.queryByText('Left after our plan')).toBeNull();
});

it('lets a solo partner finish without inventing partner income, allowances or fair shares', async () => {
  const view = await show({ ...data, members: [me], partner: null });
  await fireEvent.changeText(view.getByLabelText('Your monthly income (USD)'), '6000');
  expect(view.queryByText('Alex · 100%')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  expect(view.queryByLabelText('Sam’s allowance (USD)')).toBeNull();
  await fireEvent.changeText(view.getByLabelText('Alex’s allowance (USD)'), '300');
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  expect(save).toHaveBeenLastCalledWith({step:1,revision:11,value:[{userId:me.userId,amountMinor:30000}]});
  await fireEvent.press(view.getByRole('button', { name: 'Add Rent' }));
  await fireEvent.changeText(view.getByLabelText('Monthly amount (USD)'), '1500');
  expect(view.queryByText('Alex’s contribution')).toBeNull();
  await fireEvent.press(view.getByRole('button', { name: 'Save and continue' }));
  await fireEvent.changeText(view.getByLabelText('Expected amount per payday (USD)'), '6000');
  await fireEvent.changeText(view.getByLabelText('Next payday (YYYY-MM-DD)'), '2026-11-25');
  await fireEvent.press(view.getByRole('button', { name: 'Save our budget' }));
  expect(save).toHaveBeenLastCalledWith({step:3,revision:13,value:[{name:'My income',amountMinor:600000,cadence:'monthly',nextPayday:'2026-11-25'}]});
  expect(router.replace).toHaveBeenCalledWith('/');
});
