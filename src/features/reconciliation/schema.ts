import { z } from 'zod';
import { isCalendarDate } from '@/features/budget/schema';
import { balanceRow } from '@/features/cashflow/schema';

const date = z.string().refine(isCalendarDate);
const money = z.preprocess(value => typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value,
  z.number().int().safe());
export const checkinRow = z.object({
  id: z.uuid(), as_of_on: date, actual_minor: money,
  baseline_on: date.nullable(), baseline_minor: money.nullable(), baseline_version: z.number().int(),
  expected_minor: money.nullable(), status: z.enum(['pending', 'resolved', 'superseded']),
  resolution: z.enum(['opening', 'matched', 'allowance', 'correction']).nullable(),
  resolved_expected_minor: money.nullable(), resolved_at: z.string().nullable(), created_at: z.string(),
});
export const reconciliationWorkspace = z.object({
  effective_split: z.enum(['equal', 'proportional', 'combined']).optional(),
  today: date, revision: z.number().int().nonnegative(), baseline: balanceRow.nullable(), expected_minor: money.nullable(),
  pending: checkinRow.extend({
    current_expected_minor: money, gap_minor: money, baseline_changed: z.boolean(),
    shares: z.array(z.object({ user_id: z.uuid(), amount_minor: money.refine(value => value > 0), approved_at: z.string().nullable() })),
  }).nullable(),
  history: z.array(checkinRow),
});
export type ReconciliationWorkspace = z.infer<typeof reconciliationWorkspace>;
export type ReconciliationAction =
  | { action: 'check'; values: { on: string; actualMinor: number } }
  | { action: 'allocate'; values: { id: string; shares: { userId: string; amountMinor: number }[] } }
  | { action: 'match' | 'correction' | 'approve' | 'cancel-shares'; values: { id: string } };
