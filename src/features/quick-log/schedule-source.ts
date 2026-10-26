import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
export function useScheduleSource(householdId?: string, id?: string, visibility?: string) {
  const { session } = useSession(); const userId = session?.user.id;
  return useQuery({ queryKey: ['schedule-source', householdId, userId, visibility, id], enabled: !!householdId && !!userId && !!id,
    queryFn: async () => {
      const space = visibility === 'private' ? 'private' : 'shared';
      let request = supabase.from(space === 'shared' ? 'shared_transactions' : 'private_transactions')
        .select('*').eq('household_id', householdId!).eq('id', id!);
      if (space === 'private') request = request.eq('owner_id', userId!);
      const { data, error } = await request.maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Expense unavailable');
      return z.object({ description: z.string(), amount_minor: z.coerce.number().int(), category_id: z.uuid(),
        occurred_on: z.string(), note: z.string().nullable(), paid_by: z.uuid().optional() }).parse(data);
    },
  });
}
