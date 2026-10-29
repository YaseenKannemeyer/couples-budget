import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { before, beforeEach, after, it } from 'node:test';

const root=new URL('../../',import.meta.url).pathname, db=new PGlite();
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', X='00000000-0000-4000-8000-000000000003';
let h,today,yesterday,cat;
const as=(id,fn)=>db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);await tx.exec(id?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=(user,name,args=[])=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) value`,args)).rows[0].value);
const get=(user=A,on=null)=>rpc(user,'get_reconciliation',[h,on]);
const apply=async(action,values,user=A,revision,request=randomUUID())=>rpc(user,'apply_reconciliation',[h,user,request,revision??(await get(user)).revision,action,JSON.stringify(values)]);
const baseline=()=>rpc(A,'save_cashflow_balance',[h,0,yesterday,10000,700]);
const check=(actualMinor=9000,user=A,on=today)=>apply('check',{on,actualMinor},user);
const spending=(amount=1000,on=today)=>as(A,tx=>tx.query(`insert into public.shared_transactions(household_id,category_id,paid_by,amount_minor,description,occurred_on) values($1,$2,$3,$4,'Shared expense',$5) returning id`,[h,cat,A,amount,on]));
const allocation=(id,shares,user=A)=>apply('allocate',{id,shares},user);
const balances=()=>as(A,async tx=>(await tx.query('select * from public.allowance_balances($1)',[h])).rows.map(row=>({...row,spent_minor:Number(row.spent_minor),remaining_minor:Number(row.remaining_minor)})));
before(async()=>{
 await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
 for(const f of readdirSync(root+'supabase/migrations').sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
});
beforeEach(async()=>{
 await db.exec('delete from public.households');
 const house=await rpc(A,'create_household',['Reconciliation','USD','Africa/Johannesburg','A']);h=house.id;
 await rpc(B,'join_household',[house.invite_code,'B']);
 await db.query('update public.members set monthly_allowance_minor=5000 where household_id=$1',[h]);
 today=(await get()).today;
 yesterday=(await db.query('select ($1::date-1)::text value',[today])).rows[0].value;
 cat=(await as(A,tx=>tx.query('select id from public.categories where household_id=$1 order by sort_order limit 1',[h]))).rows[0].id;
});
after(()=>db.close());

it('establishes a first observed balance without inventing a gap or spending',async()=>{
 const initial=await get();assert.equal(initial.baseline,null);assert.equal(initial.expected_minor,null);
 await check(-2500);
 const next=await get();assert.equal(next.pending,null);assert.equal(next.history[0].resolution,'opening');
 assert.equal(next.history[0].expected_minor,null);assert.equal(next.baseline.amount_minor,-2500);
 assert.equal((await db.query('select count(*) n from public.shared_transactions')).rows[0].n,0);
});
it('uses confirmed shared cash only, respects closing-day boundaries and subtracts signed refunds',async()=>{
 await baseline();await spending(1200);await spending(-200);await spending(777,yesterday);
 await db.query(`insert into public.private_transactions(household_id,owner_id,category_id,amount_minor,description,occurred_on) values($1,$2,$3,765,'PRIVATE SECRET',$4)`,[h,B,cat,today]);
 await db.query(`insert into public.income_occurrences(household_id,owner_id,name,expected_on,expected_amount_minor,status,actual_on,actual_amount_minor,shared_on,shared_amount_minor,shared_received)
  values($1,$2,'PRIVATE EMPLOYER',$3,6000,'received',$3,6000,$3,3000,true),($1,$2,'EXPECTED ONLY',$3,9000,'expected',null,null,$3,4000,false)`,[h,B,today]);
 assert.equal((await get()).expected_minor,12000);
 const response=await check(11500);const state=await get();assert.equal(state.pending.gap_minor,-500);
 assert.equal(state.pending.id,response.id);assert.equal(state.baseline.amount_minor,10000);
 assert.ok(!JSON.stringify(state).includes('PRIVATE'));assert.ok(!JSON.stringify(state).includes('EXPECTED ONLY'));
});
it('retries checks and allowance resolution without duplicated charges or checkpoints',async()=>{
 await baseline();const revision=(await get()).revision, request=randomUUID(), values={on:today,actualMinor:9000};
 const first=await apply('check',values,A,revision,request);
 assert.deepEqual(await apply('check',values,A,revision,request),first);
 await assert.rejects(apply('check',{...values,actualMinor:8000},A,revision,request),/request changed/);
 const r2=(await get()).revision,q2=randomUUID(),shares=[{userId:A,amountMinor:1000}];
 await apply('allocate',{id:first.id,shares},A,r2,q2);
 await apply('allocate',{id:first.id,shares},A,r2,q2);
 assert.equal((await get()).history.length,1);assert.equal((await balances()).find(m=>m.user_id===A).spent_minor,1000);
 assert.equal((await db.query('select count(*) n from public.private_transactions')).rows[0].n,0);
 assert.equal((await get()).baseline.low_threshold_minor,700);
});
it('requires both partners consent before applying a split and preserves ordinary private spending',async()=>{
 await baseline();const {id}=await check(9000);
 await db.query(`insert into public.private_transactions(household_id,owner_id,category_id,amount_minor,description,occurred_on) values($1,$2,$3,200,'Private',$4)`,[h,A,cat,today]);
 await allocation(id,[{userId:A,amountMinor:600},{userId:B,amountMinor:400}]);
 assert.equal((await balances()).find(m=>m.user_id===A).spent_minor,200);
 assert.equal((await balances()).find(m=>m.user_id===B).spent_minor,0);
 await assert.rejects(apply('approve',{id},A),/Reconciliation changed/);
 await apply('approve',{id},B);
 const rows=await balances();assert.equal(rows.find(m=>m.user_id===A).spent_minor,800);assert.equal(rows.find(m=>m.user_id===B).remaining_minor,4600);
 assert.equal((await get()).history[0].resolution,'allowance');assert.equal((await get()).baseline.amount_minor,9000);
 assert.equal((await as(A,tx=>tx.query('select * from public.private_transactions where owner_id=$1',[B]))).rows.length,0);
});
it('rejects assigning only the partner, duplicate/outsider/zero shares and incorrect totals atomically',async()=>{
 await baseline();const {id}=await check(9000);
 for(const shares of [[{userId:B,amountMinor:1000}],[{userId:A,amountMinor:500},{userId:A,amountMinor:500}],
  [{userId:A,amountMinor:500},{userId:X,amountMinor:500}],[{userId:A,amountMinor:0}], [{userId:A,amountMinor:999}]]){
  await assert.rejects(allocation(id,shares),/Invalid reconciliation input/);
  assert.deepEqual((await get()).pending.shares,[]);
 }
});
it('invalidates stale submissions when shared entries change, but private writes emit no revision',async()=>{
 await baseline();const revision=(await get()).revision;await spending();
 await assert.rejects(apply('check',{on:today,actualMinor:9000},A,revision),/Reconciliation changed/);
 const current=(await get()).revision;
 await db.query(`insert into public.private_transactions(household_id,owner_id,category_id,amount_minor,description,occurred_on) values($1,$2,$3,100,'SECRET',$4)`,[h,B,cat,today]);
 await db.query(`insert into public.income_occurrences(household_id,owner_id,name) values($1,$2,'SECRET SALARY')`,[h,B]);
 assert.equal((await get()).revision,current);
});
it('recomputes a gap after a missing expense is logged and resolves without double-counting it',async()=>{
 await baseline();const {id}=await check(9000);await spending();
 const pending=(await get()).pending;assert.equal(pending.current_expected_minor,9000);assert.equal(pending.gap_minor,0);
 await apply('match',{id});
 assert.equal((await get()).pending,null);assert.equal((await get()).expected_minor,9000);
 assert.equal((await balances()).find(m=>m.user_id===A).spent_minor,0);
});
it('rejects an obsolete split after shared spending changes and allows cancelling it',async()=>{
 await baseline();const {id}=await check(9000);
 await allocation(id,[{userId:A,amountMinor:500},{userId:B,amountMinor:500}]);await spending(200);
 await assert.rejects(apply('approve',{id},B),/Reconciliation changed/);
 await apply('cancel-shares',{id},B);assert.deepEqual((await get()).pending.shares,[]);
});
it('supports explicitly acknowledged surplus corrections without fabricating a refund',async()=>{
 await baseline();const {id}=await check(11000);
 await assert.rejects(allocation(id,[{userId:A,amountMinor:1000}]),/Invalid reconciliation input/);
 await apply('correction',{id});const state=await get();assert.equal(state.history[0].resolution,'correction');
 assert.equal(state.history[0].resolved_expected_minor,10000);assert.equal(state.baseline.amount_minor,11000);
 assert.equal((await db.query('select count(*) n from public.shared_transactions')).rows[0].n,0);
});
it('detects a replaced cash-flow baseline and retains superseded observations as history',async()=>{
 await baseline();const {id}=await check();
 await rpc(A,'save_cashflow_balance',[h,1,today,9500,700]);
 assert.equal((await get()).pending.baseline_changed,true);
 await assert.rejects(allocation(id,[{userId:A,amountMinor:1000}]),/baseline changed/);
 await check(9500);const state=await get();assert.equal(state.pending,null);
 assert.ok(state.history.some(c=>c.id===id&&c.status==='superseded'));
});
it('protects every table/helper from outsiders, anonymous users and direct writes',async()=>{
 await baseline();const {id}=await check();await allocation(id,[{userId:A,amountMinor:500},{userId:B,amountMinor:500}]);
 for(const table of ['balance_checkins','balance_checkin_shares','reconciliation_requests']){
  assert.equal((await as(X,tx=>tx.query(`select * from public.${table}`))).rows.length,0);
  for(const sql of [`delete from public.${table}`,`update public.${table} set household_id='${h}'`,`insert into public.${table}(household_id) values('${h}')`])
   await assert.rejects(as(A,tx=>tx.exec(sql)),/permission denied/);
 }
 assert.ok((await get(B)).pending);assert.equal((await as(B,tx=>tx.query('select * from public.reconciliation_requests'))).rows.length,0);
 await assert.rejects(get(X),/Forecast unavailable/);await assert.rejects(get(null),/permission denied/);
 await assert.rejects(apply('approve',{id},X,0),/Forecast unavailable/);
 await assert.rejects(rpc(A,'reconciliation_expected',[h,yesterday,10000,today]),/permission denied/);
});
it('validates real dates, integer amounts, safe limits and locked budget periods',async()=>{
 await baseline();
 for(const values of [{on:today,actualMinor:1.2},{on:'2026-02-30',actualMinor:1},{on:'2099-01-01',actualMinor:1},
  {on:'2000-01-01',actualMinor:1},{on:today,actualMinor:1000000000001},{on:today,actualMinor:null},{on:today,actualMinor:'100'}])
  await assert.rejects(apply('check',values),/Invalid reconciliation input/);
 await db.query(`insert into public.budget_periods(household_id,starts_on,ends_on,status) values($1,$2::date,$2::date+1,'locked')`,[h,today]);
 await assert.rejects(check(),/period locked/);
});
it('registers the contextual guide without permitting arbitrary steps',async()=>{
 await rpc(A,'save_guide_progress',['reconciliation',1,'compare','in_progress',0,randomUUID()]);
 await assert.rejects(rpc(A,'save_guide_progress',['reconciliation',1,'not-shipped','paused',1,randomUUID()]),/Invalid guide input/);
});

it('rejects an account-switched or spoofed actor before writing any reconciliation',async()=>{
 await baseline();const revision=(await get()).revision;
 await assert.rejects(rpc(B,'apply_reconciliation',[h,A,randomUUID(),revision,'check',JSON.stringify({on:today,actualMinor:9000})]),/Reconciliation unavailable/);
 assert.equal((await get()).history.length,0);assert.equal((await get()).pending,null);
});

it('attributes a prior-month gap to that month, without reducing the current allowance',async()=>{
 const previousEnd=(await db.query("select (date_trunc('month',$1::date)::date-1)::text value",[today])).rows[0].value;
 const previousStart=(await db.query('select ($1::date-1)::text value',[previousEnd])).rows[0].value;
 await rpc(A,'save_cashflow_balance',[h,0,previousStart,10000,0]);
 const {id}=await check(9000,A,previousEnd);await allocation(id,[{userId:A,amountMinor:1000}]);
 assert.equal((await balances()).find(m=>m.user_id===A).spent_minor,0);
 assert.equal((await get()).history[0].as_of_on,previousEnd);
});

it('replacing an unresolved proposal never applies its already-approved share',async()=>{
 await baseline();const {id}=await check();await allocation(id,[{userId:A,amountMinor:500},{userId:B,amountMinor:500}]);
 await check(10000);
 assert.equal((await balances()).find(m=>m.user_id===A).spent_minor,0);
 assert.equal((await balances()).find(m=>m.user_id===B).spent_minor,0);
 await assert.rejects(apply('approve',{id},B),/Reconciliation unavailable/);
});
