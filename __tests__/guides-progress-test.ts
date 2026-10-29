import { acknowledge, mergeRemote, progressRow, readProgress, storageKey, writeProgress, type LocalProgress } from '@/features/guides/progress';
import { guides } from '@/features/guides/registry';
const row: LocalProgress = { guide_id: 'first-visit', guide_version: 1, step_id: 'home', status: 'in_progress', revision: 0, request_id: '00000000-0000-4000-8000-000000000001', pending: true };
const nextId = '00000000-0000-4000-8000-000000000002';
function store() { const map = new Map<string,string>(); return { getItem: (k:string)=>map.get(k)??null, setItem: (k:string,v:string)=>{map.set(k,v);} }; }
it('scopes durable progress to the signed-in person and preserves dismissals after restart',()=>{
 const disk=store();const rows={'first-visit':{...row,status:'dismissed' as const}};
 writeProgress(disk,'A',rows);expect(readProgress(disk,'A')).toEqual(rows);expect(readProgress(disk,'B')).toEqual({});
});
it('reports corrupt/full storage instead of claiming progress was persisted',()=>{
 const disk=store();disk.setItem(storageKey('A'),'{broken');expect(()=>readProgress(disk,'A')).toThrow();
 expect(()=>writeProgress({setItem:()=>{throw Error('full');}},'A',{'first-visit':row})).toThrow('full');
});
it('keeps offline progress while the server is still at its base revision',()=>{
 expect(mergeRemote({'first-visit':{...row,revision:2,step_id:'private'}},[{...row,revision:2,request_id:nextId}])['first-visit'].step_id).toBe('private');
});
it('reconciles a lost acknowledgement without replaying the same mutation',()=>{
 const saved={...row,revision:1};const merged=mergeRemote({'first-visit':row},[saved]);
 expect(merged['first-visit']).toEqual({...saved,pending:false});
});
it('adopts a newer remote dismissal instead of automatically restarting a guide',()=>{
 const saved={...row,revision:2,status:'dismissed' as const,request_id:nextId};
 expect(mergeRemote({'first-visit':row},[saved])['first-visit']).toEqual({...saved,pending:false});
});
it('preserves a local edit made while the previous step was syncing',()=>{
 const draft={...row,step_id:'shared',request_id:nextId};
 expect(acknowledge({'first-visit':draft},row,{...row,revision:1})['first-visit']).toEqual({...draft,revision:1});
});
it('rejects unknown guides, future versions and unknown step identifiers',()=>{
 for(const patch of [{guide_id:'goals'},{guide_version:2},{step_id:'not-shipped'}])expect(progressRow.safeParse({...row,...patch}).success).toBe(false);
});
it('keeps registries limited to shipped workflows and gives every step a route and stable anchor',()=>{
 expect(new Set(guides.map(g=>g.id)).size).toBe(guides.length);
 expect(guides.find(g=>g.id==='first-visit')?.steps).toHaveLength(4);
 expect(guides.find(g=>g.id==='reconciliation')?.steps.map(s=>s.id)).toEqual(['compare','check']);
 expect(guides.find(g=>g.id==='goals')?.steps.map(s=>s.id)).toEqual(['overview','create']);
 expect(guides.find(g=>g.id==='money-date')?.steps.map(s=>s.id)).toEqual(['review','close']);
 expect(guides.find(g=>g.id==='money-date')?.steps[1].action).toBe('month-closed');
 for(const guide of guides)for(const step of guide.steps){expect(step.target).toBeTruthy();expect(step.paths.length).toBeGreaterThan(0);}
});
