import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useRef } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { reconciliationWorkspace, type ReconciliationAction } from './schema';

export function useReconciliation(householdId?: string, on?: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  const client = useQueryClient();
  const id = useId();
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: ['reconciliation', householdId, userId] }), [client, householdId, userId]);
  const query = useQuery({
    queryKey: ['reconciliation', householdId, userId, on], enabled: !!householdId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_reconciliation', { p_household_id: householdId!, p_on: on ?? null });
      if (error) throw error;
      return reconciliationWorkspace.parse(data);
    },
  });
  useFocusEffect(useCallback(() => {
    if (!householdId || !userId) return;
    void refresh();
    const timer = setInterval(() => void refresh(), 30_000);
    return () => clearInterval(timer);
  }, [householdId, userId, refresh]));
  useEffect(() => {
    if (!householdId || !userId) return;
    const channel = supabase.channel(`reconciliation:${householdId}:${userId}:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, refresh).subscribe();
    const state = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, id, refresh]);
  return query;
}

type Attempt = { key: string; requestId: string; revision: number };
export function useReconciliationAction(householdId: string, userId: string) {
  const client = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  return useMutation({
    mutationFn: async (input: ReconciliationAction & { revision: number }) => {
      const key = JSON.stringify([householdId, userId, input.action, input.values]);
      // Keep the original revision and request ID after an uncertain response,
      // even if a background refresh already observed the committed result.
      if (attempt.current?.key !== key) attempt.current = { key, requestId: randomUUID(), revision: input.revision };
      const sent = attempt.current;
      const { data, error } = await supabase.rpc('apply_reconciliation', {
        p_household_id: householdId, p_actor_id: userId, p_request_id: sent.requestId,
        p_revision: sent.revision, p_action: input.action, p_values: input.values,
      });
      if (error) {
        // These are definitive server rejections; a refreshed comparison can be
        // explicitly resubmitted. Network/unknown errors keep the same request.
        if (/^Reconciliation (changed|baseline changed|unavailable|period locked)$|^Invalid reconciliation input$/.test(error.message)) attempt.current = null;
        throw error;
      }
      if (attempt.current === sent) attempt.current = null;
      return data;
    },
    onSuccess: () => Promise.all(['reconciliation', 'cashflow', 'dashboard', 'allowance-balances'].map(key =>
      client.invalidateQueries({ queryKey: [key, householdId] }))),
  });
}
