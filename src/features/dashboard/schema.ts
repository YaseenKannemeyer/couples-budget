import { z } from 'zod';
import { isCalendarDate } from '@/features/budget/schema';

const money = z.coerce.number().int().safe();
const date = z.string().refine(isCalendarDate);

// Read only the aggregate the existing allowance privacy contract exposes.
export const allowanceRow = z.object({
  user_id: z.uuid(), display_name: z.string(), remaining_minor: money,
});
export const activityRow = z.object({
  id: z.uuid(), description: z.string(), amount_minor: money,
  occurred_on: date, created_at: z.string(), paid_by: z.uuid(),
});
export const paidRow = z.object({
  id: z.uuid(), name: z.string(), amount_minor: money, paid_on: date,
  due_start: date, due_end: date, schedule_ref: z.uuid(),
});
export type HomeActivity = {
  allowances: z.output<typeof allowanceRow>[];
  recent: z.output<typeof activityRow>[];
  paid: z.output<typeof paidRow>[];
};
