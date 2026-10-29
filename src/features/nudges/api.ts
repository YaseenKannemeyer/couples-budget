import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { randomUUID } from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { devicePushToken, onPushTokenChange, onReminderResponse, pushAvailable, reminderDeviceId } from './device';
import { nudgeSettings, preferenceValues, type PreferenceValues } from './schema';
export function useNudgeSettings(householdId?:string) {
 const {session}=useSession();const userId=session?.user.id;
 const query=useQuery({queryKey:['nudges',householdId,userId],enabled:!!householdId&&!!userId,
  queryFn:async()=>{const {data,error}=await supabase.rpc('get_nudge_settings',{p_household_id:householdId!,p_actor_id:userId!});if(error)throw error;return nudgeSettings.parse(data);}});
 const {refetch}=query;
 useFocusEffect(useCallback(()=>{if(householdId&&userId)void refetch();},[householdId,userId,refetch]));
 return query;
}
export function useSaveNudgeSettings(householdId:string,userId:string) {
 const client=useQueryClient();const attempt=useRef<{key:string;id:string;revision:number}|null>(null);
 return useMutation({mutationFn:async(input:{revision:number;values:PreferenceValues})=>{
  const values=preferenceValues.parse(input.values);const key=JSON.stringify([householdId,userId,values]);
  if(attempt.current?.key!==key)attempt.current={key,id:randomUUID(),revision:input.revision};
  const sent=attempt.current;const {error}=await supabase.rpc('save_nudge_preferences',{p_household_id:householdId,p_actor_id:userId,p_revision:sent.revision,p_request_id:sent.id,p_values:values});
  if(error){if(/^(Reminders changed|Reminders unavailable|Invalid reminder input|Register reminder device)$/.test(error.message))attempt.current=null;throw error;}
  if(attempt.current===sent)attempt.current=null;
 },onSuccess:()=>client.invalidateQueries({queryKey:['nudges',householdId,userId]})});
}
export async function registerReminderDevice(householdId:string,userId:string,ask:boolean) {
 const token=await devicePushToken(ask);const device=reminderDeviceId(true);
 if(!token||!device)throw new Error('Reminder permission unavailable');
 const {error}=await supabase.rpc('register_nudge_device',{p_household_id:householdId,p_actor_id:userId,p_device_id:device,p_token:token});if(error)throw error;
}
export async function unregisterReminderDevice(userId:string) {
 const device=reminderDeviceId();if(!device)return;
 const {error}=await supabase.rpc('unregister_nudge_device',{p_actor_id:userId,p_device_id:device});if(error)throw error;
}
/** Foreground refresh never asks permission or takes over a different device. */
export function useNudgeSync(householdId?:string) {
 const {session}=useSession();const userId=session?.user.id;const settings=useNudgeSettings(pushAvailable?householdId:undefined);
 const active=useRef(userId);useLayoutEffect(()=>{active.current=userId;},[userId]);
 useEffect(()=>{
  if(!pushAvailable||!householdId||!userId||!settings.data?.preferences.enabled||settings.data.device_id!==reminderDeviceId())return;
  let live=true;let running=false;
  const refresh=async()=>{if(running||!live||active.current!==userId)return;running=true;
   try {const token=await devicePushToken(false);if(!live||active.current!==userId)return;
    if(token){const {error}=await supabase.rpc('register_nudge_device',{p_household_id:householdId,p_actor_id:userId,p_device_id:reminderDeviceId(),p_token:token});if(error)throw error;}
    else await unregisterReminderDevice(userId);
   }catch{/* The explicit Settings action exposes retryable registration errors. */}finally{running=false;}
  };
  void refresh();const changed=AppState.addEventListener('change',state=>{if(state==='active')void refresh();});const tokens=onPushTokenChange(()=>void refresh());
  return ()=>{live=false;changed.remove();tokens();};
 },[householdId,userId,settings.data?.preferences.enabled,settings.data?.device_id]);
 useEffect(()=>{
  if(!userId||!householdId||!pushAvailable)return;
  return onReminderResponse(kind=>{
   if(active.current!==userId)return;
   if(kind==='nudge-payment')router.push('/payments');
   else if(kind==='nudge-money_date')router.push('/money-date');
   else if(kind==='nudge-low_balance')router.push('/cash-flow');
   else if(kind==='nudge-unlogged')router.push('/quick-log');
  });
 },[userId,householdId]);
}
