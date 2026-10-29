import { z } from 'zod';
import { cacheRaw, readCached } from '@/features/quick-log/local';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useGuideAction } from '@/features/guides/context';
import { useEffect, useId } from 'react';

import {
  createHouseholdInput,
  householdSchema,
  memberSchema,
  invitePreviewSchema,
  reviewedJoinInput,
  type CreateHouseholdInput,
  type JoinHouseholdInput,
} from '@/features/household/schema';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

const householdKey = (userId: string | undefined) => ['household', userId] as const;

const cachedHousehold = z.object({ household: householdSchema, members: z.array(memberSchema) });
function offlineHousehold(userId: string | undefined) {
  if (!userId) return undefined;
  const value = readCached(`household-offline:v1:${userId}`, cachedHousehold);
  const me = value?.members.find(member => member.userId === userId);
  return value && me ? { ...value, me, partner: value.members.find(member => member.userId !== userId) ?? null } : undefined;
}

/** The signed-in person's household and both partners, or null if they haven't set one up yet. */
export function useMyHousehold() {
  const subscriptionId = useId();
  const { session, accountId } = useSession();
  const userId = accountId;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: householdKey(userId),
    enabled: !!session && !!userId,
    initialData: () => offlineHousehold(userId),
    initialDataUpdatedAt: 0,
    queryFn: async () => {
      const { data: me, error } = await supabase
        .from('members')
        .select('household:households(*)')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!me?.household) {
        try { localStorage.removeItem(`household-offline:v1:${userId}`); } catch { /* Storage unavailable. */ }
        return null;
      }

      const household = householdSchema.parse(me.household);
      const { data: rows, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('household_id', household.id)
        .order('joined_at');
      if (membersError) throw membersError;

      cacheRaw(`household-offline:v1:${userId}`, { household: me.household, members: rows });
      const members = rows.map((row) => memberSchema.parse(row));
      return {
        household,
        members,
        me: members.find((m) => m.userId === userId)!,
        partner: members.find((m) => m.userId !== userId) ?? null,
      };
    },
  });

  // Refresh live when the partner joins or either of us changes household settings.
  const householdId = query.data?.household.id;
  useEffect(() => {
    if (!householdId || !userId || !session) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: householdKey(userId) });
    const channel = supabase
      .channel(`household:${householdId}:${subscriptionId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'members', filter: `household_id=eq.${householdId}` },
        refresh
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, userId, queryClient, subscriptionId, session]);

  return query;
}

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  const guideAction = useGuideAction();
  return useMutation({
    mutationFn: async (input: CreateHouseholdInput) => {
      const values = createHouseholdInput.parse(input);
      const { error } = await supabase.rpc('create_household', {
        p_name: values.name,
        p_base_currency: values.baseCurrency,
        p_timezone: values.timezone,
        p_display_name: values.displayName,
      });
      if (error) throw error;
      guideAction('household-connected');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}

export function useJoinHousehold() {
  const queryClient = useQueryClient();
  const guideAction = useGuideAction();
  return useMutation({
    mutationFn: async (input: JoinHouseholdInput & { revision: number; allowanceMinor: number }) => {
      const values = reviewedJoinInput.parse(input);
      const { error } = await supabase.rpc('join_household_reviewed', {
        p_invite_code: values.inviteCode,
        p_display_name: values.displayName,
        p_revision: values.revision,
        p_allowance_minor: values.allowanceMinor,
      });
      if (error) throw error;
      guideAction('household-connected');
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}

export function useInvitePreview(code: string | null, attempt = 0) {
  const { accountId, session } = useSession();
  return useQuery({
    queryKey: ['invite-preview', accountId, code, attempt], enabled: !!session && !!code,
    staleTime: 0, gcTime: 0, retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('preview_household_invite', { p_invite_code: code });
      if (error) throw error;
      return invitePreviewSchema.parse(data);
    },
  });
}

export function useSaveInviteAllowance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { householdId: string; revision: number; amountMinor: number | null }) => {
      const amount = z.number().int().min(0).max(1_000_000_000_000).nullable().parse(input.amountMinor);
      const { error } = await supabase.rpc('save_invite_allowance', {
        p_household_id: input.householdId, p_revision: input.revision, p_amount_minor: amount,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}

export function useRegenerateInviteCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { error } = await supabase.rpc('regenerate_invite_code', { p_household_id: householdId });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}
