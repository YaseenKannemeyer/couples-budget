import { z } from 'zod';
import { isCalendarDate, MAX_BUDGET_MINOR } from '@/features/budget/schema';
import { isValidCurrency, minorUnitDigits } from '@/lib/money';

const money = z.number().int().positive().max(MAX_BUDGET_MINOR);
const date = z.string().refine(isCalendarDate);
const expenseContent = z.object({
  visibility: z.enum(['shared', 'private']), amountMinor: money,
  categoryId: z.uuid(), frequency: z.enum(['one_time', 'monthly']), paidBy: z.uuid(),
  description: z.string().trim().min(1).max(120), note: z.string().trim().max(500).nullable(), occurredOn: date,
  originalCurrency: z.string().refine(isValidCurrency).nullable(), originalAmountMinor: money.nullable(),
  fxRate: z.string().regex(/^\d+(\.\d{1,10})?$/).refine(v => Number(v) > 0 && Number(v) < 1e10).nullable(),
  scheduleId: z.uuid().nullable(), scheduleVersion: z.number().int().positive().nullable(), scheduleDueStart: date.nullable(),
  receipt: z.boolean(),
}).refine(v => v.originalCurrency ? v.originalAmountMinor !== null && v.fxRate !== null : v.originalAmountMinor === null && v.fxRate === null)
  .refine(v => v.scheduleId ? v.scheduleVersion !== null && v.scheduleDueStart !== null : v.scheduleVersion === null && v.scheduleDueStart === null);
export const quickLogInput = expenseContent.safeExtend({ baseCurrency: z.string().refine(isValidCurrency) });
export type QuickLogInput = z.infer<typeof quickLogInput>;
export const logResult = z.object({ transactionId: z.uuid(), visibility: z.enum(['shared', 'private']), scheduleRef: z.uuid().nullable(), receiptPath: z.string().nullable() });
export type LogResult = z.infer<typeof logResult>;
// Older device drafts without currency context remain readable and require review.
const persistedInput = expenseContent.safeExtend({ baseCurrency: z.string().refine(isValidCurrency).optional() });
export const queuedLog = z.object({
  id: z.uuid(), userId: z.uuid(), householdId: z.uuid(), values: persistedInput, createdAt: z.number(),
  status: z.enum(['pending', 'blocked', 'receipt_pending', 'synced']),
  reason: z.enum(['network', 'review', 'receipt']).nullable(), result: logResult.nullable(),
});
export type QueuedLog = z.infer<typeof queuedLog>;

// The explicitly entered base amount is authoritative. This rate is provenance,
// not an automatic FX quote or a floating-point conversion of the expense.
export function recordedRate(baseMinor: number, baseCurrency: string, originalMinor: number, originalCurrency: string) {
  const value = baseMinor / originalMinor * 10 ** (minorUnitDigits(originalCurrency) - minorUnitDigits(baseCurrency));
  return Number.isFinite(value) && value > 0 && value < 1e10 ? value.toFixed(10) : null;
}
