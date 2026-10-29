import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { useReconciliationAction } from '@/features/reconciliation/api';

jest.mock('expo-router',()=>({useFocusEffect:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{rpc:jest.fn()}}));
let sequence=0;
beforeEach(()=>{
 jest.clearAllMocks();sequence=0;
 jest.mocked(randomUUID).mockImplementation(()=>`00000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`);
});
function wrapper({children}:{children:ReactNode}){
 const client=new QueryClient({defaultOptions:{queries:{gcTime:0},mutations:{retry:false,gcTime:0}}});
 return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
const input={action:'check' as const,revision:8,values:{on:'2026-10-27',actualMinor:9000}};
it('reuses the original request and revision after an uncertain response despite a refreshed comparison',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Network request failed'}} as never)
  .mockResolvedValue({data:{id:'check'},error:null} as never);
 const {result}=await renderHook(()=>useReconciliationAction('H','A'),{wrapper});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await act(async()=>{await result.current.mutateAsync({...input,revision:10});});
 const calls=jest.mocked(supabase.rpc).mock.calls;
 expect(calls[1][1]).toEqual(calls[0][1]);expect(calls[1][1]).toEqual(expect.objectContaining({p_revision:8,p_actor_id:'A'}));
 await act(async()=>{await result.current.mutateAsync({...input,revision:10});});
 expect(jest.mocked(supabase.rpc).mock.calls[2][1]).toEqual(expect.objectContaining({p_revision:10,p_request_id:'00000000-0000-4000-8000-000000000002'}));
});
it('uses a new request after a definitive conflict so the user can submit a reviewed refresh',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Reconciliation changed'}} as never)
  .mockResolvedValue({data:{id:'check'},error:null} as never);
 const {result}=await renderHook(()=>useReconciliationAction('H','A'),{wrapper});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await act(async()=>{await result.current.mutateAsync({...input,revision:9});});
 expect(jest.mocked(supabase.rpc).mock.calls[1][1]).toEqual(expect.objectContaining({p_revision:9,p_request_id:'00000000-0000-4000-8000-000000000002'}));
});
it('never reuses another account’s pending request when account context changes',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Network request failed'}} as never)
  .mockResolvedValue({data:{id:'check'},error:null} as never);
 const {result,rerender}=await renderHook((user:string)=>useReconciliationAction('H',user),{wrapper,initialProps:'A'});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await rerender('B');await act(async()=>{await result.current.mutateAsync({...input,revision:9});});
 expect(jest.mocked(supabase.rpc).mock.calls[1][1]).toEqual(expect.objectContaining({p_actor_id:'B',p_revision:9,p_request_id:'00000000-0000-4000-8000-000000000002'}));
});
