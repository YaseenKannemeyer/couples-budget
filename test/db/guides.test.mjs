import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
const root = new URL('../../', import.meta.url).pathname;
const db = new PGlite();
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', X='00000000-0000-4000-8000-000000000003';
const R1='00000000-0000-4000-8000-000000000011', R2='00000000-0000-4000-8000-000000000012';
const as=(id,fn)=>db.transaction(async tx=>{await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`,[id??'']);await tx.exec(id?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=(user,name,args=[])=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as value`,args)).rows[0].value);
const save=(user,id='first-visit',step='home',status='in_progress',revision=0,request=R1,version=1)=>rpc(user,'save_guide_progress',[id,version,step,status,revision,request]);
let h;
before(async()=>{
 await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
 for(const f of readdirSync(root+'supabase/migrations').sort()) await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
 const house=await rpc(A,'create_household',['Guided household','USD','Africa/Johannesburg','A']);h=house.id;
 await rpc(B,'join_household',[house.invite_code,'B']);
});
after(()=>db.close());
describe('personal discovery progress',()=>{
 it('stores only personal guide identifiers and supports lost-response retries',async()=>{
  const row=await save(A);assert.equal(row.user_id,A);assert.equal(row.revision,1);
  assert.deepEqual(Object.keys(row).sort(),['user_id','guide_id','guide_version','step_id','status','revision','request_id'].sort());
  assert.deepEqual(await save(A),row);
  await assert.rejects(save(A,'first-visit','shared','in_progress',0,R1),/Invalid guide input/);
 });
 it('never gives partners or outsiders access to another account’s progress',async()=>{
  assert.deepEqual((await as(B,tx=>tx.query('select * from public.guide_progress'))).rows,[]);
  assert.deepEqual((await as(X,tx=>tx.query('select * from public.guide_progress'))).rows,[]);
  await save(B,'first-visit','home','dismissed');
  assert.equal((await as(A,tx=>tx.query('select * from public.guide_progress'))).rows.length,1);
  assert.equal((await as(B,tx=>tx.query('select * from public.guide_progress'))).rows[0].status,'dismissed');
 });
 it('rejects anonymous access, direct writes and unsupported content',async()=>{
  await assert.rejects(save(null),/permission denied/);
  for(const sql of ['delete from public.guide_progress','update public.guide_progress set status=\'completed\'',`insert into public.guide_progress(user_id) values('${B}')`])
   await assert.rejects(as(A,tx=>tx.exec(sql)),/permission denied/);
  for(const args of [ ['future-feature','home','paused',0,R1], ['cashflow','invalid','paused',0,R1], ['cashflow','forecast','invalid',0,R1], ['cashflow','forecast','paused',0,R1,2], ['cashflow','forecast',null,0,R1] ])
   await assert.rejects(save(A,...args),/Invalid guide input/);
 });
 it('version-checks both devices and preserves dismissal until an explicit replay',async()=>{
  const row=await save(A,'first-visit','shared','dismissed',1,R2);assert.equal(row.revision,2);
  await assert.rejects(save(A,'first-visit','private','in_progress',1,R1),/Guide changed/);
  const replay=await save(A,'first-visit','home','in_progress',2,R1);assert.equal(replay.revision,3);
  assert.equal((await as(B,tx=>tx.query('select * from public.guide_progress'))).rows[0].status,'dismissed');
 });
 it('cascades personal guide progress when the auth account is deleted',async()=>{
  await save(X);await db.query('delete from auth.users where id=$1',[X]);
  assert.equal((await db.query('select * from public.guide_progress where user_id=$1',[X])).rows.length,0);
 });
});
describe('optional payday setup',()=>{
 it('requires membership, prior steps and the reviewed budget revision',async()=>{
  const revision=()=>db.query('select budget_revision from public.households where id=$1',[h]).then(r=>r.rows[0].budget_revision);
  await assert.rejects(rpc(B,'defer_budget_paydays',[h,await revision()]),/Complete the earlier budget steps/);
  await assert.rejects(rpc(null,'defer_budget_paydays',[h,await revision()]),/permission denied/);
  await assert.rejects(rpc(X,'defer_budget_paydays',[h,await revision()]),/Not a member/);
  await db.query('update public.members set budget_setup_step=3 where household_id=$1 and user_id=$2',[h,A]);
  await assert.rejects(rpc(A,'defer_budget_paydays',[h,(await revision())-1]),/Budget plan changed/);
 });
 it('finishes only this partner and preserves every saved source and forecast contribution',async()=>{
  await db.query(`insert into public.income_sources(household_id,owner_id,name,cadence,sort_order) values($1,$2,'Uncertain income','irregular',0)`,[h,A]);
  const before=(await db.query('select * from public.income_sources where owner_id=$1',[A])).rows;
  const revision=(await db.query('select budget_revision from public.households where id=$1',[h])).rows[0].budget_revision;
  await rpc(A,'defer_budget_paydays',[h,revision]);
  assert.deepEqual((await db.query('select * from public.income_sources where owner_id=$1',[A])).rows,before);
  const members=(await db.query('select user_id,budget_setup_step,budget_completed_at from public.members where household_id=$1',[h])).rows;
  assert.equal(members.find(m=>m.user_id===A).budget_setup_step,4);assert.ok(members.find(m=>m.user_id===A).budget_completed_at);
  assert.equal(members.find(m=>m.user_id===B).budget_setup_step,0);assert.equal(members.find(m=>m.user_id===B).budget_completed_at,null);
 });
});

it('accepts first-sign-in progress without resetting existing guide decisions or exposing it to a partner', async()=>{
 const before=(await as(A,tx=>tx.query("select * from public.guide_progress where guide_id='first-visit'"))).rows;
 const welcome=await save(A,'welcome','spaces','in_progress');assert.equal(welcome.step_id,'spaces');
 assert.equal((await as(B,tx=>tx.query("select * from public.guide_progress where guide_id='welcome'"))).rows.length,0);
 await save(A,'welcome','connect','completed',welcome.revision,R2);
 assert.deepEqual((await as(A,tx=>tx.query("select * from public.guide_progress where guide_id='first-visit'"))).rows,before);
 await assert.rejects(save(B,'welcome','not-shipped','paused'),/Invalid guide input/);
});
