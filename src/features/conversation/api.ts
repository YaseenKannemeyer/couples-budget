import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useId } from 'react';
import { AppState } from 'react-native';
import { z } from 'zod';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { commentBody, commentRow, reactionKind, reactionRow, type ReactionKind } from './schema';

export function useConversation(householdId?: string, transactionId?: string) {
  const { session } = useSession();
  const userId = session?.user.id;
  const client = useQueryClient();
  const id = useId();
  const enabled = !!householdId && !!userId && !!transactionId && z.uuid().safeParse(transactionId).success;
  const base = ['conversation', householdId, userId, transactionId];
  const comments = useInfiniteQuery({ queryKey: [...base, 'comments'], enabled, initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      const { data, error } = await supabase.from('comments').select('*').eq('household_id', householdId!).eq('transaction_id', transactionId!)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).range(pageParam, pageParam + 19);
      if (error) throw error;
      return z.array(commentRow).parse(data);
    }, getNextPageParam: (page, pages) => page.length === 20 ? pages.length * 20 : undefined });
  const reactions = useQuery({ queryKey: [...base, 'reactions'], enabled,
    queryFn: async () => {
      const { data, error } = await supabase.from('reactions').select('household_id,transaction_id,author_id,kind')
        .eq('household_id', householdId!).eq('transaction_id', transactionId!);
      if (error) throw error;
      return z.array(reactionRow).parse(data);
    } });
  const refresh = useCallback(() => {
    void client.invalidateQueries({ queryKey: ['conversation', householdId, userId, transactionId] });
    void client.invalidateQueries({ queryKey: ['expenses', householdId, userId, 'shared', transactionId] });
  }, [client, householdId, userId, transactionId]);
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    refresh(); const timer = setInterval(refresh, 15_000);
    return () => clearInterval(timer);
  }, [enabled, refresh]));
  useEffect(() => {
    if (!enabled) return;
    const channel = supabase.channel(`conversation:${householdId}:${userId}:${transactionId}:${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, refresh).subscribe();
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    return () => { state.remove(); void supabase.removeChannel(channel); };
  }, [enabled, householdId, userId, transactionId, id, refresh]);
  return { comments, reactions, refresh };
}
export type ConversationAction =
  | { kind: 'save'; id: string; version: number; body: string }
  | { kind: 'remove'; id: string; version: number }
  | { kind: 'react'; reaction: ReactionKind; active: boolean };
export function useConversationAction(householdId: string, transactionId: string) {
  const { session } = useSession(); const userId = session?.user.id; const client = useQueryClient();
  return useMutation({ retry: false, mutationFn: async (action: ConversationAction) => {
    if (!userId) throw new Error('Not signed in');
    const context = { p_household_id: householdId, p_transaction_id: z.uuid().parse(transactionId), p_actor_id: userId };
    let result;
    switch (action.kind) {
      case 'save': result = await supabase.rpc('save_transaction_comment', { ...context, p_id: z.uuid().parse(action.id),
        p_version: action.version, p_body: commentBody.parse(action.body) }); break;
      case 'remove': result = await supabase.rpc('remove_transaction_comment', { ...context, p_id: z.uuid().parse(action.id), p_version: action.version }); break;
      case 'react': result = await supabase.rpc('set_transaction_reaction', { ...context, p_kind: reactionKind.parse(action.reaction), p_active: action.active }); break;
    }
    if (result.error) throw result.error;
  }, onSettled: () => client.invalidateQueries({ queryKey: ['conversation', householdId, userId, transactionId] }) });
}
