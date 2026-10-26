import { z } from 'zod';

export const MAX_BUDGET_MINOR = 1_000_000_000_000;
const amount = z.number().int().min(0).max(MAX_BUDGET_MINOR);
const name = z.string().trim().min(1).max(80);

export const cadenceSchema = z.enum(['monthly', 'weekly', 'biweekly', 'irregular']);
export type Cadence = z.infer<typeof cadenceSchema>;

/** Reject impossible dates as well as ambiguous locale-specific date strings. */
export function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export const costInput = z.object({ id: z.uuid().optional(), name, amountMinor: amount.positive() });
export const costsInput = z.array(costInput).max(50).refine(
  (costs) => costs.reduce((sum, cost) => sum + cost.amountMinor, 0) <= MAX_BUDGET_MINOR
);
export const allowancesInput = z.array(z.object({ userId: z.uuid(), amountMinor: amount })).min(1).max(2);
export const sourceInput = z.object({
  id: z.uuid().optional(),
  name,
  cadence: cadenceSchema,
  amountMinor: amount.nullable(),
  nextPayday: z.string().refine(isCalendarDate).nullable(),
}).refine((source) => source.cadence === 'irregular' ||
  (source.amountMinor !== null && source.nextPayday !== null));
export const sourcesInput = z.array(sourceInput).min(1).max(10).refine(
  (sources) => sources.reduce((sum, source) => sum + (source.amountMinor ?? 0), 0) <= MAX_BUDGET_MINOR
);
export const incomeInput = z.object({
  amountMinor: amount,
  splitMode: z.enum(['proportional', 'equal', 'combined']),
});

export const costRow = z.object({
  id: z.uuid(), name: z.string(), amount_minor: z.coerce.number().int(), sort_order: z.number(),
}).transform((row) => ({ id: row.id, name: row.name, amountMinor: row.amount_minor }));
export const sourceRow = z.object({
  id: z.uuid(), name: z.string(), cadence: cadenceSchema,
  amount_minor: z.coerce.number().int().nullable(), next_payday: z.string().nullable(), sort_order: z.number(),
}).transform((row) => ({
  id: row.id, name: row.name, cadence: row.cadence,
  amountMinor: row.amount_minor, nextPayday: row.next_payday,
}));

export type CostInput = z.infer<typeof costInput>;
export type SourceInput = z.infer<typeof sourceInput>;
