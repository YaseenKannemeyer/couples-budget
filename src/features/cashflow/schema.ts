import { z } from 'zod';
import { isCalendarDate, MAX_BUDGET_MINOR } from '@/features/budget/schema';
import { categoryRow } from '@/features/categories/schema';
const date = z.string().refine(isCalendarDate);
const money = z.coerce.number().int().min(-MAX_BUDGET_MINOR).max(MAX_BUDGET_MINOR);
export const balanceRow = z.object({ as_of_on: date, amount_minor: money, low_threshold_minor: money, version: z.number().int() });
export const source = z.object({ id: z.uuid(), name: z.string(), cadence: z.enum(['monthly','weekly','biweekly','irregular']),
  amount_minor: money.nullable(), next_payday: date.nullable(), shared_amount_minor: money, shared_delay_days: z.number().int(), version: z.number().int() });
export const occurrence = z.object({ id: z.uuid(), name: z.string(), expected_on: date.nullable(), expected_amount_minor: money.nullable(),
  status: z.enum(['expected','received','dismissed']), actual_on: date.nullable(), actual_amount_minor: money.nullable(),
  shared_on: date.nullable(), shared_amount_minor: money, shared_received: z.boolean(), version: z.number().int(), overridden: z.boolean() });
export const ownIncome = z.object({ sources: z.array(source), occurrences: z.array(occurrence) });
export const workspace = z.object({ today: date, balance: balanceRow.nullable(),
  income: z.array(z.object({ on_date: date, confirmed: z.boolean(), amount_minor: z.coerce.number().int().nonnegative() })),
  payments: z.array(z.object({ id: z.uuid(), name: z.string(), category_id: z.uuid(), recurrence: z.enum(['one_time','monthly']),
    due_start: date, due_end: date, anchor_start_day: z.number().int(), anchor_end_day: z.number().int(), estimate_minor: money.nullable() })),
  transactions: z.array(z.object({ id: z.uuid(), name: z.string().nullable(), on_date: date, category_id: z.uuid(), amount_minor: money })),
  categories: z.array(categoryRow),
  budgets: z.array(z.object({ id: z.uuid(), name: z.string(), amount_minor: money, category_id: z.uuid().nullable(), version: z.number().int() })),
  goals: z.array(z.object({ id: z.uuid(), name: z.string(), category_id: z.uuid(), due_on: date, amount_minor: money, version: z.number().int() })),
  overrides: z.array(z.object({ item_key: z.string(), due_on: date.nullable(), amount_minor: money.nullable(), dismissed: z.boolean(), version: z.number().int() })),
});
export type Workspace = z.output<typeof workspace>;
export type OwnIncome = z.output<typeof ownIncome>;
export type Occurrence = z.output<typeof occurrence>;
