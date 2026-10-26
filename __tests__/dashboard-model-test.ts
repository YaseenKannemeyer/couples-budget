import { cashflow } from '../test/fixtures/cashflow';
import { me, partner } from '../test/fixtures/payments';
import { homeModel, paymentWindow } from '@/features/dashboard/model';
import { householdToday } from '@/features/payments/dates';

const cat = cashflow.categories[0].id;
const budget = { id: 'b', name: 'Utilities', amount_minor: 50000, category_id: cat, version: 1 };

it('uses household-month actual spending, counts refunds and excludes future ledger entries', () => {
  const data = { ...cashflow, budgets: [budget], transactions: [
    { id: '1', name: 'Last month', amount_minor: 99999, on_date: '2026-09-30', category_id: cat },
    { id: '2', name: 'Expense', amount_minor: 35000, on_date: '2026-10-20', category_id: cat },
    { id: '3', name: 'Refund', amount_minor: -5000, on_date: '2026-10-24', category_id: cat },
    { id: '4', name: 'Future', amount_minor: 99999, on_date: '2026-10-30', category_id: cat },
  ] };
  const model = homeModel(data, [me, partner]);
  expect(model.spent).toBe(30000);
  expect(model.remaining).toBe(20000);
  expect(model.progress).toBe(60);
  expect(model.income).toBe(me.monthlyIncomeMinor + partner.monthlyIncomeMinor);
});
it('clamps only the progress graphic, preserving over-budget and refund amounts', () => {
  const row = { id: '1', name: 'Expense', amount_minor: 70000, on_date: '2026-10-20', category_id: cat };
  const over = homeModel({ ...cashflow, budgets: [budget], transactions: [row] }, [me]);
  expect(over.remaining).toBe(-20000); expect(over.progress).toBe(100);
  const refund = homeModel({ ...cashflow, budgets: [budget], transactions: [{ ...row, amount_minor: -1000 }] }, [me]);
  expect(refund.remaining).toBe(51000); expect(refund.progress).toBe(0);
  expect(homeModel({ ...cashflow, budgets: [] }, [me]).progress).toBeNull();
});
it('marks joint income as provisional until both partners have entered it', () => {
  expect(homeModel(cashflow, [me]).incomeComplete).toBe(false);
  expect(homeModel(cashflow, [me, { ...partner, budgetSetupStep: 0 }]).incomeComplete).toBe(false);
  expect(homeModel(cashflow, [me, partner]).incomeComplete).toBe(true);
});
it('honors dismissed/moved forecast occurrences and never treats them as received money', () => {
  const model = homeModel({ ...cashflow, overrides: [
    { item_key: `payment:${cashflow.payments[0].id}:2026-10-26`, due_on: '2026-10-29', amount_minor: 10000, dismissed: false, version: 1 },
    { item_key: 'income:2026-10-28', due_on: null, amount_minor: null, dismissed: true, version: 1 },
  ] }, [me, partner]);
  expect(model.pending[0].on).toBe('2026-10-29');
  expect(paymentWindow(model.pending[0])).toEqual({ dueStart: '2026-10-29', dueEnd: '2026-10-29' });
  expect(model.nextIncome).toBeUndefined();
  expect(model.projection.confirmed).toBe(100000);
});
it('uses residual budget reservations for commitments and flags unknown extra bills', () => {
  const model = homeModel({ ...cashflow, budgets: [budget], payments: [{ ...cashflow.payments[0], recurrence: 'one_time', estimate_minor: null }] }, [me]);
  expect(model.commitments).toBe(100000); // current month + next month's plan reserved before Nov 24
  expect(model.unknownCommitments).toBe(true);
});
it('rolls the month using household dates at the UTC boundary', () => {
  const today = householdToday('Pacific/Auckland', new Date('2026-10-31T22:00:00Z'));
  expect(today).toBe('2026-11-01');
  const model = homeModel({ ...cashflow, today, transactions: [
    { id: 'oct', name: 'October', on_date: '2026-10-31', amount_minor: 5000, category_id: cat },
    { id: 'nov', name: 'November', on_date: today, amount_minor: 2000, category_id: cat },
  ] }, [me]);
  expect(model.spent).toBe(2000);
});

it('shows only the next unpaid cycle per schedule in the compact upcoming list', () => {
  const model = homeModel(cashflow, [me, partner]);
  expect(model.pending).toHaveLength(1);
  expect(model.pending[0].on).toBe('2026-10-26');
});

it('keeps a date window when only the estimate is corrected', () => {
  const model = homeModel({ ...cashflow, overrides: [{
    item_key: `payment:${cashflow.payments[0].id}:2026-10-26`, due_on: null, amount_minor: 15000, dismissed: false, version: 1,
  }] }, [me]);
  expect(paymentWindow(model.pending[0])).toEqual({ dueStart: '2026-10-26', dueEnd: '2026-10-28' });
});
it('omits a one-time payment corrected beyond the advertised 90-day horizon', () => {
  const model = homeModel({ ...cashflow, payments: [{ ...cashflow.payments[0], recurrence: 'one_time' }], overrides: [{
    item_key: `payment:${cashflow.payments[0].id}:2026-10-26`, due_on: '2027-02-01', amount_minor: null, dismissed: false, version: 1,
  }] }, [me]);
  expect(model.pending).toHaveLength(0);
});
