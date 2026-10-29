import type { BillWorkspace, BoosterWorkspace } from '@/features/relationships/schema';
import { household, me, partner } from './payments';
import { goalsWorkspace } from './goals';
export const boosterData: BoosterWorkspace = { today: '2026-10-29', next_week_on: '2026-11-02', token: 'weekly-review',
  budgets: [{ category_id: goalsWorkspace.categories[0].id, starts_on: '2026-10-19', amount_minor: 10000, version: 1 }],
  candidates: [{ category_id: goalsWorkspace.categories[0].id, name: 'Savings', starter_key: 'savings', week_on: '2026-10-19',
    amount_minor: 10000, spent_minor: 6000, claimed_minor: 0, available_minor: 4000, locked: false }] };
export const billData: BillWorkspace = { today: '2026-10-29', token: 'bill-review', locked: false, stale: false,
  expense: { id: '00000000-0000-4000-8000-000000000098', description: 'Weekly groceries', amount_minor: 10001, occurred_on: '2026-10-29', paid_by: me.userId },
  members: [me, partner].map((m, i) => ({ user_id: m.userId, display_name: m.displayName, income_minor: i ? 40000 : 60000, setup_step: 4 })),
  default_mode: 'income', default_ready: true, default_shares: [{ user_id: me.userId, amount_minor: 6001 }, { user_id: partner.userId, amount_minor: 4000 }], saved: null };
export { household };
