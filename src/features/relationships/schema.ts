import { z } from 'zod';
import { isCalendarDate } from '@/features/budget/schema';
import { goalMoney } from '@/features/goals/schema';
const date = z.string().refine(isCalendarDate);
export const boosterWorkspace = z.object({
  today: date, next_week_on: date, token: z.string(),
  budgets: z.array(z.object({ category_id: z.uuid(), starts_on: date, amount_minor: goalMoney, version: z.number().int() })),
  candidates: z.array(z.object({ category_id: z.uuid(), name: z.string().nullable(), starter_key: z.string().nullable(),
    week_on: date, amount_minor: goalMoney, spent_minor: goalMoney, claimed_minor: goalMoney, available_minor: goalMoney,
    locked: z.boolean().optional() })),
});
export type BoosterWorkspace = z.infer<typeof boosterWorkspace>;
export type BoosterAction = { token: string } & (
  | { action: 'budget'; values: { categoryId: string; weekOn: string; amountMinor: number; version: number } }
  | { action: 'boost'; values: { categoryId: string; weekOn: string; amountMinor: number; goalId: string; goalVersion: number } }
);
export const billModes = ['equal', 'income', 'percentage', 'fixed', 'custom'] as const;
export const billMode = z.enum(billModes);
export type BillMode = z.infer<typeof billMode>;
export const billShare = z.object({ user_id: z.uuid(), amount_minor: goalMoney });
export const billWeight = z.object({ userId: z.uuid(), weight: goalMoney });
export const billWorkspace = z.object({ token: z.string(), today: date, locked: z.boolean(), stale: z.boolean(),
  expense: z.object({ id: z.uuid(), description: z.string(), amount_minor: goalMoney, occurred_on: date, paid_by: z.uuid() }),
  members: z.array(z.object({ user_id: z.uuid(), display_name: z.string(), income_minor: goalMoney, setup_step: z.number().int() })),
  default_mode: z.enum(['equal', 'income']), default_ready: z.boolean(), default_shares: z.array(billShare),
  saved: z.object({ mode: billMode, weights: z.array(billWeight), shares: z.array(billShare), amount_minor: goalMoney, version: z.number().int() }).nullable(),
});
export type BillWorkspace = z.infer<typeof billWorkspace>;
export type BillAction = { token: string; mode: BillMode; weights: z.infer<typeof billWeight>[] };
export const relationshipResult = z.object({ saved: z.literal(true), id: z.uuid().optional(), completed: z.boolean().optional(), shares: z.array(billShare).optional() });
