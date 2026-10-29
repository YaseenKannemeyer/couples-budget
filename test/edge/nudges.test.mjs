import { createNudgeHandler } from '../../supabase/functions/anti-nag/handler.ts';
import { forecast } from '../../supabase/functions/_shared/forecast.ts';
import assert from 'node:assert/strict';
import { it } from 'node:test';
const config={url:'https://example.supabase.co',serviceKey:'service-only-test-key',cronSecret:'cron-only-test-secret',expoAccessToken:'expo-only-test-token'};
const job={id:'job',claim_id:'lease',kind:'payment'},token='ExpoPushToken[test-only-token]';
const input={today:'2026-10-28',balance:{as_of_on:'2026-10-27',amount_minor:10000,low_threshold_minor:1000},income:[{on_date:'2026-11-01',confirmed:false,amount_minor:20000}],
 payments:[{id:'bill',name:'Shared bill',category_id:'cat',recurrence:'one_time',due_start:'2026-10-29',due_end:'2026-10-29',anchor_start_day:29,anchor_end_day:29,estimate_minor:15000}],
 categories:[{id:'cat',name:'Utilities'}],transactions:[],goals:[],budgets:[],overrides:[]};
function setup(overrides={}){
 const calls=[],outcomes=[];const queues=[overrides.jobs??[job],[]];
 const send=async(url,options)=>{const args=JSON.parse(options.body);calls.push({url,args,headers:options.headers});
  if(url.endsWith('/push/send')){if(overrides.pushError)throw Error('network uncertain');return overrides.pushResponse??Response.json({data:{status:'ok',id:'ticket'}});}
  if(url.endsWith('/push/getReceipts'))return overrides.receiptResponse??Response.json({data:{ticket:{status:'error',details:{error:'DeviceNotRegistered'}}}});
  const name=url.split('/').at(-1);if(overrides.dbFail===name)return new Response('',{status:503});
  if(name==='claim_nudges')return Response.json(queues.shift()??[]);
  if(name==='get_nudge_receipts')return Response.json(overrides.receipts??[]);
  if(name==='nudge_forecast_context')return Response.json(overrides.input??input);
  if(name==='begin_nudge_send')return Response.json(overrides.noTarget?null:{token,kind:args.p_kind,language:'en'});
  if(name==='finish_nudge_send')outcomes.push(args);
  return new Response(null,{status:204});
 };
 const handle=createNudgeHandler(config,send);
 const run=(options={})=>handle(new Request('https://local/anti-nag',{method:'POST',headers:{Authorization:`Bearer ${config.cronSecret}`},...options}));
 return{calls,outcomes,run,handle};
}
it('rejects missing, public, malformed and empty credentials before database access',async()=>{
 const s=setup();for(const Authorization of ['',config.serviceKey,`Bearer ${config.serviceKey}`,'Bearer fake'])assert.equal((await s.run({headers:{Authorization}})).status,401);
 assert.equal(s.calls.length,0);const handler=createNudgeHandler({...config,cronSecret:''},()=>{throw Error('must not fetch');});assert.equal((await handler(new Request('https://local',{method:'POST',headers:{Authorization:'Bearer '}}))).status,401);
});
it('accepts only POST and ignores attempts to choose recipients/copy from the request body',async()=>{
 const s=setup();assert.equal((await s.run({method:'GET'})).status,405);assert.equal(s.calls.length,0);
 assert.equal((await s.run({body:JSON.stringify({user_id:'victim',token:'victim',body:'PRIVATE PURCHASE'})})).status,200);
 const push=s.calls.find(c=>c.url.endsWith('/push/send'));assert.equal(push.args.to,token);assert.equal(push.args.title,'Couple Goals');assert.equal(push.args.body,'Take a moment to review your upcoming payments.');assert.ok(!JSON.stringify(push.args).includes('PRIVATE'));
 assert.deepEqual(push.args.data,{kind:'nudge-payment'});assert.equal(push.args.ttl,3600);assert.ok(!JSON.stringify(push.args).includes(config.serviceKey));
});
it('requires durable sending permission before submitting to Expo, then records the ticket',async()=>{
 const s=setup();const response=await s.run();assert.equal(response.status,200);assert.deepEqual(await response.json(),{submitted:1,receiptsChecked:0});
 const names=s.calls.map(c=>c.url.split('/').at(-1));assert.ok(names.indexOf('begin_nudge_send')<names.indexOf('send'));
 assert.equal(s.outcomes[0].p_status,'accepted');assert.equal(s.outcomes[0].p_ticket_id,'ticket');
 assert.equal(s.calls.find(c=>c.url.endsWith('/push/send')).headers.Authorization,'Bearer '+config.expoAccessToken);
});
it('records uncertain network/5xx responses without a second submission',async()=>{
 for(const options of [{pushError:true},{pushResponse:new Response('uncertain',{status:503})},{pushResponse:new Response('not json',{status:200})}]){
  const s=setup(options);await s.run();assert.equal(s.outcomes[0].p_status,'unknown');await s.run();assert.equal(s.calls.filter(c=>c.url.endsWith('/push/send')).length,1);
 }
});
it('does not submit when consent/device is no longer eligible or when the database cannot commit sending',async()=>{
 for(const options of [{noTarget:true},{dbFail:'begin_nudge_send'}]){const s=setup(options);await s.run();assert.equal(s.calls.filter(c=>c.url.endsWith('/push/send')).length,0);}
});
it('checks receipts and passes only sanitized outcomes to the database',async()=>{
 const s=setup({jobs:[],receipts:[{id:'job',ticket_id:'ticket'}]});const r=await s.run();assert.equal((await r.json()).receiptsChecked,1);
 const finish=s.calls.find(c=>c.url.endsWith('/finish_nudge_receipt'));assert.deepEqual(finish.args,{p_id:'job',p_ticket_id:'ticket',p_ok:false,p_error:'DeviceNotRegistered'});
});
it('keeps missing/temporary receipt failures available for later safe lookups',async()=>{
 for(const response of [Response.json({data:{}}),new Response('',{status:503})]){
  const s=setup({jobs:[],receipts:[{id:'job',ticket_id:'ticket'}],receiptResponse:response});assert.equal((await s.run()).status,200);assert.equal(s.calls.filter(c=>c.url.endsWith('/finish_nudge_receipt')).length,0);
 }
});
it('uses the shared integer forecast for a real low-balance decision',async()=>{
 assert.equal(forecast(input,'2026-11-27').low,true);const s=setup({jobs:[{...job,kind:'low_balance'}]});await s.run();assert.equal(s.calls.find(c=>c.url.endsWith('/begin_nudge_send')).args.p_kind,'low_balance');
 assert.equal(s.calls.find(c=>c.url.endsWith('/push/send')).args.body,'Your shared cash-flow forecast could use a quick look.');
});
it('never turns unknown/stale forecast data into a low-balance assertion',async()=>{
 for(const data of [{...input,balance:null},{...input,balance:{...input.balance,as_of_on:'2020-01-01'}},{...input,payments:[{...input.payments[0],estimate_minor:null}]}]){
  const s=setup({jobs:[{...job,kind:'low_balance'}],input:data,noTarget:true});await s.run();assert.equal(s.calls.find(c=>c.url.endsWith('/begin_nudge_send')).args.p_kind,'unlogged');assert.equal(s.calls.filter(c=>c.url.endsWith('/push/send')).length,0);
 }
});
it('marks malformed/unavailable forecast context skipped, without exposing diagnostics',async()=>{
 const s=setup({jobs:[{...job,kind:'low_balance'}],dbFail:'nudge_forecast_context'});await s.run();assert.equal(s.outcomes[0].p_status,'skipped');assert.equal(s.outcomes[0].p_error,'forecast_unavailable');assert.equal(s.calls.filter(c=>c.url.endsWith('/push/send')).length,0);
});
it('sanitizes provider diagnostics and never logs token or private message text as errors',async()=>{
 const s=setup({pushResponse:Response.json({data:{status:'error',message:'PRIVATE DETAILS',details:{error:'PRIVATE ERROR'}}})});await s.run();assert.equal(s.outcomes[0].p_error,'provider_rejected');assert.ok(!JSON.stringify(s.outcomes).includes('PRIVATE'));
});
it('treats a valid receipt as handoff confirmation rather than proof of user receipt',async()=>{
 const s=setup({jobs:[],receipts:[{id:'job',ticket_id:'ticket'}],receiptResponse:Response.json({data:{ticket:{status:'ok'}}})});await s.run();assert.equal(s.calls.find(c=>c.url.endsWith('/finish_nudge_receipt')).args.p_ok,true);
});
it('bounds concurrent provider submissions to six while independent jobs make progress',async()=>{
 let active=0,max=0;const jobs=Array.from({length:14},(_,n)=>({...job,id:'job-'+n}));
 const send=async(url,options)=>{
  if(url.endsWith('/push/send')){active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,3));active--;return Response.json({data:{status:'ok',id:'ticket'}});}
  if(url.endsWith('/get_nudge_receipts'))return Response.json([]);
  if(url.endsWith('/claim_nudges'))return Response.json(jobs);
  if(url.endsWith('/begin_nudge_send'))return Response.json({token,kind:'payment',language:'en'});
  return new Response(null,{status:204});
 };
 const response=await createNudgeHandler(config,send)(new Request('https://local',{method:'POST',headers:{Authorization:'Bearer '+config.cronSecret}}));
 assert.equal(response.status,200);assert.equal((await response.json()).submitted,14);assert.equal(max,6);
});
