import type { Contribution, Goal, GoalWorkspace } from '@/features/goals/schema';
import { me, partner, workspace } from './payments';
export const jointGoal: Goal = {
  id: '00000000-0000-4000-8000-000000000099', name: 'Our summer trip', target_minor: 700000, deadline_on: '2026-12-31', starts_on: '2026-09-01',
  category_id: workspace.categories[0].id, archived: false, version: 3, created_at: '2026-09-01T12:00:00Z', saved_minor: 300000,
  month: { month_on: '2026-10-01', due_on: '2026-10-31', target_minor: 200000, split_mode: 'proportional', split_ready: true,
    shares: [{ user_id: me.userId, target_minor: 120000, contributed_minor: 120000 }, { user_id: partner.userId, target_minor: 80000, contributed_minor: 80000 }] },
  series: [{ month_on: '2026-09-01', amount_minor: 100000 }, { month_on: '2026-10-01', amount_minor: 200000 }],
};
export const goalsWorkspace: GoalWorkspace = { today: '2026-10-27', revision: 8,
  categories: workspace.categories.map(c => ({ ...c, name: 'Savings', bucket: 'savings', starterKey: 'savings' })), forecast_plans: [], goals: [jointGoal] };
export const goalHistory: Contribution[] = [
  { id: '00000000-0000-4000-8000-000000000091', contributor_id: me.userId, amount_minor: 120000, source: 'scheduled', occurred_on: '2026-10-27', created_at: '2026-10-27T12:00:00Z', reversed: false, reverses_id: null },
  { id: '00000000-0000-4000-8000-000000000092', contributor_id: partner.userId, amount_minor: 80000, source: 'scheduled', occurred_on: '2026-10-27', created_at: '2026-10-27T11:00:00Z', reversed: false, reverses_id: null },
];
