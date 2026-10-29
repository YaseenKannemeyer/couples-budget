import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useId } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { loadHomeActivity } from './data';

export function useHomeActivity(householdId: string | undefined, today: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  const client = useQueryClient();
  const subscriptionId = useId();
  const query = useQuery({
    queryKey: ['dashboard', householdId, userId, today],
    enabled: !!householdId && !!userId,
    queryFn: () => loadHomeActivity(supabase, householdId!, today),
  });

  // Private transactions never enter this subscription. The deliberate allowance
  // aggregate refreshes every 30 seconds while Home is focused, without publishing
  // private row identities or private activity events to the other partner.
  useFocusEffect(useCallback(() => {
    if (!householdId || !userId) return;
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ['dashboard', householdId, userId] });
      void client.invalidateQueries({ queryKey: ['cashflow', householdId, userId] });
      void client.invalidateQueries({ queryKey: ['household', userId] });
    };
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [householdId, userId, client]));

  useEffect(() => {
    if (!householdId || !userId) return;
    const refresh = () => client.invalidateQueries({ queryKey: ['dashboard', householdId, userId] });
    const channel = supabase.channel(`dashboard:${householdId}:${userId}:${subscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shared_transactions', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_records', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, refresh)
      .subscribe();
    const appState = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, subscriptionId, client]);
  return query;
}
