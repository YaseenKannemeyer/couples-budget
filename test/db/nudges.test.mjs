import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { before,beforeEach,after,it } from 'node:test';
const root=new URL('../../',import.meta.url).pathname,db=new PGlite();
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',X='00000000-0000-4000-8000-000000000003';
const DA='00000000-0000-4000-8000-000000000011',DB='00000000-0000-4000-8000-000000000012';
const token='ExpoPushToken[aaaaaaaaaaaaaaaaaaaaaa]';let h,today,now,cat;
const as=(id,fn,service=false)=>db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);await tx.exec(service?'set local role service_role':id?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=(user,name,args=[],service=false)=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) value`,args)).rows[0].value,service);
const svc=(name,args=[])=>rpc(null,name,args,true);
const get=(user=A)=>rpc(user,'get_nudge_settings',[h,user]);
const defaults={enabled:true,payments:true,low_balance:false,money_date:false,unlogged:false,send_hour:19,language:'en'};
const save=async(values={},user=A,revision,request=randomUUID())=>rpc(user,'save_nudge_preferences',[h,user,revision??(await get(user)).preferences.revision,request,JSON.stringify({...defaults,...values})]);
const register=(user=A,device=DA,value=token)=>rpc(user,'register_nudge_device',[h,user,device,value]);
const enqueue=(at=now)=>svc('enqueue_nudges',[at,100]);const claim=(at=now)=>svc('claim_nudges',[at,30]);
const begin=(job,kind=job.kind,at=now)=>svc('begin_nudge_send',[job.id,job.claim_id,kind,at]);
const finish=(job,status='accepted',ticket='ticket-1',error=null)=>svc('finish_nudge_send',[job.id,job.claim_id,status,ticket,error]);
const payment=async(user=A,visibility='shared',other={})=>(await db.query(`insert into public.scheduled_payments(household_id,owner_id,payer_id,visibility,name,category_id,recurrence,date_mode,due_start,due_end,anchor_start_day,anchor_end_day,reminder_days_before) values($1,$2,$2,$3,$4,$5,'one_time','exact',$6,$6,1,1,3) returning id`,[h,user,visibility,'SECRET BILL',cat,other.due??today])).rows[0].id;
before(async()=>{
 await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
 for(const f of readdirSync(root+'supabase/migrations').sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
});
beforeEach(async()=>{
 await db.exec('delete from public.households');await db.exec('delete from public.nudge_devices');
 const house=await rpc(A,'create_household',['Our reminders','USD','UTC','Alex']);h=house.id;await rpc(B,'join_household',[house.invite_code,'Sam']);
 today=(await db.query("select (now() at time zone 'UTC')::date::text d")).rows[0].d;now=today+'T19:05:00Z';
 await db.query("update public.members set joined_at=$2::date-interval '3 days' where household_id=$1",[h,today]);
 cat=(await db.query("select id from public.categories where household_id=$1 and visibility='shared' limit 1",[h])).rows[0].id;
});after(()=>db.close());
it('defaults to no consent and never registers or enables the partner',async()=>{
 const a=await get(),b=await get(B);assert.equal(a.preferences.enabled,false);assert.equal(a.preferences.unlogged,false);assert.equal(a.device_registered,false);
 await register();await save();assert.equal((await get()).preferences.enabled,true);assert.equal((await get(B)).preferences.enabled,false);assert.equal((await get(B)).device_registered,false);
 await assert.rejects(rpc(A,'save_nudge_preferences',[h,B,b.preferences.revision,randomUUID(),JSON.stringify(defaults)]),/Reminders unavailable/);
});
it('requires an active device, valid consent/time, and version-checked idempotent saves',async()=>{
 await assert.rejects(save(),/Register reminder device/);await register();const revision=(await get()).preferences.revision,request=randomUUID();
 await save({},A,revision,request);await save({},A,revision,request);assert.equal((await get()).preferences.revision,revision+1);
 await assert.rejects(save({send_hour:18},A,revision,request),/Reminders changed/);await assert.rejects(save({send_hour:18},A,revision),/Reminders changed/);
 for(const values of [{send_hour:8},{send_hour:21},{send_hour:19.5},{language:'xx'},{payments:'true'}])await assert.rejects(save(values),/Invalid reminder input/);
});
it('enqueues/claims each person only once a day, respecting timezone/hour and payer/owner scope',async()=>{
 await register();await save();await payment(B,'private');assert.equal(await enqueue(today+'T08:05:00Z'),0);await enqueue();assert.deepEqual(await claim(),[]);
 await db.query('delete from public.nudges where household_id=$1',[h]);await payment(A,'private');await Promise.all([enqueue(),enqueue()]);
 const jobs=await claim();assert.equal(jobs.length,1);assert.equal(jobs[0].kind,'payment');assert.deepEqual(await claim(),[]);assert.equal(await enqueue(),0);
 assert.ok(!JSON.stringify(jobs).includes('SECRET'));assert.ok(!JSON.stringify((await get()).history).includes('SECRET'));
});
it('rechecks consent, paid/paused schedules and device ownership immediately before sending',async()=>{
 await register();await save();const bill=await payment();await enqueue();const [job]=await claim();
 await db.query("update public.scheduled_payments set status='paused' where id=$1",[bill]);assert.equal(await begin(job),null);
 assert.equal((await get()).history.length,0);
});
it('suppresses a bill cycle after acceptance, including on a later reminder-window day',async()=>{
 await register();await save();const future=(await db.query('select ($1::date+2)::text d',[today])).rows[0].d;await payment(A,'shared',{due:future});await enqueue();const [job]=await claim();
 assert.ok((await begin(job)).token);await finish(job);
 const later=(await db.query('select ($1::date+1)::text d',[today])).rows[0].d+'T19:05:00Z';await enqueue(later);assert.deepEqual(await claim(later),[]);
});
it('never reclaims sending/unknown jobs after an uncertain response or expired worker lease',async()=>{
 await register();await save();await payment();await enqueue();const [job]=await claim();assert.ok(await begin(job));assert.equal(await begin(job),null);
 const later=today+'T19:20:00Z';await enqueue(later);assert.deepEqual(await claim(later),[]);
 assert.equal((await get()).history[0].status,'unknown');
});
it('can safely reassign an evaluation lease but rejects the old worker before delivery',async()=>{
 await register();await save();await payment();await enqueue();const [old]=await claim();const later=today+'T19:20:00Z';await enqueue(later);const [fresh]=await claim(later);
 assert.notEqual(old.claim_id,fresh.claim_id);assert.equal(await begin(old),null);assert.ok(await begin(fresh,'payment',later));
});
it('atomically rebinds an installation and prevents an old-account claim from sending',async()=>{
 await register();await save();await payment();await enqueue();const [job]=await claim();
 await register(B,DA,token);assert.equal((await get()).device_registered,false);assert.equal((await get(B)).device_registered,true);assert.equal(await begin(job),null);
});
it('does not let an old token failure disable a refreshed device',async()=>{
 await register();await save();await payment();await enqueue();const [job]=await claim();await begin(job);await finish(job);
 await register(A,DA,'ExpoPushToken[bbbbbbbbbbbbbbbbbbbbbb]');await svc('finish_nudge_receipt',[job.id,'ticket-1',false,'DeviceNotRegistered']);assert.equal((await get()).device_registered,true);
});
it('handles receipt acceptance and disables a genuinely invalid current token',async()=>{
 await register();await save();await payment();await enqueue();const [job]=await claim();await begin(job);await finish(job);
 await db.query("update public.nudges set updated_at=$2::timestamptz-interval '20 minutes' where id=$1",[job.id,now]);
 assert.equal((await svc('get_nudge_receipts',[now])).length,1);await svc('finish_nudge_receipt',[job.id,'ticket-1',false,'DeviceNotRegistered']);assert.equal((await get()).device_registered,false);assert.equal((await get()).history[0].status,'failed');
});
it('checks only the owner’s logging and leaves shared revision/partner history unchanged',async()=>{
 await register();await save({unlogged:true,payments:false});const before=(await db.query('select goals_revision,reconciliation_revision from public.households where id=$1',[h])).rows[0];
 await db.query("insert into public.private_transactions(household_id,owner_id,amount_minor,description,occurred_on) values($1,$2,10,'PRIVATE PURCHASE',$3)",[h,B,today]);
 await enqueue();const jobs=await claim();assert.equal(jobs[0].kind,'unlogged');assert.ok(!JSON.stringify(jobs).includes('PRIVATE'));
 assert.deepEqual((await get(B)).history,[]);const after=(await db.query('select goals_revision,reconciliation_revision from public.households where id=$1',[h])).rows[0];assert.deepEqual(after,before);
});
it('does not nag a newly joined or recently logging person, and applies a weekly check-in cooldown',async()=>{
 await register();await save({unlogged:true,payments:false});await db.query('update public.members set joined_at=$2 where household_id=$1 and user_id=$3',[h,today,A]);await enqueue();assert.deepEqual(await claim(),[]);
 await db.query('delete from public.nudges where household_id=$1',[h]);await db.query("update public.members set joined_at=$2::date-interval '3 days' where household_id=$1 and user_id=$3",[h,today,A]);
 await enqueue();const [job]=await claim();await begin(job);await finish(job);
 const tomorrow=(await db.query('select ($1::date+1)::text d',[today])).rows[0].d+'T19:05:00Z';await enqueue(tomorrow);assert.deepEqual(await claim(tomorrow),[]);
});
it('reads the same shared forecast without private sources or leaving a worker impersonation behind',async()=>{
 await register();await save({payments:false,low_balance:true});await enqueue();const [job]=await claim();assert.equal(job.kind,'low_balance');
 await db.query("insert into public.income_occurrences(household_id,owner_id,name) values($1,$2,'SECRET EMPLOYER')",[h,B]);
 await as(null,async tx=>{
  const flow=(await tx.query('select public.nudge_forecast_context($1,$2) v',[job.id,job.claim_id])).rows[0].v;
  assert.ok(!JSON.stringify(flow).includes('SECRET'));assert.equal((await tx.query('select auth.uid() uid')).rows[0].uid,null);
 },true);
});
it('requires Money Date day and a recorded completed open period; closing removes eligibility',async()=>{
 await register();await save({payments:false,money_date:true});await db.query('update public.households set money_date_day=1 where id=$1',[h]);
 const next=(await db.query("select (date_trunc('month',$1::date)+interval '1 month')::date::text d",[today])).rows[0].d+'T19:05:00Z';
 await db.query('update public.nudge_devices set last_seen_at=$2 where user_id=$1',[A,next]);await enqueue(next);const jobs=await claim(next);assert.equal(jobs[0].kind,'money_date');
 await db.query("update public.budget_periods set status='locked' where household_id=$1",[h]);assert.equal(await begin(jobs[0],'money_date',next),null);
});
it('expires stale registrations and keeps notifications absent after pausing consent',async()=>{
 await register();await save();await payment();await enqueue();const [job]=await claim();await save({enabled:false});assert.equal(await begin(job),null);
 await save();await db.query("update public.nudge_devices set last_seen_at=now()-interval '31 days' where user_id=$1",[A]);assert.equal((await get()).device_registered,false);
});
it('denies outsiders, anonymous requests, direct writes, token reads and worker RPCs to ordinary users',async()=>{
 await register();await save();for(const table of ['nudge_preferences','nudges'])assert.equal((await as(B,tx=>tx.query(`select * from public.${table}`))).rows.length,0);
 await assert.rejects(as(A,tx=>tx.query('select * from public.nudge_devices')),/permission denied/);
 for(const table of ['nudge_preferences','nudge_devices','nudges'])for(const verb of ['delete','update'])await assert.rejects(as(A,tx=>tx.exec(verb==='delete'?`delete from public.${table}`:`update public.${table} set user_id='${A}'`)),/permission denied/);
 await assert.rejects(get(X),/Reminders unavailable/);await assert.rejects(rpc(null,'get_nudge_settings',[h,A]),/permission denied/);
 for(const [name,args] of [['enqueue_nudges',[]],['claim_nudges',[]],['nudge_kind_due',[A,'payment',now]],['nudge_forecast_context',[randomUUID(),randomUUID()]]])await assert.rejects(rpc(A,name,args),/permission denied/);
});
it('expires old-hour work before another timezone’s recipients can be starved',async()=>{
 await register();await save();await payment();await enqueue();assert.equal((await db.query("select count(*) n from public.nudges where status='pending'")).rows[0].n,1);
 await enqueue(today+'T20:05:00Z');assert.equal((await db.query("select count(*) n from public.nudges where status='pending'")).rows[0].n,0);assert.deepEqual(await claim(today+'T20:05:00Z'),[]);
});
it('uses the household timezone across DST rather than the server UTC hour',async()=>{
 await register();await save();await db.query("update public.households set timezone='America/New_York' where id=$1",[h]);await payment(A,'shared',{due:'2026-03-08'});
 assert.equal(await enqueue('2026-03-08T19:05:00Z'),0);await enqueue('2026-03-08T23:05:00Z');const jobs=await claim('2026-03-08T23:05:00Z');assert.equal(jobs.length,1);assert.equal(jobs[0].kind,'payment');
});
it('does not produce an expense-log prompt after the person logged their own private expense',async()=>{
 await register();await save({unlogged:true,payments:false});await db.query("insert into public.private_transactions(household_id,owner_id,amount_minor,description,occurred_on) values($1,$2,10,'PRIVATE PURCHASE',$3)",[h,A,today]);await enqueue();assert.deepEqual(await claim(),[]);
});
it('signing out an old installation does not suppress the same account’s newly selected delivery device',async()=>{
 await register();await save();await register(A,DB,'ExpoPushToken[new-delivery-device-token]');await payment();await enqueue();const [job]=await claim();
 await rpc(A,'unregister_nudge_device',[A,DA]);assert.equal((await get()).device_id,DB);assert.ok(await begin(job));
});
