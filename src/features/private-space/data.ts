import { z } from 'zod';
import type { supabase } from '@/lib/supabase';
import type { Schedule } from '@/features/payments/schema';
import { shiftCalendarDays } from '@/features/payments/dates';

const money = z.preprocess(value => typeof value === 'string' && /^-?\d+$/.test(value) ? Number(value) : value,
  z.number().int().safe());
export const ownAllowance = z.object({
  user_id: z.uuid(), allowance_minor: money.refine(value => value >= 0), spent_minor: money, remaining_minor: money,
}).refine(row => Number.isSafeInteger(row.allowance_minor - row.spent_minor) &&
  row.remaining_minor === row.allowance_minor - row.spent_minor);
export type OwnAllowance = z.output<typeof ownAllowance>;

export async function loadOwnAllowance(client: typeof supabase, householdId: string, userId: string): Promise<OwnAllowance> {
  const { data, error } = await client.rpc('allowance_balances', { p_household_id: householdId });
  if (error) throw error;
  // The RPC deliberately exposes partner aggregates. Only retain our own row here.
  const identities = z.array(z.object({ user_id: z.uuid() }).passthrough()).parse(data);
  return ownAllowance.parse(identities.find(row => row.user_id === userId));
}

export function privateUpcoming(schedules: Schedule[], householdId: string, userId: string, today: string) {
  return schedules.filter(s => s.householdId === householdId && s.ownerId === userId &&
    s.visibility === 'private' && s.status === 'active' && s.dueStart <= shiftCalendarDays(today, 90))
    .sort((a, b) => a.dueStart.localeCompare(b.dueStart) || a.dueEnd.localeCompare(b.dueEnd) || a.id.localeCompare(b.id));
}
