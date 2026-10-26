import { sharedBudgetModel } from '@/features/shared-budget/model';
import { cashflow } from '../test/fixtures/cashflow';

const category = cashflow.categories[0];
const cost = { id: 'cost', name: 'Internet plan', amount_minor: 10000, category_id: category.id, version: 1 };
const expense = { id: 'expense', name: 'Internet', on_date: cashflow.today, category_id: category.id, amount_minor: 2500 };

it('combines assigned costs and net shared spending without subtracting unpaid bills', () => {
  const result = sharedBudgetModel({ ...cashflow, budgets: [cost, { ...cost, id: 'second', amount_minor: 5000 }], transactions: [expense, { ...expense, id: 'refund', amount_minor: -500 }] });
  expect(result.plan).toBe(15000); expect(result.spent).toBe(2000); expect(result.remaining).toBe(13000);
  expect(result.rows[0]).toMatchObject({ plan: 15000, spent: 2000, remaining: 13000 });
  expect(result.pending[0].amount).toBe(20000);
});
it('uses the server household month and excludes past-month and future-dated expenses', () => {
  const result = sharedBudgetModel({ ...cashflow, transactions: [expense,
    { ...expense, id: 'past', on_date: '2026-09-30' }, { ...expense, id: 'future', on_date: '2026-10-26' }] });
  expect(result.spent).toBe(2500); expect(result.futureCount).toBe(1);
});
it('keeps unassigned plan separate and never invents remaining amounts for unbudgeted categories', () => {
  const result = sharedBudgetModel({ ...cashflow, budgets: [{ ...cost, category_id: null }], transactions: [expense] });
  expect(result.plan).toBe(10000); expect(result.unassignedAmount).toBe(10000);
  expect(result.rows[0]).toMatchObject({ plan: null, spent: 2500, remaining: null });
});
it('distinguishes an explicit zero budget from no plan and preserves overspending and refunds', () => {
  const over = sharedBudgetModel({ ...cashflow, budgets: [{ ...cost, amount_minor: 0 }], transactions: [expense] });
  expect(over.hasPlan).toBe(true); expect(over.rows[0].remaining).toBe(-2500);
  const refund = sharedBudgetModel({ ...cashflow, budgets: [cost], transactions: [{ ...expense, amount_minor: -500 }] });
  expect(refund.rows[0].remaining).toBe(10500);
  expect(sharedBudgetModel(cashflow).hasPlan).toBe(false);
});
it('keeps archived categories with monthly activity, hides empty archived categories and private names', () => {
  const result = sharedBudgetModel({ ...cashflow, categories: [{ ...category, archived: true },
    { ...category, id: 'unused', name: 'Unused', archived: true },
    { ...category, id: 'private', name: 'Secret medical', visibility: 'private' }], transactions: [expense] });
  expect(result.rows.map(row => row.category.id)).toEqual([category.id]);
});
it('retains a reconcilable fallback for missing category metadata or links', () => {
  const result = sharedBudgetModel({ ...cashflow, categories: [], budgets: [cost], transactions: [expense] });
  expect(result.uncategorisedSpent).toBe(result.spent); expect(result.unassignedAmount).toBe(result.plan);
});
it('shows one next unpaid cycle per schedule with corrected dates/amounts and unknown variable bills', () => {
  const result = sharedBudgetModel({ ...cashflow, payments: [...cashflow.payments,
    { ...cashflow.payments[0], id: 'variable', recurrence: 'one_time', estimate_minor: null }],
    overrides: [{ item_key: `payment:${cashflow.payments[0].id}:2026-10-26`, due_on: '2026-10-29', amount_minor: 12000, dismissed: false, version: 1 }] });
  expect(result.pending).toHaveLength(2);
  expect(result.pending.find(p => p.corrected)).toMatchObject({ on: '2026-10-29', amount: 12000 });
  expect(result.pending[0].amount).toBeNull();
});
it('omits dismissed cycles and schedules beyond the upcoming horizon while keeping overdue bills', () => {
  const result = sharedBudgetModel({ ...cashflow, payments: [
    { ...cashflow.payments[0], id: 'late', recurrence: 'one_time', due_start: '2026-09-01', due_end: '2026-09-01' },
    { ...cashflow.payments[0], id: 'later', recurrence: 'one_time', due_start: '2027-10-01', due_end: '2027-10-01' },
    { ...cashflow.payments[0], id: 'dismissed', recurrence: 'one_time' }],
    overrides: [{ item_key: 'payment:dismissed:2026-10-26', due_on: null, amount_minor: null, dismissed: true, version: 1 }] });
  expect(result.pending.map(p => p.key)).toEqual(['payment:late:2026-09-01']);
});
it('rejects unsafe sums rather than displaying rounded money', () => {
  expect(() => sharedBudgetModel({ ...cashflow, budgets: [{ ...cost, amount_minor: Number.MAX_SAFE_INTEGER }, cost] })).toThrow('overflow');
});
