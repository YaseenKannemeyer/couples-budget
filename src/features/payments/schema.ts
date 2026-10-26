import { z } from 'zod';

import { isCalendarDate, MAX_BUDGET_MINOR } from '@/features/budget/schema';
import { categoryRow } from '@/features/categories/schema';

export { categoryRow } from '@/features/categories/schema';

export const visibilitySchema = z.enum(['shared', 'private']);
export const recurrenceSchema = z.enum(['one_time', 'monthly']);
const money = z.number().int().positive().max(MAX_BUDGET_MINOR);
const date = z.string().refine(isCalendarDate);

export const paymentInput = z.object({
  name: z.string().trim().min(1).max(80),
  expectedAmountMinor: money.nullable(),
  payerId: z.uuid(),
  visibility: visibilitySchema,
  categoryId: z.uuid(),
  note: z.string().trim().max(500).nullable(),
  recurrence: recurrenceSchema,
  dateMode: z.enum(['exact', 'window']),
  dueStart: date,
  dueEnd: date,
  reminderDaysBefore: z.number().int().min(0).max(30).nullable(),
}).refine((value) => value.dueEnd >= value.dueStart && (value.dateMode === 'window' || value.dueStart === value.dueEnd) &&
  (value.recurrence !== 'monthly' || value.dueStart.slice(0, 7) === value.dueEnd.slice(0, 7)));

export const paidInput = z.object({
  id: z.uuid(), version: z.number().int().positive(), dueStart: date,
  amountMinor: money, paidOn: date, paidBy: z.uuid(), createTransaction: z.boolean(),
});

export const scheduleRow = z.object({
  id: z.uuid(), household_id: z.uuid(), owner_id: z.uuid(), payer_id: z.uuid(),
  visibility: visibilitySchema, name: z.string(), expected_amount_minor: z.coerce.number().int().nullable(),
  category_id: z.uuid(), note: z.string().nullable(), recurrence: recurrenceSchema,
  date_mode: z.enum(['exact', 'window']),
  due_start: date, due_end: date, anchor_start_day: z.number().int(), anchor_end_day: z.number().int(),
  reminder_days_before: z.number().int().nullable(), status: z.enum(['active', 'paused', 'archived', 'completed']),
  version: z.number().int(), estimate_minor: z.coerce.number().int().nullable(), paid_this_month: z.boolean(),
  recent_amounts: z.array(z.object({ amount_minor: z.coerce.number().int(), paid_on: date })),
}).transform((row) => ({
  id: row.id, householdId: row.household_id, ownerId: row.owner_id, payerId: row.payer_id,
  visibility: row.visibility, name: row.name, expectedAmountMinor: row.expected_amount_minor,
  categoryId: row.category_id, note: row.note, recurrence: row.recurrence, dueStart: row.due_start, dueEnd: row.due_end,
  dateMode: row.date_mode,
  anchorStartDay: row.anchor_start_day, anchorEndDay: row.anchor_end_day,
  reminderDaysBefore: row.reminder_days_before, status: row.status, version: row.version,
  estimateMinor: row.estimate_minor, paidThisMonth: row.paid_this_month,
  recentAmounts: row.recent_amounts.map((value) => ({ amountMinor: value.amount_minor, paidOn: value.paid_on })),
}));

export const recordRow = z.object({
  id: z.uuid(), schedule_id: z.uuid().nullable(), schedule_ref: z.uuid(), owner_id: z.uuid(), payer_id: z.uuid(),
  visibility: visibilitySchema, name: z.string(), category_name: z.string(), note: z.string().nullable(),
  recurrence: recurrenceSchema, cycle_on: date, due_start: date, due_end: date,
  expected_amount_minor: z.coerce.number().int().nullable(), amount_minor: z.coerce.number().int(), paid_on: date,
  shared_transaction_id: z.uuid().nullable(), private_transaction_id: z.uuid().nullable(),
}).transform((row) => ({
  id: row.id, scheduleId: row.schedule_id, scheduleRef: row.schedule_ref, ownerId: row.owner_id, payerId: row.payer_id,
  visibility: row.visibility, name: row.name, categoryName: row.category_name, note: row.note,
  recurrence: row.recurrence, cycleOn: row.cycle_on, dueStart: row.due_start, dueEnd: row.due_end,
  expectedAmountMinor: row.expected_amount_minor, amountMinor: row.amount_minor, paidOn: row.paid_on,
  transactionId: row.shared_transaction_id ?? row.private_transaction_id,
}));

export type PaymentInput = z.infer<typeof paymentInput>;
export type Schedule = z.output<typeof scheduleRow>;
export type PaymentRecord = z.output<typeof recordRow>;
export type PaymentCategory = z.infer<typeof categoryRow>;
