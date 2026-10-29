import { z } from 'zod';
import { isCalendarDate } from '@/features/budget/schema';
import { categoryRow } from '@/features/categories/schema';
export const goalMoney = z.preprocess(value => typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value, z.number().int().safe());
const date = z.string().refine(isCalendarDate);
export const goalRow = z.object({
  kind: z.enum(['goal', 'sinking']).optional(), id: z.uuid(), name: z.string(), target_minor: goalMoney.refine(n => n > 0), deadline_on: date, starts_on: date,
  category_id: z.uuid(), archived: z.boolean(), version: z.number().int(), created_at: z.string(), saved_minor: goalMoney.refine(n => n >= 0),
  month: z.object({ month_on: date, due_on: date, target_minor: goalMoney.refine(n => n >= 0), split_mode: z.enum(['equal', 'proportional', 'combined']),
    split_ready: z.boolean(), shares: z.array(z.object({ user_id: z.uuid(), target_minor: goalMoney.nullable(), contributed_minor: goalMoney })) }),
  series: z.array(z.object({ month_on: date, amount_minor: goalMoney })),
}).refine(g => g.saved_minor <= g.target_minor);
export const goalWorkspace = z.object({ today: date, revision: z.number().int().nonnegative(), categories: z.array(categoryRow),
  forecast_plans: z.array(z.object({ id: z.uuid(), name: z.string(), category_id: z.uuid(), due_on: date, amount_minor: goalMoney, version: z.number().int() })),
  goals: z.array(goalRow),
});
export const contributionRow = z.object({ id: z.uuid(), contributor_id: z.uuid(), amount_minor: goalMoney,
  source: z.enum(['scheduled', 'booster', 'gift', 'variance']), occurred_on: date, created_at: z.string(), reversed: z.boolean(), reverses_id: z.uuid().nullable() });
export const goalResult = z.object({ id: z.uuid(), completed: z.boolean() });
export type Goal = z.infer<typeof goalRow>;
export type GoalWorkspace = z.infer<typeof goalWorkspace>;
export type Contribution = z.infer<typeof contributionRow>;
export type GoalAction =
  | { action: 'save'; values: { id: string | null; version: number; kind?: 'goal' | 'sinking'; name: string; targetMinor: number; deadlineOn: string; categoryId: string; replacePlanId?: string | null; replacePlanVersion?: number } }
  | { action: 'contribute'; values: { id: string; version: number; amountMinor: number; on: string } }
  | { action: 'gift'; values: { id: string; version: number; amountMinor: number } }
  | { action: 'reverse'; values: { id: string; version: number; contributionId: string } }
  | { action: 'archive'; values: { id: string; version: number; archived: boolean } }
  | { action: 'replan'; values: { id: string; version: number } };
