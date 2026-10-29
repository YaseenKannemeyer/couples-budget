import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { loadOwnAllowance } from './data';

export function useOwnAllowance(householdId?: string, today?: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  const client = useQueryClient();
  const id = useId();
  const query = useQuery({
    queryKey: ['allowance-balances', householdId, userId, today], enabled: !!householdId && !!userId,
    queryFn: () => loadOwnAllowance(supabase, householdId!, userId!),
  });
  useEffect(() => {
    if (!householdId || !userId) return;
    const refresh = () => client.invalidateQueries({ queryKey: ['allowance-balances', householdId, userId] });
    const channel = supabase.channel(`private-balance:${householdId}:${userId}:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'private_transactions', filter: `owner_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'members', filter: `user_id=eq.${userId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, refresh).subscribe();
    const state = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, client, id]);
  return query;
}

export function usePrivateSpaceRefresh(householdId?: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  const client = useQueryClient();
  useFocusEffect(useCallback(() => {
    if (!householdId || !userId) return;
    const refresh = () => {
      for (const key of ['allowance-balances', 'payments', 'expenses']) {
        void client.invalidateQueries({ queryKey: key === 'expenses'
          ? [key, householdId, userId, 'private'] : [key, householdId, userId] });
      }
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [householdId, userId, client]));
}
