import { act,renderHook } from '@testing-library/react-native';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { randomUUID } from 'expo-crypto';
import { useSaveNudgeSettings } from '@/features/nudges/api';
import { supabase } from '@/lib/supabase';
import { preferenceValues } from '@/features/nudges/schema';
import { nudgePreferences } from '../test/fixtures/nudges';
jest.mock('@/features/nudges/device',()=>({pushAvailable:false,reminderDeviceId:()=>null,devicePushToken:jest.fn(),onPushTokenChange:()=>()=>{},onReminderResponse:()=>()=>{}}));
jest.mock('expo-router',()=>({useFocusEffect:jest.fn()}));
jest.mock('expo-crypto',()=>({randomUUID:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{rpc:jest.fn()}}));
function wrapper({children}:{children:ReactNode}){return <QueryClientProvider client={new QueryClient({defaultOptions:{queries:{gcTime:0},mutations:{retry:false,gcTime:0}}})}>{children}</QueryClientProvider>;}
let count=0;beforeEach(()=>{jest.clearAllMocks();count=0;jest.mocked(randomUUID).mockImplementation(()=>`00000000-0000-4000-8000-${String(++count).padStart(12,'0')}`);});
const input={revision:1,values:preferenceValues.parse(nudgePreferences.preferences)};
it('keeps an actor-scoped request and original revision after an uncertain save response',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({error:{message:'Network request failed'}} as never).mockResolvedValue({error:null} as never);
 const {result}=await renderHook(()=>useSaveNudgeSettings('H','A'),{wrapper});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});await act(async()=>{await result.current.mutateAsync({...input,revision:2});});
 const calls=jest.mocked(supabase.rpc).mock.calls;expect(calls[1][1]).toEqual(calls[0][1]);expect(calls[1][1]).toEqual(expect.objectContaining({p_actor_id:'A',p_revision:1}));
});
it('refreshes rejected requests and isolates account switches',async()=>{
 jest.mocked(supabase.rpc).mockResolvedValueOnce({error:{message:'Reminders changed'}} as never).mockResolvedValue({error:null} as never);
 const {result,rerender}=await renderHook((user:string)=>useSaveNudgeSettings('H',user),{wrapper,initialProps:'A'});
 await act(async()=>{await result.current.mutateAsync(input).catch(()=>{});});await act(async()=>{await result.current.mutateAsync({...input,revision:2});});
 expect(jest.mocked(supabase.rpc).mock.calls[1][1]).toEqual(expect.objectContaining({p_revision:2,p_request_id:'00000000-0000-4000-8000-000000000002'}));
 await rerender('B');await act(async()=>{await result.current.mutateAsync(input);});expect(jest.mocked(supabase.rpc).mock.calls[2][1]).toEqual(expect.objectContaining({p_actor_id:'B',p_request_id:'00000000-0000-4000-8000-000000000003'}));
});
