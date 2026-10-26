import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

import { classificationInput, expenseRow } from './schema';

export function useExpenses(householdId: string | undefined, visibility: 'shared' | 'private') {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const subscriptionId = useId();
  const query = useInfiniteQuery({
    queryKey: ['expenses', householdId, userId, visibility], enabled: !!householdId && !!userId,
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let request = supabase.from(visibility === 'shared' ? 'shared_transactions' : 'private_transactions')
        .select('*').eq('household_id', householdId!).order('occurred_on', { ascending: false }).order('id', { ascending: false }).range(pageParam, pageParam + 49);
      if (visibility === 'private') request = request.eq('owner_id', userId!);
      const { data, error } = await request;
      if (error) throw error;
      return data.map((row) => expenseRow.parse(row));
    },
    getNextPageParam: (page, pages) => page.length === 50 ? pages.length * 50 : undefined,
  });
  useEffect(() => {
    if (!householdId || !userId) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['expenses', householdId, userId] });
    const channel = supabase.channel(`expenses:${householdId}:${userId}:${visibility}:${subscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: visibility === 'shared' ? 'shared_transactions' : 'private_transactions',
        filter: `household_id=eq.${householdId}` }, refresh).subscribe();
    const state = AppState.addEventListener('change', (value) => { if (value === 'active') void refresh(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, visibility, queryClient, subscriptionId]);
  return query;
}

export function useExpense(householdId: string | undefined, visibility: 'shared' | 'private', id: string | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['expenses', householdId, userId, visibility, id], enabled: !!householdId && !!userId && !!id,
    queryFn: async () => {
      let request = supabase.from(visibility === 'shared' ? 'shared_transactions' : 'private_transactions')
        .select('*').eq('household_id', householdId!).eq('id', id!);
      if (visibility === 'private') request = request.eq('owner_id', userId!);
      const { data, error } = await request.maybeSingle();
      if (error) throw error;
      return data ? expenseRow.parse(data) : null;
    },
  });
}

export function useClassifyExpense(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: z.infer<typeof classificationInput>) => {
      const value = classificationInput.parse(input);
      const { error } = await supabase.rpc('classify_expense', { p_household_id: householdId, p_visibility: value.visibility,
        p_id: value.id, p_version: value.version, p_category_id: value.categoryId, p_frequency: value.frequency });
      if (error) throw error;
    },
    onSuccess: () => Promise.all([queryClient.invalidateQueries({ queryKey: ['expenses', householdId] }),queryClient.invalidateQueries({ queryKey: ['cashflow', householdId] })]),
  });
}
