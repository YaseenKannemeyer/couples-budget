import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { randomUUID } from 'expo-crypto';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId, useRef } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { moneyDateWorkspace, moneyDateResult, type MoneyDateAction, type MoneyDateWorkspace } from './schema';

const monthSplit = z.object({ month_on: z.string(), mode: z.enum(['equal', 'proportional', 'combined']), temporary: z.boolean() });
export function useMoneyDate(householdId?: string, month?: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  const client = useQueryClient();
  const id = useId();
  const refresh = useCallback(() => client.invalidateQueries({ queryKey: ['money-date', householdId, userId] }), [client, householdId, userId]);
  const query = useQuery({
    queryKey: ['money-date', householdId, userId, month], enabled: !!householdId && !!userId,
    initialData: () => {
      if (!month) return undefined;
      const prior = client.getQueryData<MoneyDateWorkspace>(['money-date', householdId, userId, undefined]);
      return prior?.period.starts_on === month ? prior : undefined;
    },
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_money_date', { p_household_id: householdId!, p_month: month ?? null });
      if (error) throw error;
      return moneyDateWorkspace.parse(data);
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
    const channel = supabase.channel(`money-date:${householdId}:${userId}:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, refresh).subscribe();
    const state = AppState.addEventListener('change', value => { if (value === 'active') void refresh(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, id, refresh]);
  return query;
}

type Attempt = { key: string; requestId: string; token: string };
export function useMoneyDateAction(householdId: string, userId: string) {
  const client = useQueryClient();
  const attempt = useRef<Attempt | null>(null);
  return useMutation({
    mutationFn: async (input: MoneyDateAction & { token: string; month: string }) => {
      const key = JSON.stringify([householdId, userId, input.month, input.action, input.values]);
      // Keep the original review token and request ID after an uncertain response,
      // even if a background refresh already observed the committed result.
      if (attempt.current?.key !== key) attempt.current = { key, requestId: randomUUID(), token: input.token };
      const sent = attempt.current;
      const { data, error } = await supabase.rpc('apply_money_date', {
        p_household_id: householdId, p_actor_id: userId, p_request_id: sent.requestId,
        p_month: input.month, p_token: sent.token, p_action: input.action, p_values: input.values,
      });
      if (error) {
        // These are definitive server rejections; a refreshed comparison can be
        // explicitly resubmitted. Network/unknown errors keep the same request.
        if (/^Money Date (changed|unavailable|not ready|request changed)$|^Budget period locked$|^Invalid Money Date input$/.test(error.message)) attempt.current = null;
        throw error;
      }
      if (attempt.current === sent) attempt.current = null;
      return moneyDateResult.parse(data);
    },
    onSuccess: () => Promise.all(['money-date', 'cashflow', 'dashboard', 'allowance-balances', 'goals', 'household', 'budget-setup', 'month-split'].map(key =>
      client.invalidateQueries({ queryKey: key === 'household' ? [key] : [key, householdId] }))),
  });
}

export function useMonthSplit(householdId?: string) {
  const { session } = useSession();
  return useQuery({ queryKey: ['month-split', householdId, session?.user.id], enabled: !!householdId && !!session,
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_month_split', { p_household_id: householdId! });
      if (error) throw error;
      return monthSplit.parse(data);
    },
  });
}
