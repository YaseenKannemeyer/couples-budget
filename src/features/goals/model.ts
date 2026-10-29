import type { Goal } from './schema';
export function goalProgress(goal: Goal) {
  const remaining = Math.max(0, goal.target_minor - goal.saved_minor);
  return { remaining, percent: goal.saved_minor / goal.target_minor * 100, completed: remaining === 0,
    shares: goal.month.shares.map(share => ({ ...share, percent: !goal.month.split_ready || share.target_minor === null ? null :
      share.target_minor === 0 ? 100 : Math.min(100, Math.max(0, share.contributed_minor / share.target_minor * 100)),
      remaining: share.target_minor === null ? null : Math.max(0, share.target_minor - share.contributed_minor) })) };
}

/** Remaining monthly provision for a dated cost, including this calendar month. */
export function sinkingMonthlyNeed(goal: Pick<Goal, 'target_minor' | 'saved_minor' | 'deadline_on'>, today: string) {
  const months = Math.max(1, (Number(goal.deadline_on.slice(0, 4)) - Number(today.slice(0, 4))) * 12 +
    Number(goal.deadline_on.slice(5, 7)) - Number(today.slice(5, 7)) + 1);
  return Math.ceil(Math.max(0, goal.target_minor - goal.saved_minor) / months);
}
