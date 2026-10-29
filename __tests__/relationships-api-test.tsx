import { act, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { randomUUID } from 'expo-crypto';
import { supabase } from '@/lib/supabase';
import { useRelationshipAction } from '@/features/relationships/api';
jest.mock('expo-router',()=>({useFocusEffect:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{rpc:jest.fn()}}));
let count=0;
beforeEach(()=>{jest.clearAllMocks();count=0;jest.mocked(randomUUID).mockImplementation(()=>`00000000-0000-4000-8000-${String(++count).padStart(12,'0')}`);});
function wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{gcTime:0},mutations:{retry:false,gcTime:0}}})}>{children}</QueryClientProvider>;}
const input={action:'budget' as const,token:'token-a',values:{categoryId:'C',weekOn:'2026-11-02',amountMinor:1000,version:0}};
it('retries an uncertain save with the original token and actor even after a refresh',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Network request failed'}} as never).mockResolvedValue({data:{saved:true},error:null} as never);
 const {result}=await renderHook(()=>useRelationshipAction('H','A'),{wrapper});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await act(async()=>{await result.current.mutateAsync({...input,token:'token-b'});});
 const calls=jest.mocked(supabase.rpc).mock.calls;expect(calls[1][1]).toEqual(calls[0][1]);expect(calls[1][1]).toEqual(expect.objectContaining({p_actor_id:'A',p_token:'token-a'}));
});
it('creates a fresh request for a definitive conflict or a different account',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Goal changed'}} as never).mockResolvedValue({data:{saved:true},error:null} as never);
 const {result,rerender}=await renderHook((user:string)=>useRelationshipAction('H',user),{wrapper,initialProps:'A'});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});await act(async()=>{await result.current.mutateAsync({...input,token:'token-b'});});
 expect(jest.mocked(supabase.rpc).mock.calls[1][1]).toEqual(expect.objectContaining({p_token:'token-b',p_request_id:'00000000-0000-4000-8000-000000000002'}));
 await rerender('B');await act(async()=>{await result.current.mutateAsync(input);});expect(jest.mocked(supabase.rpc).mock.calls[2][1]).toEqual(expect.objectContaining({p_actor_id:'B'}));
});
it('keeps the original split request after an unreadable success response',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:{saved:'unknown'},error:null} as never).mockResolvedValue({data:{saved:true},error:null} as never);
 const {result}=await renderHook(()=>useRelationshipAction('H','A','E'),{wrapper});const split={token:'one',mode:'equal' as const,weights:[]};
 await act(async()=>{await result.current.mutateAsync(split).catch(()=>{});});await act(async()=>{await result.current.mutateAsync({...split,token:'two'});});
 expect(jest.mocked(supabase.rpc).mock.calls[1]).toEqual(jest.mocked(supabase.rpc).mock.calls[0]);
});
it('retains an uncertain request when a competing financial decision is attempted',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({data:null,error:{message:'Network request failed'}} as never).mockResolvedValue({data:{saved:true},error:null} as never);
 const {result}=await renderHook(()=>useRelationshipAction('H','A'),{wrapper});await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});
 await act(async()=>{await expect(result.current.mutateAsync({...input,values:{...input.values,amountMinor:2000}})).rejects.toThrow('Unresolved goal decision');});expect(supabase.rpc).toHaveBeenCalledTimes(1);
 await act(async()=>{await result.current.mutateAsync(input);});expect(jest.mocked(supabase.rpc).mock.calls[1]).toEqual(jest.mocked(supabase.rpc).mock.calls[0]);
});
