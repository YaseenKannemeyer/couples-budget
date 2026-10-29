import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { useMoneyDateAction } from '@/features/money-date/api';
const periodId='00000000-0000-4000-8000-000000000080';
jest.mock('expo-router',()=>({useFocusEffect:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{rpc:jest.fn()}}));
let count=0;
beforeEach(()=>{jest.clearAllMocks();count=0;jest.mocked(randomUUID).mockImplementation(()=>`00000000-0000-4000-8000-${String(++count).padStart(12,'0')}`);});
function wrapper({children}:{children:ReactNode}){
 const client=new QueryClient({defaultOptions:{queries:{gcTime:0},mutations:{retry:false,gcTime:0}}});
 return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const input={action:'approve' as const,token:'review-a',month:'2026-10-01',values:{synced:true as const}};
it('retries uncertain monthly approvals with the original actor, request and token after background refresh',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Network request failed'}} as never).mockResolvedValue({data:{period_id:periodId,locked:false},error:null} as never);
 const {result}=await renderHook(()=>useMoneyDateAction('H','A'),{wrapper});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await act(async()=>{await result.current.mutateAsync({...input,token:'review-c'});});
 const calls=jest.mocked(supabase.rpc).mock.calls;expect(calls[1][1]).toEqual(calls[0][1]);
 expect(calls[1][1]).toEqual(expect.objectContaining({p_actor_id:'A',p_token:'review-a'}));
});
it('starts a fresh reviewed request after a definitive conflict and isolates account changes',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Money Date changed'}} as never).mockResolvedValue({data:{period_id:periodId,locked:false},error:null} as never);
 const {result,rerender}=await renderHook((user:string)=>useMoneyDateAction('H',user),{wrapper,initialProps:'A'});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await act(async()=>{await result.current.mutateAsync({...input,token:'review-b'});});
 expect(jest.mocked(supabase.rpc).mock.calls[1][1]).toEqual(expect.objectContaining({p_token:'review-b',p_request_id:'00000000-0000-4000-8000-000000000002'}));
 await rerender('B');await act(async()=>{await result.current.mutateAsync({...input,token:'review-c'});});
 expect(jest.mocked(supabase.rpc).mock.calls[2][1]).toEqual(expect.objectContaining({p_actor_id:'B',p_request_id:'00000000-0000-4000-8000-000000000003'}));
});
