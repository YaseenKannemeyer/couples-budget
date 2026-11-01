import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { cashflow } from '../test/fixtures/cashflow';
import { goalsWorkspace } from '../test/fixtures/goals';
import { household, me, partner } from '../test/fixtures/payments';
import { Plan, type PlanProps } from '@/features/plan/plan-screen';
import { goalsSummary, planModel } from '@/features/plan/model';
import { LocalizationProvider } from '@/i18n/provider';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/household/api', () => ({ useMyHousehold: jest.fn() }));
jest.mock('@/features/cashflow/api', () => ({ useCashflow: jest.fn() }));
jest.mock('@/features/goals/api', () => ({ useGoals: jest.fn() }));
jest.mock('@/features/dashboard/api', () => ({ useHomeActivity: jest.fn() }));

const props: PlanProps = {
  household: { household, me, partner, members: [me, partner] }, workspace: cashflow, goals: goalsWorkspace,
  activity: { allowances: [{ user_id: me.userId, display_name: 'Alex', remaining_minor: 12345 }, { user_id: partner.userId, display_name: 'Sam', remaining_minor: 6500 }], recent: [], paid: [] },
  flowError: false, goalsError: false, activityError: false, refreshing: false, onRefresh: jest.fn(),
};
const show = (patch: Partial<PlanProps> = {}) => render(<LocalizationProvider><Plan {...props} {...patch} /></LocalizationProvider>);
beforeEach(() => jest.clearAllMocks());

it('groups every shared-plan feature with factual subtitles and opens the existing routes', async () => {
  const view = await show();
  expect(view.getByText('Your shared plan')).toBeTruthy();
  const saved = goalsSummary(goalsWorkspace.goals);
  expect(view.getByText(new RegExp(`${saved.count} goals? ·`))).toBeTruthy();
  for (const [name, route] of [['Spending budget', '/shared-budget'], ['Bills', '/payments'], ['Savings goals', '/goals'],
    ['Contributions & income', '/income'], ['Cash forecast', '/cash-flow'], ['Monthly review', '/money-date'], ['Balance check', '/reconciliation'],
    ['Weekly boosters', '/boosters'], ['Categories', '/categories'], ['Budget setup', '/budget']] as const) {
    await fireEvent.press(view.getByRole('button', { name: new RegExp(`^${name.replace(/[&]/g, '.')}`) }));
    expect(router.push).toHaveBeenLastCalledWith(route);
  }
});
it('shows aggregate allowance totals only, and an unavailable state instead of zero', async () => {
  const view = await show();
  expect(view.getByText('$123.45')).toBeTruthy(); expect(view.getByText('$65.00')).toBeTruthy();
  expect(view.getByText('Allowance totals are shared. Purchases stay private.')).toBeTruthy();
  const failed = await show({ activity: undefined, activityError: true, workspace: undefined, flowError: true });
  expect(failed.queryByText('$123.45')).toBeNull(); expect(failed.queryByText('$0.00')).toBeNull();
  expect(failed.getAllByText('Unavailable').length).toBeGreaterThan(0);
});
it('derives bill and forecast subtitles from the same projection as Overview', () => {
  const model = planModel(cashflow, [me, partner]);
  expect(model.dueThisWeek + model.overdue).toBeGreaterThanOrEqual(0);
  expect(model.lowest === null || Number.isSafeInteger(model.lowest.amount)).toBe(true);
  expect(planModel({ ...cashflow, balance: null }, [me, partner]).lowest).toBeNull();
});
