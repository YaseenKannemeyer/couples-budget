import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useId } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { ownIncome, workspace } from './schema';

export function useCashflow(householdId?: string, today?: string) {
  const { session }=useSession();
  const userId=session?.user.id; const client=useQueryClient(); const id=useId();
  const query=useQuery({queryKey:['cashflow',householdId,userId,today],enabled:!!householdId&&!!userId,
    queryFn:async()=>{const {data,error}=await supabase.rpc('get_cashflow',{p_household_id:householdId!});if(error)throw error;return workspace.parse(data);}});
  useEffect(()=>{
    if(!householdId||!userId)return;
    const refresh=()=>client.invalidateQueries({queryKey:['cashflow',householdId,userId]});
    let channel=supabase.channel(`cashflow:${householdId}:${userId}:${id}`);
    for(const table of ['cashflow_balances','cashflow_budget_links','cashflow_goal_plans','cashflow_overrides','shared_transactions','scheduled_payments','payment_records','budget_costs','categories'])
      channel=channel.on('postgres_changes',{event:'*',schema:'public',table,filter:`household_id=eq.${householdId}`},refresh);
    channel=channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'households',filter:`id=eq.${householdId}`},refresh).subscribe();
    const state=AppState.addEventListener('change',s=>{if(s==='active')void refresh();});
    return()=>{state.remove();void supabase.removeChannel(channel);};
  },[householdId,userId,id,client]);
  return query;
}
export function useMyIncome(householdId?:string) {
  const {session}=useSession();
  const client=useQueryClient();
  useEffect(()=>{
    const state=AppState.addEventListener('change',s=>{if(s==='active')void client.invalidateQueries({queryKey:['own-income',householdId,session?.user.id]});});
    return()=>state.remove();
  },[householdId,session?.user.id,client]);
  return useQuery({refetchOnMount:'always',refetchInterval:60_000,queryKey:['own-income',householdId,session?.user.id],enabled:!!householdId&&!!session,
    queryFn:async()=>{const {data,error}=await supabase.rpc('get_my_income',{p_household_id:householdId!});if(error)throw error;return ownIncome.parse(data);}});
}
type Action =
  | {kind:'balance';version:number;on:string;amount:number;threshold:number}
  | {kind:'contribution';id:string;version:number;amount:number;delay:number}
  | {kind:'occurrence';id:string|null;version:number;values:Record<string,unknown>}
  | {kind:'plan';type:'budget'|'goal';id:string|null;version:number;values:Record<string,unknown>|null}
  | {kind:'override';key:string;version:number;values:Record<string,unknown>|null};
export function useCashflowAction(householdId:string) {
  const client=useQueryClient();
  return useMutation({mutationFn:async(a:Action)=>{
    let result;
    switch(a.kind){
      case 'balance':result=await supabase.rpc('save_cashflow_balance',{p_household_id:householdId,p_version:a.version,p_as_of_on:a.on,p_amount_minor:a.amount,p_threshold_minor:a.threshold});break;
      case 'contribution':result=await supabase.rpc('save_income_contribution',{p_household_id:householdId,p_id:a.id,p_version:a.version,p_amount_minor:a.amount,p_delay_days:a.delay});break;
      case 'occurrence':result=await supabase.rpc('save_income_occurrence',{p_household_id:householdId,p_id:a.id,p_version:a.version,p_values:a.values});break;
      case 'plan':result=await supabase.rpc('save_cashflow_plan',{p_household_id:householdId,p_kind:a.type,p_id:a.id,p_version:a.version,p_values:a.values});break;
      case 'override':result=await supabase.rpc('save_cashflow_override',{p_household_id:householdId,p_key:a.key,p_version:a.version,p_values:a.values});break;
    }
    if(result.error)throw result.error;return result.data;
  },onSuccess:()=>Promise.all(['cashflow','own-income','budget-setup'].map(key=>client.invalidateQueries({queryKey:[key,householdId]})))});
}
