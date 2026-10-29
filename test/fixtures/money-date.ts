import type { MoneyDateWorkspace } from '@/features/money-date/schema';
import { cashflow } from './cashflow';
import { jointGoal } from './goals';
import { me, partner, workspace } from './payments';
export const moneyDate: MoneyDateWorkspace = {
  today: '2026-11-02', token: 'review-a', ready: true,
  periods: [{ month_on: '2026-11-01', status: 'open', recorded: true }, { month_on: '2026-10-01', status: 'open', recorded: true }],
  period: { id: '00000000-0000-4000-8000-000000000080', starts_on: '2026-10-01', ends_on: '2026-11-01', status: 'open', snapshot: null },
  facts: { today: '2026-11-02', month_on: '2026-10-01', ends_on: '2026-11-01', plan: { split_mode: 'proportional' },
    draft: { version: 2, actual_minor: 180000, anchor_on: '2026-10-01', anchor_minor: 200000, gap_shares: [], surplus_correction: false, next_split: null, drawdowns: [] },
    baseline_changed: false, expected_minor: 180000, gap_minor: 0, default_split: 'proportional', next_split: 'proportional',
    members: [me, partner].map(m => ({ user_id: m.userId, display_name: m.displayName })),
    next_allowances: [me, partner].map(m => ({ user_id: m.userId, amount_minor: m.monthlyAllowanceMinor })),
    categories: [{ category_id: workspace.categories[0].id, name: 'Groceries', planned_minor: 60000, spent_minor: 48500 }], goals: [jointGoal],
    flow: { ...cashflow, today: '2026-11-02', balance: { ...cashflow.balance!, as_of_on: '2026-11-01', amount_minor: 180000 },
      income: [{ on_date: '2026-11-25', amount_minor: 300000, confirmed: false }],
      payments: [{ ...cashflow.payments[0], due_start: '2026-11-14', due_end: '2026-11-16', anchor_start_day: 14, anchor_end_day: 16 }],
    },
  },
  approvals: [me, partner].map(m => ({ user_id: m.userId, approved: false })),
};
export const lockedMoneyDate: MoneyDateWorkspace = { ...moneyDate, token: null, ready: false,
  period: { ...moneyDate.period, status: 'locked', snapshot: { closed_at: '2026-11-02T12:00:00Z',
    allowances: [me, partner].map(m => ({ user_id: m.userId, allowance_minor: 30000, spent_minor: m.userId === me.userId ? 18450 : 25000 })) } },
  approvals: moneyDate.approvals.map(a => ({ ...a, approved: true })),
};
