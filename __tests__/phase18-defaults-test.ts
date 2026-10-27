import { automaticGuide } from '@/features/guides/automatic';
import { readLogPreference, rememberLogChoice, preferredCategory } from '@/features/quick-log/preferences';
const memory=()=>{const map=new Map<string,string>();return {getItem:(key:string)=>map.get(key)??null,setItem:(key:string,value:string)=>{map.set(key,value);}};};
it('keeps category preferences per account, household and visibility',()=>{
 const store=memory();rememberLogChoice(store,'A','H','private','private-category');rememberLogChoice(store,'A','H','shared','shared-category');
 expect(readLogPreference(store,'A','H')).toEqual({lastSpace:'shared',private:'private-category',shared:'shared-category'});
 expect(readLogPreference(store,'B','H')).toEqual({});expect(readLogPreference(store,'A','OTHER')).toEqual({});
});
it('revalidates a remembered category against the current permitted catalogue',()=>{
 expect(preferredCategory('secret',[{id:'shared'}])).toBe('shared');expect(preferredCategory('removed',[])).toBe('');
 expect(preferredCategory('current',[{id:'other'},{id:'current'}])).toBe('current');
});
it('tolerates unavailable optional storage without affecting financial saves',()=>{
 const store={getItem:()=>{throw Error('disabled');},setItem:()=>{throw Error('disabled');}};
 expect(readLogPreference(store,'A','H')).toEqual({});expect(()=>rememberLogChoice(store,'A','H','shared','C')).not.toThrow();
});
it('keeps first-use choices personal and honours skipped or paused welcome progress',()=>{
 expect(automaticGuide({},'/household')).toBe('welcome');expect(automaticGuide({},'/')).toBe('first-visit');expect(automaticGuide({},'/payments')).toBeNull();
 for(const status of ['dismissed','paused','in_progress'] as const)expect(automaticGuide({welcome:{guide_id:'welcome',guide_version:1,step_id:'spaces',status,revision:1,request_id:'00000000-0000-4000-8000-000000000001',pending:false}},'/')).toBeNull();
});
