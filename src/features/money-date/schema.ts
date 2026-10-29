import { z } from 'zod';
import { isCalendarDate } from '@/features/budget/schema';
import { workspace } from '@/features/cashflow/schema';
import { goalMoney, goalRow } from '@/features/goals/schema';
const date = z.string().refine(isCalendarDate);
export const splitMode = z.enum(['equal', 'proportional', 'combined']);
const share = z.object({ user_id: z.uuid(), amount_minor: goalMoney.refine(n => n > 0) });
const drawdown = z.object({ goal_id: z.uuid(), amount_minor: goalMoney.refine(n => n > 0) });
export const dateOptions = z.object({ gap_shares: z.array(share), surplus_correction: z.boolean(), next_split: splitMode.nullable(), drawdowns: z.array(drawdown) });
const draft = dateOptions.extend({ version: z.number().int(), actual_minor: goalMoney.nullable(), anchor_on: date.nullable(), anchor_minor: goalMoney.nullable() });
const approval = z.object({ user_id: z.uuid(), approved: z.boolean() });
const facts = z.object({ today: date, month_on: date, ends_on: date,
  plan: z.object({ split_mode: splitMode }).passthrough().nullable(),
  draft, baseline_changed: z.boolean(), expected_minor: goalMoney.nullable(), gap_minor: goalMoney.nullable(), default_split: splitMode, next_split: splitMode,
  members: z.array(z.object({ user_id: z.uuid(), display_name: z.string() })),
  next_allowances: z.array(z.object({ user_id: z.uuid(), amount_minor: goalMoney.refine(n => n >= 0) })),
  categories: z.array(z.object({ category_id: z.uuid(), name: z.string(), planned_minor: goalMoney, spent_minor: goalMoney })),
  goals: z.array(goalRow), flow: workspace,
  bill_splits: z.array(z.object({ transaction_id: z.uuid(), description: z.string(), mode: z.enum(['equal', 'income', 'percentage', 'fixed', 'custom']), amount_minor: goalMoney,
    shares: z.array(z.object({ user_id: z.uuid(), amount_minor: goalMoney })), stale: z.boolean() })).optional(),
});
export const moneyDateWorkspace = z.object({ today: date,
  periods: z.array(z.object({ month_on: date, status: z.enum(['open', 'in_review', 'locked']), recorded: z.boolean() })),
  period: z.object({ id: z.uuid(), starts_on: date, ends_on: date, status: z.enum(['open', 'in_review', 'locked']),
    snapshot: z.object({ closed_at: z.string(), allowances: z.array(z.object({ user_id: z.uuid(), allowance_minor: goalMoney.nullable(), spent_minor: goalMoney })) }).nullable() }),
  facts, token: z.string().nullable(), approvals: z.array(approval), ready: z.boolean(),
});
export type MoneyDateWorkspace = z.infer<typeof moneyDateWorkspace>;
export type DateOptions = z.infer<typeof dateOptions>;
export type MoneyDateAction =
  | { action: 'check'; values: { actualMinor: number } }
  | { action: 'options'; values: { shares: DateOptions['gap_shares']; surplusCorrection: boolean; nextSplit: DateOptions['next_split']; drawdowns: DateOptions['drawdowns'] } }
  | { action: 'approve'; values: { synced: true } }
  | { action: 'withdraw' | 'lock'; values: Record<string, never> };
export const moneyDateResult = z.object({ period_id: z.uuid(), locked: z.boolean() });
