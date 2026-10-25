import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import {
  createHouseholdInput,
  householdSchema,
  joinHouseholdInput,
  memberSchema,
  type CreateHouseholdInput,
  type JoinHouseholdInput,
} from '@/features/household/schema';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

const householdKey = (userId: string | undefined) => ['household', userId] as const;

/** The signed-in person's household and both partners, or null if they haven't set one up yet. */
export function useMyHousehold() {
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: householdKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data: me, error } = await supabase
        .from('members')
        .select('household:households(*)')
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      if (!me?.household) return null;

      const household = householdSchema.parse(me.household);
      const { data: rows, error: membersError } = await supabase
        .from('members')
        .select('*')
        .eq('household_id', household.id)
        .order('joined_at');
      if (membersError) throw membersError;

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
    if (!householdId) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: householdKey(userId) });
    const channel = supabase
      .channel(`household:${householdId}`)
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
  }, [householdId, userId, queryClient]);

  return query;
}

export function useCreateHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateHouseholdInput) => {
      const values = createHouseholdInput.parse(input);
      const { error } = await supabase.rpc('create_household', {
        p_name: values.name,
        p_base_currency: values.baseCurrency,
        p_timezone: values.timezone,
        p_display_name: values.displayName,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}

export function useJoinHousehold() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: JoinHouseholdInput) => {
      const values = joinHouseholdInput.parse(input);
      const { error } = await supabase.rpc('join_household', {
        p_invite_code: values.inviteCode,
        p_display_name: values.displayName,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}

export function useRegenerateInviteCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (householdId: string) => {
      const { error } = await supabase.rpc('regenerate_invite_code', { p_household_id: householdId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['household'] }),
  });
}
