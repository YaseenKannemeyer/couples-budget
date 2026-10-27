import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { router } from 'expo-router';
import { GuidesProvider } from '@/features/guides/provider';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useGuides } from '@/features/guides/context';
import { LocalizationProvider } from '@/i18n/provider';
import { storageKey } from '@/features/guides/progress';
import type { Progress } from '@/features/guides/progress';

let mockUser = 'A';
let mockPath = '/quick-log';
let mockRemote: Progress[] = [];
let mockOffline = false;
const mockRpc = jest.fn(async (name: string, input: Record<string, unknown>) => {
 if (mockOffline) throw new TypeError('offline');
 const row = { guide_id: input.p_guide_id, guide_version: input.p_guide_version, step_id: input.p_step_id,
  status: input.p_status, revision: Number(input.p_revision)+1, request_id: input.p_request_id } as Progress;
 mockRemote = [...mockRemote.filter(r=>r.guide_id!==row.guide_id), row];
 return {data:row,error:null};
});
jest.mock('@/lib/supabase',()=>({supabase:{
 from:()=>({select:()=>({eq:()=>({eq:async()=>{if(mockOffline)throw new TypeError('offline');return {data:mockRemote,error:null};}})})}),
 rpc:(...args: Parameters<typeof mockRpc>)=>mockRpc(...args),
}}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:mockUser?{user:{id:mockUser}}:null})}));
jest.mock('expo-router',()=>({router:{push:jest.fn()},usePathname:()=>mockPath}));
jest.mock('expo-crypto',()=>({randomUUID:()=>`00000000-0000-4000-8000-${String(++mockCounter).padStart(12,'0')}`}));
let mockCounter = 0;
jest.mock('@/global.css',()=>({}));
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
function Probe() {
 const c=useGuides()!;
 const [chosen,setChosen]=useState(false);
 return <View>
  <Text testID="active">{c.active??'none'}</Text><Text testID="progress">{JSON.stringify(c.rows)}</Text>
  <Button title="Start log guide" onPress={()=>c.start('quick-log')}/>
  <Button title="Choose space" onPress={()=>{setChosen(true);c.signal('space-chosen');}}/>
  <Button title="Queue saved" onPress={()=>c.signal('expense-queued')}/>
  <Button title="Wrong result" onPress={()=>c.signal('payment-saved')}/>
  <Button title="Replay" onPress={()=>c.start('quick-log',true)}/>
  {mockPath === '/' && <GuideSlot target="home-summary" offer="first-visit"/>}
  {mockPath === '/household' && <GuideSlot target="household-start"/>}
  <Button title="Connected household" onPress={()=>c.signal('household-connected')}/>
  {chosen?<GuideSlot target="log-amount"/>:<GuideSlot target="log-space" offer="quick-log"/>}
 </View>;
}
const App=()=> <LocalizationProvider><GuidesProvider><Probe/></GuidesProvider></LocalizationProvider>;
beforeEach(()=>{
 mockUser='A';mockPath='/quick-log';mockRemote=[];mockOffline=false;mockCounter=0;mockRpc.mockClear();jest.mocked(router.push).mockClear();
 const map=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v);}}});
});
it('offers help without starting it or performing a financial action',async()=>{
 const v=await render(<App/>);await waitFor(()=>expect(v.getByRole('button',{name:'Start guide: Log an expense'})).toBeTruthy());
 expect(v.getByTestId('active').props.children).toBe('none');expect(mockRpc).not.toHaveBeenCalled();
});
it('advances action steps only after the matching actual result and completes once',async()=>{
 const v=await render(<App/>);await fireEvent.press(v.getByText('Start log guide'));
 expect(v.getByText('Step 1 of 2')).toBeTruthy();expect(v.queryByRole('button',{name:'Next'})).toBeNull();
 await fireEvent.press(v.getByText('Wrong result'));expect(v.getByText('Step 1 of 2')).toBeTruthy();
 await fireEvent.press(v.getByText('Choose space'));expect(v.getByText('Step 2 of 2')).toBeTruthy();
 await fireEvent.press(v.getByText('Queue saved'));expect(v.getByTestId('active').props.children).toBe('none');
 expect(v.getByTestId('progress').props.children).toContain('completed');
});
it('persists skipping, never reoffers it on restart, and allows an explicit replay',async()=>{
 let v=await render(<App/>);await waitFor(()=>expect(v.getByText('No thanks')).toBeTruthy());
 await fireEvent.press(v.getByText('No thanks'));await waitFor(()=>expect(mockRpc).toHaveBeenCalled());
 await v.unmount();v=await render(<App/>);
 expect(v.queryByRole('button',{name:'Start guide: Log an expense'})).toBeNull();
 await fireEvent.press(v.getByText('Replay'));expect(v.getByText('Step 1 of 2')).toBeTruthy();
});
it('resumes a closed guide from its last step after an offline restart',async()=>{
 mockOffline=true;let v=await render(<App/>);
 await fireEvent.press(v.getByText('Start log guide'));await fireEvent.press(v.getByText('Choose space'));
 await fireEvent.press(v.getByRole('button',{name:'Close'}));
 expect(JSON.parse(localStorage.getItem(storageKey('A'))!)[0].step_id).toBe('save');
 await v.unmount();v=await render(<App/>);await fireEvent.press(v.getByText('Start log guide'));
 expect(v.getByText('Step 2 of 2')).toBeTruthy();
});
it('never carries active progress into another signed-in account',async()=>{
 const v=await render(<App/>);await fireEvent.press(v.getByText('Start log guide'));
 mockUser='B';mockRemote=[];await v.rerender(<App/>);
 expect(v.getByTestId('active').props.children).toBe('none');
 await waitFor(()=>expect(v.getByTestId('progress').props.children).toBe('{}'));
 expect(localStorage.getItem(storageKey('B'))).not.toContain('quick-log');
});
it('ignores an action on another route and keeps progress ready to resume',async()=>{
 const v=await render(<App/>);await fireEvent.press(v.getByText('Start log guide'));
 mockPath='/settings';await v.rerender(<App/>);await fireEvent.press(v.getByText('Choose space'));
 expect(v.getByTestId('progress').props.children).toContain('"step_id":"space"');
});

