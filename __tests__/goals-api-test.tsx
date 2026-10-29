import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { useGoalAction } from '@/features/goals/api';
import { jointGoal } from '../test/fixtures/goals';
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
const input={action:'contribute' as const,revision:8,values:{id:jointGoal.id,version:3,amountMinor:100,on:'2026-10-27'}};
it('retries uncertain goal writes with the original actor, request and revision after background refresh',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Network request failed'}} as never).mockResolvedValue({data:{id:jointGoal.id,completed:false},error:null} as never);
 const {result}=await renderHook(()=>useGoalAction('H','A'),{wrapper});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await act(async()=>{await result.current.mutateAsync({...input,revision:10});});
 const calls=jest.mocked(supabase.rpc).mock.calls;expect(calls[1][1]).toEqual(calls[0][1]);
 expect(calls[1][1]).toEqual(expect.objectContaining({p_actor_id:'A',p_revision:8}));
});
it('starts a fresh reviewed request after a definitive conflict and isolates account changes',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Goal changed'}} as never).mockResolvedValue({data:{id:jointGoal.id,completed:false},error:null} as never);
 const {result,rerender}=await renderHook((user:string)=>useGoalAction('H',user),{wrapper,initialProps:'A'});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await act(async()=>{await result.current.mutateAsync({...input,revision:9});});
 expect(jest.mocked(supabase.rpc).mock.calls[1][1]).toEqual(expect.objectContaining({p_revision:9,p_request_id:'00000000-0000-4000-8000-000000000002'}));
 await rerender('B');await act(async()=>{await result.current.mutateAsync({...input,revision:10});});
 expect(jest.mocked(supabase.rpc).mock.calls[2][1]).toEqual(expect.objectContaining({p_actor_id:'B',p_request_id:'00000000-0000-4000-8000-000000000003'}));
});
it('never replaces an unresolved gift with a competing contribution or archive action',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Network request failed'}} as never).mockResolvedValue({data:{id:jointGoal.id,completed:true},error:null} as never);
 const {result}=await renderHook(()=>useGoalAction('H','A'),{wrapper});const gift={action:'gift' as const,revision:8,values:{id:jointGoal.id,version:3,amountMinor:100}};
 await act(async()=>{await result.current.mutateAsync(gift).catch(()=>{});});
 await act(async()=>{await expect(result.current.mutateAsync(input)).rejects.toThrow('Unresolved goal decision');});expect(supabase.rpc).toHaveBeenCalledTimes(1);
 await act(async()=>{await result.current.mutateAsync(gift);});expect(jest.mocked(supabase.rpc).mock.calls[1]).toEqual(jest.mocked(supabase.rpc).mock.calls[0]);
});
