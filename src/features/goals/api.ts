import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useRef } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { uncertainDecision } from '@/features/relationships/decision';
import { contributionRow, goalWorkspace, goalResult, type GoalAction, type Contribution } from './schema';

export function useGoals(householdId?: string) {
  const userId = useSession().session?.user.id;
  const client = useQueryClient();
  const subscriptionId = useId();
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['goals', householdId, userId] });
    void client.invalidateQueries({ queryKey: ['goal-history', householdId, userId] });
  }, [client, householdId, userId]);
  const query = useQuery({ queryKey: ['goals', householdId, userId], enabled: !!householdId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_goals', { p_household_id: householdId! });
      if (error) throw error;
      return goalWorkspace.parse(data);
    } });
  useFocusEffect(useCallback(() => {
    if (!householdId || !userId) return;
    refresh(); const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [householdId, userId, refresh]));
  useEffect(() => {
    if (!householdId || !userId) return;
    const channel = supabase.channel(`goals:${householdId}:${userId}:${subscriptionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, refresh).subscribe();
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, subscriptionId, refresh]);
  return query;
}

type Cursor = Pick<Contribution, 'created_at' | 'id'> | null;
export function useGoalHistory(householdId?: string, goalId?: string) {
  const userId = useSession().session?.user.id;
  return useInfiniteQuery({ queryKey: ['goal-history', householdId, userId, goalId], enabled: !!householdId && !!goalId && !!userId,
    initialPageParam: null as Cursor,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.rpc('get_goal_history', { p_household_id: householdId!, p_goal_id: goalId!,
        p_before_time: pageParam?.created_at ?? null, p_before_id: pageParam?.id ?? null });
      if (error) throw error;
      return z.array(contributionRow).parse(data);
    }, getNextPageParam: page => page.length === 50 ? page[page.length - 1] : undefined });
}

export function useGoalAction(householdId: string, userId: string) {
  const client = useQueryClient();
  const attempt = useRef<{ key: string; requestId: string; revision: number; scope: string } | null>(null);
  return useMutation({ mutationFn: async (input: GoalAction & { revision: number }) => {
    const key = JSON.stringify([householdId, userId, input.action, input.values]);
    const scope = JSON.stringify([householdId, userId]);
    if (attempt.current?.scope === scope && attempt.current.key !== key) throw new Error('Unresolved goal decision');
    if (attempt.current?.key !== key) attempt.current = { key, requestId: randomUUID(), revision: input.revision, scope };
    const sent = attempt.current;
    const { data, error } = await supabase.rpc('apply_goal', { p_household_id: householdId, p_actor_id: userId,
      p_request_id: sent.requestId, p_revision: sent.revision, p_action: input.action, p_values: input.values });
    if (error) {
      if (!uncertainDecision(error)) attempt.current = null;
      throw error;
    }
    const result = goalResult.parse(data);
    if (attempt.current === sent) attempt.current = null;
    return result;
  }, onSuccess: () => Promise.all(['goals', 'goal-history', 'cashflow', 'dashboard', 'allowance-balances', 'money-date', 'boosters'].map(key => client.invalidateQueries({ queryKey: [key, householdId] }))) });
}