it('lets Back explain how to return to space choice without automatically discarding the form', async () => {
 const v=await render(<App/>);await fireEvent.press(v.getByText('Start log guide'));await fireEvent.press(v.getByText('Choose space'));
 await fireEvent.press(v.getByRole('button',{name:'Back'}));
 expect(v.getByText(/Changing spaces clears unsaved form values/)).toBeTruthy();
 expect(v.getByTestId('progress').props.children).toContain('"step_id":"space"');
 expect(router.push).not.toHaveBeenCalled();
});

it('starts the introduction automatically at first authenticated household entry', async () => {
 mockPath='/household';const v=await render(<App/>);
 await waitFor(()=>expect(v.getByText('Shared money. A space of your own.')).toBeTruthy());
 expect(v.getByTestId('active').props.children).toBe('welcome');
 await fireEvent.press(v.getByText('Connected household'));
 expect(v.getByTestId('progress').props.children).toContain('completed');
 expect(v.getByTestId('active').props.children).toBe('none');
});
it('starts the app walkthrough automatically at Home and never restarts it after Close', async () => {
 mockPath='/';let v=await render(<App/>);
 await waitFor(()=>expect(v.getByText('Step 1 of 4')).toBeTruthy());
 await fireEvent.press(v.getByRole('button',{name:'Close'}));
 await v.unmount();v=await render(<App/>);
 await waitFor(()=>expect(v.getByTestId('progress').props.children).toContain('paused'));
 expect(v.getByTestId('active').props.children).toBe('none');
});
it('respects a remote dismissal before automatically starting anything', async () => {
 mockPath='/';mockRemote=[{guide_id:'first-visit',guide_version:1,step_id:'home',status:'dismissed',revision:3,request_id:'00000000-0000-4000-8000-000000000099'}];
 const v=await render(<App/>);await waitFor(()=>expect(v.getByTestId('progress').props.children).toContain('dismissed'));
 expect(v.getByTestId('active').props.children).toBe('none');expect(mockRpc).not.toHaveBeenCalled();
});
it('does not start an authenticated introduction on the signed-out surface', async () => {
 mockUser='';mockPath='/household';const v=await render(<App/>);
 expect(v.getByTestId('active').props.children).toBe('none');expect(mockRpc).not.toHaveBeenCalled();
});
