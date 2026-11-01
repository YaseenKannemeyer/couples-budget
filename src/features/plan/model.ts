import { homeModel, paymentWindow } from '@/features/dashboard/model';
import type { Workspace } from '@/features/cashflow/schema';
import type { Member } from '@/features/household/schema';
import { dueState, shiftCalendarDays } from '@/features/payments/dates';
import type { Goal } from '@/features/goals/schema';

/** Row subtitles for Plan. Reuses the Overview projection; adds no financial calculation of its own. */
export function planModel(data: Workspace, members: Member[]) {
  const home = homeModel(data, members);
  const weekEnd = shiftCalendarDays(data.today, 6);
  let dueThisWeek = 0; let overdue = 0;
  for (const item of home.projection.items) {
    if (item.kind !== 'payment' || item.dismissed || item.confirmed) continue;
    const window = paymentWindow(item);
    const state = dueState(window.dueStart, window.dueEnd, data.today);
    if (state === 'overdue') overdue += 1;
    else if (window.dueStart <= weekEnd) dueThisWeek += 1;
  }
  return { plan: home.plan, spent: home.spent, hasPlan: home.progress !== null, dueThisWeek, overdue,
    lowest: home.projection.lowest === null ? null : { amount: home.projection.lowest, on: home.projection.lowestOn } };
}

export function goalsSummary(goals: Pick<Goal, 'archived' | 'saved_minor'>[]) {
  const active = goals.filter(goal => !goal.archived);
  return { count: active.length, saved: active.reduce((sum, goal) => sum + goal.saved_minor, 0) };
}
