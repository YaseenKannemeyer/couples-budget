import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { cacheRaw, readCached } from '@/features/quick-log/local';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

import { categoryRow, paidInput, paymentInput, recordRow, scheduleRow, type PaymentInput } from './schema';

const workspaceSchema = z.object({ schedules: z.array(scheduleRow), categories: z.array(categoryRow) });

const key = (householdId: string | undefined, userId: string | undefined) => ['payments', householdId, userId] as const;

export function usePaymentWorkspace(householdId: string | undefined) {
  const { session, accountId } = useSession();
  const userId = accountId;
  const subscriptionId = useId();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: key(householdId, userId), enabled: !!session && !!householdId && !!userId,
    initialData: () => householdId && userId ? readCached(`payment-catalogue:v1:${userId}:${householdId}`, workspaceSchema) : undefined,
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_payment_workspace', { p_household_id: householdId! });
      if (error) throw error;
      const value = workspaceSchema.parse(data);
      cacheRaw(`payment-catalogue:v1:${userId}:${householdId}`, data);
      return value;
    },
  });
  useEffect(() => {
    if (!householdId || !userId || !session) return;
    const refresh = () => Promise.all([
      queryClient.invalidateQueries({ queryKey: key(householdId, userId) }),
      queryClient.invalidateQueries({ queryKey: ['payment-history', householdId, userId] }),
    ]);
    const channel = supabase.channel(`payments:${householdId}:${userId}:${subscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scheduled_payments', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payment_records', filter: `household_id=eq.${householdId}` }, refresh)
      .subscribe();
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') void refresh(); });
    return () => { appState.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, subscriptionId, queryClient, session]);
  return query;
}

export type PaymentWorkspace = NonNullable<ReturnType<typeof usePaymentWorkspace>['data']>;

export function usePaymentHistory(householdId: string | undefined, scheduleRef?: string) {
  const { session, accountId } = useSession();
  const userId = accountId;
  return useInfiniteQuery({
    queryKey: ['payment-history', householdId, userId, scheduleRef], enabled: !!session && !!householdId && !!userId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase.from('payment_records').select('*').eq('household_id', householdId!)
        .order('paid_on', { ascending: false }).order('id', { ascending: false }).range(pageParam, pageParam + 49);
      if (scheduleRef) request = request.eq('schedule_ref', scheduleRef);
      const { data, error } = await request;
      if (error) throw error;
      return data.map((row) => recordRow.parse(row));
    },
    getNextPageParam: (page, pages) => page.length === 50 ? pages.length * 50 : undefined,
  });
}

type Action =
  | { kind: 'save'; id: string | null; version: number | null; value: PaymentInput }
  | { kind: 'status'; id: string; version: number; status: 'active' | 'paused' | 'archived' }
  | { kind: 'delete'; id: string; version: number }
  | { kind: 'paid'; value: z.infer<typeof paidInput> };

export function usePaymentAction(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: Action) => {
      let result;
      switch (action.kind) {
        case 'save':
          result = await supabase.rpc('save_scheduled_payment', { p_household_id: householdId, p_id: action.id,
            p_version: action.version, p_values: paymentInput.parse(action.value) });
          break;
        case 'status':
          result = await supabase.rpc('set_scheduled_payment_status', { p_id: action.id, p_version: action.version, p_status: action.status });
          break;
        case 'delete':
          result = await supabase.rpc('delete_scheduled_payment', { p_id: action.id, p_version: action.version });
          break;
        case 'paid': {
          const value = paidInput.parse(action.value);
          result = await supabase.rpc('mark_scheduled_payment_paid', { p_id: value.id, p_version: value.version,
            p_due_start: value.dueStart, p_amount_minor: value.amountMinor, p_paid_on: value.paidOn,
            p_paid_by: value.paidBy, p_create_transaction: value.createTransaction });
        }
      }
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cashflow', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['payments', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['payment-history', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['transactions', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['allowance-balances', householdId] }),
    ]),
  });
}
