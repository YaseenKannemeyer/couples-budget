import { z } from 'zod';
import type { supabase } from '@/lib/supabase';
import { nextMonth } from '@/features/cashflow/model';
import { activityRow, allowanceRow, paidRow, type HomeActivity } from './schema';

export async function loadHomeActivity(client: typeof supabase, householdId: string, today: string): Promise<HomeActivity> {
  const month = today.slice(0, 7);
  const [allowances, recent, paid] = await Promise.all([
    client.rpc('allowance_balances', { p_household_id: householdId }),
    client.from('shared_transactions')
      .select('id,description,amount_minor,occurred_on,created_at,paid_by')
      .eq('household_id', householdId).lte('occurred_on', today)
      .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(5),
    client.from('payment_records')
      .select('id,name,amount_minor,paid_on,due_start,due_end,schedule_ref')
      .eq('household_id', householdId).eq('visibility', 'shared')
      .gte('cycle_on', `${month}-01`).lt('cycle_on', `${nextMonth(month)}-01`)
      .lte('paid_on', today)
      .order('paid_on', { ascending: false }).order('id', { ascending: false }).limit(2),
  ]);
  if (allowances.error) throw allowances.error;
  if (recent.error) throw recent.error;
  if (paid.error) throw paid.error;
  return {
    allowances: z.array(allowanceRow).parse(allowances.data),
    recent: z.array(activityRow).parse(recent.data),
    paid: z.array(paidRow).parse(paid.data),
  };

}
