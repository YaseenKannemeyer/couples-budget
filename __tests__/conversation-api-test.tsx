import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useConversation, useConversationAction } from '@/features/conversation/api';
import { commentBody } from '@/features/conversation/schema';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { household, me, partner } from '../test/fixtures/payments';

jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => unknown) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/hooks/use-session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { from: jest.fn(), rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));
const uuid=(n:number)=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const tid=uuid(100);
type Row=Record<string,unknown>;
let comments:Row[],reactions:Row[],signal:()=>void;
class Query {
  filters: [string,unknown][]=[]; start=0; end=Infinity;
  constructor(private table:string){}
  select(){return this;}
  eq(key:string,value:unknown){this.filters.push([key,value]);return this;}
  order(){return this;}
  range(start:number,end:number){this.start=start;this.end=end;return this;}
  then(resolve:(value:unknown)=>unknown){return Promise.resolve({data:(this.table==='comments'?comments:reactions)
    .filter(row=>this.filters.every(([key,value])=>row[key]===value)).slice(this.start,this.end+1),error:null}).then(resolve);}
}
const comment=(id:number):Row=>({id:uuid(id),household_id:household.id,transaction_id:tid,author_id:me.userId,
  body:`Comment ${id}`,version:1,created_at:'2026-10-26T08:00:00Z',updated_at:'2026-10-26T08:00:00Z',deleted_at:null});
beforeEach(()=>{
 jest.clearAllMocks();comments=[comment(1),{...comment(2),transaction_id:uuid(99)}];reactions=[];
 jest.spyOn(AppState,'addEventListener').mockReturnValue({remove:jest.fn()});
 jest.mocked(useSession).mockReturnValue({session:{user:{id:me.userId}}} as ReturnType<typeof useSession>);
 jest.mocked(supabase.from).mockImplementation((table:string)=>new Query(table) as never);
 jest.mocked(supabase.rpc).mockResolvedValue({data:null,error:null} as never);
 const channel:{on:jest.Mock;subscribe:jest.Mock}={on:jest.fn((_event,config,callback)=>{expect(config.table).toBe('households');expect(config.filter).toBe(`id=eq.${household.id}`);signal=callback;return channel;}),subscribe:jest.fn(()=>channel)};
 jest.mocked(supabase.channel).mockReturnValue(channel as never);
});
async function setup(transactionId:string|undefined=tid){
 const client=new QueryClient({defaultOptions:{queries:{retry:false,gcTime:Infinity},mutations:{gcTime:Infinity}}});
 const wrapper=({children}:{children:React.ReactNode})=><QueryClientProvider client={client}>{children}</QueryClientProvider>;
 return {client,...await renderHook(()=>({thread:useConversation(household.id,transactionId),action:useConversationAction(household.id,tid)}),{wrapper})};
}
it('loads only the target thread and refreshes after a household-only signal',async()=>{
 const view=await setup();await waitFor(()=>expect(view.result.current.thread.comments.data).toBeDefined());
 expect(view.result.current.thread.comments.data!.pages[0].map(c=>c.body)).toEqual(['Comment 1']);
 comments.unshift(comment(3));await act(async()=>signal());
 await waitFor(()=>expect(view.result.current.thread.comments.data!.pages[0]).toHaveLength(2));
 expect(jest.mocked(supabase.from).mock.calls.every(([table])=>table==='comments'||table==='reactions')).toBe(true);
 await view.unmount();expect(supabase.removeChannel).toHaveBeenCalledTimes(1);view.client.clear();
});
it('paginates twenty comments at a time',async()=>{
 comments=Array.from({length:21},(_,i)=>comment(i+10));
 const view=await setup();await waitFor(()=>expect(view.result.current.thread.comments.hasNextPage).toBe(true));
 expect(view.result.current.thread.comments.data!.pages[0]).toHaveLength(20);
 await act(async()=>{await view.result.current.thread.comments.fetchNextPage();});
 await waitFor(()=>expect(view.result.current.thread.comments.data!.pages).toHaveLength(2));
 expect(view.result.current.thread.comments.data!.pages[1]).toHaveLength(1);
 await view.unmount();view.client.clear();
});
it('sends explicit actors, trimmed bodies and desired reaction states without changing transaction money',async()=>{
 const view=await setup();await act(async()=>{await view.result.current.action.mutateAsync({kind:'save',id:uuid(50),version:0,body:'  Thanks ☕  '});});
 expect(supabase.rpc).toHaveBeenCalledWith('save_transaction_comment',{p_household_id:household.id,p_transaction_id:tid,p_actor_id:me.userId,p_id:uuid(50),p_version:0,p_body:'Thanks ☕'});
 await act(async()=>{await view.result.current.action.mutateAsync({kind:'react',reaction:'coffee',active:true});});
 expect(supabase.rpc).toHaveBeenLastCalledWith('set_transaction_reaction',expect.objectContaining({p_actor_id:me.userId,p_kind:'coffee',p_active:true}));
 await view.unmount();view.client.clear();
});
it('scopes caches across account changes and rejects requests without a real session',async()=>{
 const view=await setup();await waitFor(()=>expect(view.result.current.thread.comments.data).toBeDefined());
 expect(view.client.getQueryData(['conversation',household.id,me.userId,tid,'comments'])).toBeDefined();
 jest.mocked(useSession).mockReturnValue({session:{user:{id:partner.userId}}} as ReturnType<typeof useSession>);
 await view.rerender(undefined);await waitFor(()=>expect(view.result.current.thread.comments.data).toBeDefined());
 expect(view.client.getQueryData(['conversation',household.id,partner.userId,tid,'comments'])).toBeDefined();
 jest.mocked(useSession).mockReturnValue({session:null,accountId:me.userId} as ReturnType<typeof useSession>);
 await view.rerender(undefined);const before=jest.mocked(supabase.rpc).mock.calls.length;
 await act(async()=>{await expect(view.result.current.action.mutateAsync({kind:'react',reaction:'heart',active:true})).rejects.toThrow('Not signed in');});
 expect(supabase.rpc).toHaveBeenCalledTimes(before);await view.unmount();view.client.clear();
});
it('recovers missed updates every fifteen focused seconds and stops after leaving',async()=>{
 jest.useFakeTimers();const view=await setup();await act(async()=>{await jest.advanceTimersByTimeAsync(10);});
 const before=jest.mocked(supabase.from).mock.calls.length;
 await act(async()=>{await jest.advanceTimersByTimeAsync(15_000);});expect(jest.mocked(supabase.from).mock.calls.length).toBeGreaterThan(before);
 await view.unmount();const after=jest.mocked(supabase.from).mock.calls.length;
 await act(async()=>{await jest.advanceTimersByTimeAsync(30_000);});expect(supabase.from).toHaveBeenCalledTimes(after);view.client.clear();jest.useRealTimers();
});
it('validates length by Unicode characters, rejects blank text and never transmits invalid input',()=>{
 expect(commentBody.safeParse('☕'.repeat(1000)).success).toBe(true);
 expect(commentBody.safeParse('🎉'.repeat(1000)).success).toBe(true);
 expect(commentBody.safeParse('🎉'.repeat(1001)).success).toBe(false);
 expect(commentBody.safeParse(' \n\t ').success).toBe(false);
});
