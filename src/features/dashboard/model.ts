import { forecast, type ForecastItem } from '@/features/cashflow/model';
import type { Workspace } from '@/features/cashflow/schema';
import type { Member } from '@/features/household/schema';
import { shiftCalendarDays } from '@/features/payments/dates';

export function sumMinor(values: number[]) {
  return values.reduce((sum, value) => {
    const next = sum + value;
    if (!Number.isSafeInteger(next)) throw new Error('Dashboard amount overflow');
    return next;
  }, 0);
}

export function homeModel(data: Workspace, members: Member[]) {
  const plan = sumMinor(data.budgets.map(b => b.amount_minor));
  const spent = sumMinor(data.transactions.filter(t => t.on_date.slice(0, 7) === data.today.slice(0, 7) && t.on_date <= data.today)
    .map(t => t.amount_minor));
  const projection = forecast(data);
  const active = projection.items.filter(i => !i.dismissed && i.on <= projection.horizon);
  // Show the next unpaid cycle of each schedule, rather than filling Home with
  // several future occurrences of a single monthly bill.
  const schedules = new Map<string, ForecastItem>();
  for (const item of active) {
    const scheduleId = item.key.split(':')[1];
    if (item.kind === 'payment' && !schedules.has(scheduleId)) schedules.set(scheduleId, item);
  }
  const pending = [...schedules.values()].slice(0, 3);
  const nextIncome = active.find(i => i.kind === 'income' && !i.confirmed && !i.late && (i.amount ?? 0) > 0 && i.on <= projection.horizon);
  const commitments = active.filter(i => !i.confirmed && i.on <= shiftCalendarDays(data.today, 30) &&
    (i.kind === 'payment' || i.kind === 'budget' || i.kind === 'goal' || (i.kind === 'transaction' && i.on > data.today && (i.amount ?? 0) < 0)));
  return {
    plan, spent, remaining: sumMinor([plan, -spent]),
    progress: plan > 0 ? Math.max(0, Math.min(100, (spent / plan) * 100)) : null,
    income: sumMinor(members.map(m => m.monthlyIncomeMinor)),
    incomeComplete: members.length === 2 && members.every(m => m.budgetSetupStep >= 1),
    pending, nextIncome, projection,
    commitments: sumMinor(commitments.map(i => i.kind === 'transaction' ? -(i.amount ?? 0) : i.amount ?? 0)),
    unknownCommitments: commitments.some(i => i.amount === null),
  };
}

export function paymentWindow(item: ForecastItem) {
  return { dueStart: item.on, dueEnd: item.on !== item.originalOn ? item.on : item.end ?? item.on };
}
