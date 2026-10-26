import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { AppState } from 'react-native';

import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

import { categoryInput, categoryRow, type CategoryInput } from './schema';

export function useCategories(householdId: string | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;
  const subscriptionId = useId();
  const queryClient = useQueryClient();
  const queryKey = ['categories', householdId, userId];
  const query = useQuery({
    queryKey, enabled: !!householdId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('household_id', householdId!).order('sort_order').order('id');
      if (error) throw error;
      return data.map((row) => categoryRow.parse(row));
    },
  });
  useEffect(() => {
    if (!householdId || !userId) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: ['categories', householdId, userId] });
    const channel = supabase.channel(`categories:${householdId}:${userId}:${subscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'categories', filter: `household_id=eq.${householdId}` }, refresh).subscribe();
    const state = AppState.addEventListener('change', (value) => { if (value === 'active') void refresh(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [householdId, userId, subscriptionId, queryClient]);
  return query;
}

type CategoryAction =
  | { kind: 'save'; id: string | null; version: number | null; value: CategoryInput }
  | { kind: 'move'; id: string; version: number; direction: -1 | 1 }
  | { kind: 'archive'; id: string; version: number; replacementId: string }
  | { kind: 'restore'; id: string; version: number };

export function useCategoryAction(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (action: CategoryAction) => {
      let result;
      switch (action.kind) {
        case 'save':
          result = await supabase.rpc('save_category', { p_household_id: householdId, p_id: action.id, p_version: action.version,
            p_values: categoryInput.parse(action.value) });
          break;
        case 'move':
          result = await supabase.rpc('move_category', { p_id: action.id, p_version: action.version, p_direction: action.direction });
          break;
        case 'archive':
          result = await supabase.rpc('archive_category', { p_id: action.id, p_version: action.version, p_replacement_id: action.replacementId });
          break;
        case 'restore':
          result = await supabase.rpc('restore_category', { p_id: action.id, p_version: action.version });
      }
      if (result.error) throw result.error;
      return result.data;
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cashflow', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['categories', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['payments', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['expenses', householdId] }),
    ]),
  });
}
