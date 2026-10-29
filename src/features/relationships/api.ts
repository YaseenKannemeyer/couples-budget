import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useRef } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { uncertainDecision } from './decision';
import { billWorkspace, boosterWorkspace, relationshipResult, type BillAction, type BoosterAction } from './schema';

export function useRelationshipWorkspace(householdId?: string, expenseId?: string, kind: 'boosters' | 'bill' = 'boosters') {
  const userId = useSession().session?.user.id;
  const client = useQueryClient();
  const subscriptionId = useId();
  const key = kind === 'bill' ? 'bill-split' : 'boosters';
  const refresh = useCallback(() => { void client.invalidateQueries({ queryKey: [key, householdId, userId] }); }, [client, key, householdId, userId]);
  const query = useQuery({ queryKey: [key, householdId, userId, expenseId], enabled: !!householdId && !!userId && (kind !== 'bill' || !!expenseId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc(kind === 'bill' ? 'get_expense_split' : 'get_boosters', kind === 'bill'
        ? { p_household_id: householdId!, p_transaction_id: expenseId! } : { p_household_id: householdId! });
      if (error) throw error;
      return kind === 'bill' ? billWorkspace.parse(data) : boosterWorkspace.parse(data);
    } });
  useFocusEffect(useCallback(() => {
    if (!householdId || !userId) return;
    refresh(); const timer = setInterval(refresh, 30_000); return () => clearInterval(timer);
  }, [householdId, userId, refresh]));
  useEffect(() => {
    if (!householdId || !userId) return;
    const channel = supabase.channel(`relationships:${key}:${householdId}:${userId}:${subscriptionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, refresh).subscribe();
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, subscriptionId, key, refresh]);
  return query;
}
export function useRelationshipAction(householdId: string, userId: string, expenseId?: string) {
  const client = useQueryClient();
  const attempt = useRef<{ key: string; requestId: string; scope: string; input: BillAction | BoosterAction } | null>(null);
  return useMutation({ mutationFn: async (input: BillAction | BoosterAction) => {
    const key = JSON.stringify([householdId, userId, expenseId, 'mode' in input ? [input.mode, input.weights] : [input.action, input.values]]);
    const scope = JSON.stringify([householdId, userId, expenseId]);
    if (attempt.current?.scope === scope && attempt.current.key !== key) throw new Error('Unresolved goal decision');
    if (attempt.current?.key !== key) attempt.current = { key, requestId: randomUUID(), input, scope };
    const sent = attempt.current;
    const original = sent.input;
    const common = { p_household_id: householdId, p_actor_id: userId, p_request_id: sent.requestId, p_token: original.token };
    const { data, error } = await supabase.rpc('mode' in original ? 'save_expense_split' : 'apply_booster', 'mode' in original
      ? { ...common, p_transaction_id: expenseId!, p_mode: original.mode, p_weights: original.weights }
      : { ...common, p_action: original.action, p_values: original.values });
    if (error) {
      if (!uncertainDecision(error)) attempt.current = null;
      throw error;
    }
    const result = relationshipResult.parse(data);
    if (attempt.current === sent) attempt.current = null;
    return result;
  }, onSuccess: () => Promise.all(['goals', 'goal-history', 'boosters', 'bill-split', 'cashflow', 'dashboard', 'money-date', 'expenses'].map(key => client.invalidateQueries({ queryKey: [key, householdId] }))) });
}
export type RelationshipMutation = ReturnType<typeof useRelationshipAction>;
