import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useInvitePreview, useJoinHousehold, useSaveInviteAllowance } from '@/features/household/api';
jest.mock('@/lib/supabase',()=>({supabase:{rpc:jest.fn()}}));
let mockAccount='A';
jest.mock('@/hooks/use-session',()=>({useSession:()=>({accountId:mockAccount,session:mockAccount?{user:{id:mockAccount}}:null})}));
const makeWrapper=()=>{
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:0},mutations:{retry:false,gcTime:0}}});
 return {client,wrapper:({children}:{children:ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>};
};
beforeEach(()=>{mockAccount='A';jest.clearAllMocks();jest.mocked(supabase.rpc).mockResolvedValue({data:null,error:null} as never);});
it('joins through the reviewed RPC with normalized code and the exact approved own allowance',async()=>{
 const {wrapper}=makeWrapper();const {result}=await renderHook(()=>useJoinHousehold(),{wrapper});
 await act(()=>result.current.mutateAsync({inviteCode:'abcd-efgh',displayName:' Sam ',revision:12,allowanceMinor:40000}));
 expect(supabase.rpc).toHaveBeenCalledWith('join_household_reviewed',{p_invite_code:'ABCDEFGH',p_display_name:'Sam',p_revision:12,p_allowance_minor:40000});
});
it('passes explicit zero and null removal proposals without inventing a default',async()=>{
 const {wrapper}=makeWrapper();const {result}=await renderHook(()=>useSaveInviteAllowance(),{wrapper});
 for(const amountMinor of [0,null]){
  await act(()=>result.current.mutateAsync({householdId:'home',revision:10,amountMinor}));
  expect(supabase.rpc).toHaveBeenLastCalledWith('save_invite_allowance',{p_household_id:'home',p_revision:10,p_amount_minor:amountMinor});
 }
});
it('makes no preview call while signed out or before the user requests review',async()=>{
 mockAccount='';const {wrapper}=makeWrapper();const {result}=await renderHook(()=>useInvitePreview('ABCDEFGH'),{wrapper});
 expect(result.current.fetchStatus).toBe('idle');expect(supabase.rpc).not.toHaveBeenCalled();
});
it('keeps invite preview data scoped to the current account and each explicit review',async()=>{
 const preview={household_id:'00000000-0000-4000-8000-000000000001',name:'Our home',base_currency:'USD',split_mode:'equal',revision:1,inviter_name:'Alex',allowance_minor:0,costs:[]};
 jest.mocked(supabase.rpc).mockResolvedValue({data:preview,error:null} as never);
 const {wrapper,client}=makeWrapper();const {result,rerender,unmount}=await renderHook(({attempt}: {attempt: number})=>useInvitePreview('ABCDEFGH',attempt),{wrapper,initialProps:{attempt:1}});
 await waitFor(()=>expect(result.current.isSuccess).toBe(true));
 expect(client.getQueryData(['invite-preview','A','ABCDEFGH',1])).toEqual(preview);
 mockAccount='B';await rerender({attempt:2});
 await waitFor(()=>expect(result.current.isSuccess).toBe(true));
 expect(supabase.rpc).toHaveBeenCalledTimes(2);
 expect(client.getQueryData(['invite-preview','B','ABCDEFGH',2])).toEqual(preview);
 await unmount();client.clear();
});
