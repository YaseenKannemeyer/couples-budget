import { z } from 'zod';

export const expenseRow = z.object({
  id: z.uuid(), category_id: z.uuid(), frequency: z.enum(['one_time', 'monthly']),
  scheduled_payment_ref: z.uuid().nullable(), version: z.number().int(),
  amount_minor: z.coerce.number().int(), description: z.string(), occurred_on: z.string(),
}).transform((row) => ({
  id: row.id, categoryId: row.category_id, frequency: row.frequency,
  scheduledPaymentRef: row.scheduled_payment_ref, version: row.version,
  amountMinor: row.amount_minor, description: row.description, occurredOn: row.occurred_on,
}));
export type Expense = z.output<typeof expenseRow>;

export const classificationInput = z.object({
  id: z.uuid(), version: z.number().int().positive(), visibility: z.enum(['shared', 'private']),
  categoryId: z.uuid(), frequency: z.enum(['one_time', 'monthly']),
});
