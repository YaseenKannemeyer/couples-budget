import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { z } from 'zod';

import { useSession } from '@/hooks/use-session';
import { householdSchema, memberSchema } from '@/features/household/schema';
import { supabase } from '@/lib/supabase';

import { allowancesInput, costRow, costsInput, incomeInput, sourceRow, sourcesInput } from './schema';

const budgetKey = (householdId: string | undefined, userId: string | undefined) =>
  ['budget-setup', householdId, userId] as const;

export function useBudgetSetup(householdId: string | undefined) {
  const subscriptionId = useId();
  const { session } = useSession();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: budgetKey(householdId, userId),
    enabled: !!householdId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_budget_setup', { p_household_id: householdId! });
      if (error) throw error;
      const result = z.object({
        household: householdSchema, members: z.array(memberSchema),
        month_split: z.object({ month_on: z.string(), mode: z.enum(['equal', 'proportional', 'combined']), temporary: z.boolean() }).optional(),
        costs: z.array(costRow), sources: z.array(sourceRow),
      }).parse(data);
      const me = result.members.find((member) => member.userId === userId);
      if (!me) throw new Error('Not a member of this household');
      return { ...result, me, partner: result.members.find((member) => member.userId !== userId) ?? null };
    },
  });

  useEffect(() => {
    if (!householdId || !userId) return;
    const refresh = () => queryClient.invalidateQueries({ queryKey: budgetKey(householdId, userId) });
    const channel = supabase.channel(`budget-setup:${householdId}:${userId}:${subscriptionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'members', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'households', filter: `id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'budget_costs', filter: `household_id=eq.${householdId}` }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'income_sources', filter: `owner_id=eq.${userId}` }, refresh)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [householdId, userId, queryClient, subscriptionId]);
  return query;
}

export type BudgetSetup = NonNullable<ReturnType<typeof useBudgetSetup>['data']>;

type StepInput =
  | { step: 0; value: z.input<typeof incomeInput> }
  | { step: 1; value: z.input<typeof allowancesInput> }
  | { step: 2; value: z.input<typeof costsInput> }
  | { step: 3; value: z.input<typeof sourcesInput> }
  | { step: 'defer' };

export function useSaveBudgetStep(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: StepInput & { revision: number }) => {
      const params = { p_household_id: householdId, p_revision: input.revision };
      let result;
      switch (input.step) {
        case 'defer':
          result = await supabase.rpc('defer_budget_paydays', params);
          break;
        case 0: {
          const income = incomeInput.parse(input.value);
          result = await supabase.rpc('save_budget_income', {
            ...params, p_income_minor: income.amountMinor, p_split_mode: income.splitMode,
          });
          break;
        }
        case 1:
          result = await supabase.rpc('save_budget_allowances', { ...params, p_allowances: allowancesInput.parse(input.value) });
          break;
        case 2:
          result = await supabase.rpc('save_budget_costs', { ...params, p_costs: costsInput.parse(input.value) });
          break;
        case 3:
          result = await supabase.rpc('save_budget_paydays', { ...params, p_sources: sourcesInput.parse(input.value) });
          break;
      }
      if (result.error) throw result.error;
      return z.number().int().parse(result.data);
    },
    onSuccess: () => Promise.all([
      queryClient.invalidateQueries({ queryKey: ['cashflow', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['own-income', householdId] }),
      queryClient.invalidateQueries({ queryKey: ['household'] }),
      queryClient.invalidateQueries({ queryKey: ['budget-setup', householdId] }),
    ]),
  });
}
