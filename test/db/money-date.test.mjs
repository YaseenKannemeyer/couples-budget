import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { before,beforeEach,after,it } from 'node:test';
const root=new URL('../../',import.meta.url).pathname,db=new PGlite();
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',X='00000000-0000-4000-8000-000000000003';
let h,today,month,end,cat;
const as=(id,fn)=>db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);await tx.exec(id?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=(user,name,args=[])=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) value`,args)).rows[0].value);
const get=(user=A,on=month)=>rpc(user,'get_money_date',[h,on]);
const apply=async(action,values={},user=A,token,request=randomUUID(),actor=user)=>rpc(user,'apply_money_date',[h,actor,request,month,token??(await get(user)).token,action,JSON.stringify(values)]);
const check=(amount=10000)=>apply('check',{actualMinor:amount});
const options=(values={})=>apply('options',{shares:[],drawdowns:[],nextSplit:null,surplusCorrection:false,...values});
const approve=(user=A)=>apply('approve',{synced:true},user);
const close=async()=>{await approve(A);await approve(B);return apply('lock');};
before(async()=>{
 await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
 for(const f of readdirSync(root+'supabase/migrations').sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
});
beforeEach(async()=>{
 await db.exec('delete from public.households');
 const house=await rpc(A,'create_household',['Our monthly review','USD','Africa/Johannesburg','Alex']);h=house.id;
 await rpc(B,'join_household',[house.invite_code,'Sam']);
 await db.query('update public.members set monthly_allowance_minor=10000,budget_setup_step=1,monthly_income_minor=50000 where household_id=$1',[h]);
 const dates=(await db.query("select (now() at time zone 'Africa/Johannesburg')::date::text today,date_trunc('month',now() at time zone 'Africa/Johannesburg')::date::text ends_on,(date_trunc('month',now() at time zone 'Africa/Johannesburg')-interval '1 month')::date::text month_on")).rows[0];
 today=dates.today;month=dates.month_on;end=dates.ends_on;
 cat=(await db.query("select id from public.categories where household_id=$1 and visibility='shared' order by sort_order limit 1",[h])).rows[0].id;
 // A recorded completed period, as captured during its own month. Production
 // never invents a missing historical plan from current defaults.
 await db.query("insert into public.budget_periods(household_id,starts_on,ends_on,plan_snapshot) select household_id,$2,$3,plan_snapshot from public.budget_periods where household_id=$1 and starts_on=$3",[h,month,end]);
});
after(()=>db.close());
it('captures only current plans and leaves missing historic plans unknown',async()=>{
 const w=await get();assert.ok(w.period.plan_snapshot);assert.equal(w.ready,false);
 const missing=(await db.query("select ($1::date-interval '1 month')::date::text d",[month])).rows[0].d;
 await assert.rejects(get(A,missing),/Money Date unavailable/);
 await db.query('insert into public.budget_periods(household_id,starts_on,ends_on) values($1,$2,$3)',[h,missing,month]);
 const old=await get(A,missing);assert.equal(old.facts.plan,null);assert.equal(old.ready,false);assert.deepEqual(old.facts.categories,[]);
});
it('requires a completed month, closing balance, sync acknowledgement and both partners',async()=>{
 await assert.rejects(apply('approve',{synced:true}),/Money Date not ready/);
 const current=await get(A,end);
 await assert.rejects(rpc(A,'apply_money_date',[h,A,randomUUID(),end,current.token,'check',JSON.stringify({actualMinor:1})]),/Invalid Money Date input/);
 await check();assert.equal((await get()).ready,true);assert.equal((await get()).facts.expected_minor,null);
 await assert.rejects(apply('approve',{synced:false}),/Money Date not ready/);
 await approve();await assert.rejects(apply('lock'),/Money Date not ready/);
 await approve(B);await apply('lock');assert.equal((await get()).period.status,'locked');
});
it('closes exactly once after a lost response, issues allowances once and retains a fixed snapshot',async()=>{
 await check();await approve();await approve(B);
 const w=await get(),request=randomUUID();const result=await apply('lock',{},A,w.token,request);
 assert.deepEqual(await apply('lock',{},A,w.token,request),result);
 await assert.rejects(apply('lock',{changed:true},A,w.token,request),/Money Date request changed/);
 const closed=await get();assert.equal(closed.period.snapshot.allowances.length,2);
 await db.query('update public.members set monthly_allowance_minor=13000 where household_id=$1',[h]);
 assert.deepEqual((await get()).period.snapshot,closed.period.snapshot);
 const grants=(await db.query('select * from public.period_allowances where household_id=$1 and month_on=$2',[h,end])).rows;
 assert.equal(grants.length,2);assert.ok(grants.every(g=>g.amount_minor===13000));
 assert.equal((await db.query('select count(*) n from public.balance_checkins where household_id=$1',[h])).rows[0].n,1);
});
it('invalidates approvals after shared changes and permits withdrawing only your own approval',async()=>{
 await check();await approve();const stale=(await get()).token;
 await db.query('insert into public.shared_transactions(household_id,category_id,paid_by,created_by,amount_minor,occurred_on) values($1,$2,$3,$3,200,$4)',[h,cat,A,month]);
 assert.equal((await get()).approvals.find(p=>p.user_id===A).approved,false);
 await assert.rejects(apply('approve',{synced:true},B,stale),/Money Date changed/);
 await approve(A);await approve(B);await apply('withdraw',{},B);
 assert.equal((await get()).approvals.find(p=>p.user_id===A).approved,true);
 assert.equal((await get()).approvals.find(p=>p.user_id===B).approved,false);
});
it('never hashes or exposes private purchases, notes, categories, receipts or employer details',async()=>{
 await check();await approve();const token=(await get()).token;
 await db.query("insert into public.private_transactions(household_id,owner_id,amount_minor,description,occurred_on) values($1,$2,700,'PRIVATE PURCHASE',$3)",[h,B,month]);
 await db.query("insert into public.income_occurrences(household_id,owner_id,name) values($1,$2,'SECRET EMPLOYER')",[h,B]);
 const w=await get();assert.equal(w.token,token);assert.equal(w.approvals.find(a=>a.user_id===A).approved,true);
 assert.ok(!JSON.stringify(w).includes('PRIVATE'));assert.ok(!JSON.stringify(w).includes('SECRET'));
 await approve(B);await apply('lock');const locked=await get();
 assert.equal(locked.period.snapshot.allowances.find(a=>a.user_id===B).spent_minor,700);
 assert.ok(!JSON.stringify(locked).includes('PRIVATE'));assert.ok(!JSON.stringify(locked).includes('SECRET'));
});
it('uses signed confirmed shared cash after the closing anchor and charges agreed shares only at joint close',async()=>{
 await rpc(A,'save_cashflow_balance',[h,0,month,10000,500]);
 const on=(await db.query('select ($1::date+1)::text d',[month])).rows[0].d;
 await db.query('insert into public.shared_transactions(household_id,paid_by,created_by,amount_minor,occurred_on) values($1,$2,$2,1000,$3),($1,$2,$2,-200,$3)',[h,A,on]);
 await check(8800);let w=await get();assert.equal(w.facts.expected_minor,9200);assert.equal(w.facts.gap_minor,-400);assert.equal(w.ready,false);
 await options({shares:[{user_id:A,amount_minor:100},{user_id:B,amount_minor:300}]});
 assert.equal((await db.query('select count(*) n from public.balance_checkin_shares')).rows[0].n,0);
 await close();w=await get();assert.equal(w.period.snapshot.allowances.find(a=>a.user_id===A).spent_minor,100);
 assert.equal(w.period.snapshot.allowances.find(a=>a.user_id===B).spent_minor,300);
 const live=(await rpc(A,'get_cashflow',[h])).balance;assert.equal(live.amount_minor,8800);assert.equal(live.low_threshold_minor,500);
 assert.equal((await as(A,tx=>tx.query('select * from public.allowance_balances($1)',[h]))).rows.find(a=>a.user_id===B).spent_minor,0);
});
it('requires explicit surplus correction and preserves a newer actual balance',async()=>{
 await rpc(A,'save_cashflow_balance',[h,0,month,10000,500]);await check(10500);
 assert.equal((await get()).ready,false);await options({surplusCorrection:true});
 const b=(await rpc(A,'get_cashflow',[h])).balance;await rpc(A,'save_cashflow_balance',[h,b.version,today,11000,500]);
 await close();assert.equal((await rpc(A,'get_cashflow',[h])).balance.amount_minor,11000);
 assert.equal((await db.query('select count(*) n from public.shared_transactions')).rows[0].n,0);
});
it('supersedes unresolved checks explicitly when recording the month closing balance',async()=>{
 const last=(await db.query('select ($1::date-1)::text d',[end])).rows[0].d;
 await rpc(A,'save_cashflow_balance',[h,0,month,10000,0]);
 const recon=await rpc(A,'get_reconciliation',[h,last]);
 await rpc(A,'apply_reconciliation',[h,A,randomUUID(),recon.revision,'check',JSON.stringify({on:last,actualMinor:9000})]);
 await check(9000);assert.equal((await db.query("select status from public.balance_checkins where household_id=$1",[h])).rows[0].status,'superseded');
});
it('applies a one-month override without changing the permanent agreement, and expires by calendar month',async()=>{
 await check();await options({nextSplit:'equal'});await close();
 assert.equal((await rpc(A,'get_month_split',[h])).mode,'equal');assert.equal((await rpc(A,'get_month_split',[h])).temporary,true);
 assert.equal((await db.query('select split_mode from public.households where id=$1',[h])).rows[0].split_mode,'proportional');
 const later=(await db.query("select ($1::date+interval '1 month')::date::text d",[end])).rows[0].d;
 assert.equal((await db.query('select public.effective_split_mode($1,$2) mode',[h,later])).rows[0].mode,'proportional');
});
it('releases savings once without an expense, private debit, negative monthly credit or cash movement',async()=>{
 const goals=await rpc(A,'get_goals',[h]);const savings=goals.categories.find(c=>c.starter_key==='savings').id;
 const result=await rpc(A,'apply_goal',[h,A,randomUUID(),goals.revision,'save',JSON.stringify({id:null,version:0,name:'Our trip',categoryId:savings,targetMinor:10000,deadlineOn:today})]);
 await db.query("insert into public.goal_contributions(household_id,goal_id,contributor_id,amount_minor,source,occurred_on) values($1,$2,$3,4000,'scheduled',$4)",[h,result.id,A,month]);
 await check();await options({drawdowns:[{goal_id:result.id,amount_minor:1500}],nextSplit:'equal'});await close();
 const g=(await rpc(A,'get_goals',[h])).goals[0];assert.equal(g.saved_minor,2500);assert.ok(g.month.shares.every(s=>s.contributed_minor===0));assert.equal(g.month.split_mode,'equal');
 const flow=await rpc(A,'get_cashflow',[h]);assert.equal(flow.savings.reserved_minor,2500);assert.ok(flow.savings.month_allocations.every(a=>a.amount_minor>=0));
 const history=await rpc(A,'get_goal_history',[h,result.id]);assert.equal(history.filter(c=>c.source==='variance').length,1);
 assert.equal((await db.query('select count(*) n from public.shared_transactions')).rows[0].n,0);assert.equal((await db.query('select count(*) n from public.private_transactions')).rows[0].n,0);
});
it('rejects stale or overdrawn releases and invalid shares, actors and numeric payloads atomically',async()=>{
 await check();
 for(const shares of [[{user_id:X,amount_minor:1}],[{user_id:A,amount_minor:0}],[{user_id:A,amount_minor:1},{user_id:A,amount_minor:1}]])await assert.rejects(options({shares}),/Invalid Money Date input/);
 for(const actualMinor of [1.1,1000000000001,'100',null])await assert.rejects(apply('check',{actualMinor}),/Invalid Money Date input/);
 await assert.rejects(options({drawdowns:[{goal_id:X,amount_minor:1}]}),/Invalid Money Date input/);
 await assert.rejects(apply('approve',{synced:true},B,undefined,randomUUID(),A),/Money Date unavailable/);
});
it('blocks direct and RPC financial rewrites in locked months while keeping classification edits and future logging available',async()=>{
 const tx=(await db.query('insert into public.shared_transactions(household_id,paid_by,created_by,amount_minor,occurred_on) values($1,$2,$2,100,$3) returning id',[h,A,month])).rows[0].id;
 await check();await close();
 for(const sql of [
  `insert into public.shared_transactions(household_id,paid_by,created_by,amount_minor,occurred_on) values('${h}','${A}','${A}',1,'${month}')`,
  `insert into public.private_transactions(household_id,owner_id,amount_minor,occurred_on) values('${h}','${B}',1,'${month}')`,
  `update public.shared_transactions set amount_minor=200 where id='${tx}'`,
  `delete from public.shared_transactions where id='${tx}'`,
 ])await assert.rejects(db.exec(sql),/Budget period locked/);
 await db.query('update public.shared_transactions set category_id=$2,description=$3 where id=$1',[tx,cat,'Reclassified']);
 await db.query('insert into public.private_transactions(household_id,owner_id,amount_minor,occurred_on) values($1,$2,1,$3)',[h,B,today]);
 const b=(await rpc(A,'get_cashflow',[h])).balance;
 await rpc(A,'save_cashflow_balance',[h,b.version,today,12000,0]);
 for(const sql of [`update public.budget_periods set status='open' where household_id='${h}'`,`delete from public.budget_periods where household_id='${h}'`])await assert.rejects(as(A,tx=>tx.exec(sql)),/permission denied/);
});
it('protects raw tables, internal helpers, outsiders and request ownership',async()=>{
 await check();for(const table of ['money_dates','money_date_approvals','money_date_requests','period_allowances','period_split_overrides']){
  assert.equal((await as(X,tx=>tx.query(`select * from public.${table}`))).rows.length,0);
  await assert.rejects(as(A,tx=>tx.exec(`delete from public.${table}`)),/permission denied/);
 }
 assert.equal((await as(B,tx=>tx.query('select * from public.money_date_requests'))).rows.length,0);
 await assert.rejects(get(X),/Forecast unavailable/);await assert.rejects(get(null),/permission denied/);
 for(const [name,args] of [['ensure_money_period',[h,end]],['effective_split_mode',[h,today]],['money_date_canonical',['{}']]])await assert.rejects(rpc(A,name,args),/permission denied/);
});

it('requires refreshing the anchor after an independent resolution, avoiding duplicate allowance charges',async()=>{
 await rpc(A,'save_cashflow_balance',[h,0,month,10000,0]);await check(9000);
 await options({shares:[{user_id:A,amount_minor:1000}]});await approve();
 const last=(await db.query('select ($1::date-1)::text d',[end])).rows[0].d;
 let r=await rpc(A,'get_reconciliation',[h,last]);await rpc(A,'apply_reconciliation',[h,A,randomUUID(),r.revision,'check',JSON.stringify({on:last,actualMinor:9000})]);
 r=await rpc(A,'get_reconciliation',[h,last]);await rpc(A,'apply_reconciliation',[h,A,randomUUID(),r.revision,'allocate',JSON.stringify({id:r.pending.id,shares:[{userId:A,amountMinor:1000}]})]);
 assert.equal((await get()).facts.baseline_changed,true);assert.equal((await get()).ready,false);
 await assert.rejects(approve(B),/Money Date not ready/);await check(9000);assert.equal((await get()).facts.gap_minor,0);
 await close();const w=await get();assert.equal(w.period.snapshot.allowances.find(a=>a.user_id===A).spent_minor,1000);
});
it('freezes confirmed shared income and payment records while private-only income edits emit no approval signal',async()=>{
 await check();await close();
 await assert.rejects(db.query("insert into public.income_occurrences(household_id,owner_id,name,shared_on,shared_amount_minor,shared_received) values($1,$2,'Shared contribution',$3,100,true)",[h,A,month]),/Budget period locked/);
 await assert.rejects(db.query("insert into public.payment_records(household_id,schedule_ref,owner_id,payer_id,recorded_by,visibility,name,category_name,recurrence,cycle_on,due_start,due_end,amount_minor,paid_on) values($1,$2,$3,$3,$3,'shared','Bill','Utilities','one_time',$4,$4,$4,100,$4)",[h,randomUUID(),A,month]),/Budget period locked/);
 await db.query("insert into public.income_occurrences(household_id,owner_id,name,actual_on,actual_amount_minor,status) values($1,$2,'Private income',$3,700,'received')",[h,B,month]);
 const frozen=(await get()).period.snapshot;
 await db.query("update public.income_occurrences set name='Renamed private income',actual_amount_minor=800 where household_id=$1 and owner_id=$2",[h,B]);
 assert.deepEqual((await get()).period.snapshot,frozen);
});
it('retains recorded budget comparisons when defaults change and remaps only open category plans',async()=>{
 const cost=(await db.query("insert into public.budget_costs(household_id,name,amount_minor,sort_order) values($1,'Groceries',5000,0) returning id",[h])).rows[0];
 await db.query('insert into public.cashflow_budget_links(cost_id,household_id,category_id) values($1,$2,$3)',[cost.id,h,cat]);
 await db.query('update public.budget_periods set plan_snapshot=(select plan_snapshot from public.budget_periods where household_id=$1 and starts_on=$3) where household_id=$1 and starts_on=$2',[h,month,end]);
 await db.query('update public.budget_costs set amount_minor=6000 where id=$1',[cost.id]);
 await db.query('insert into public.shared_transactions(household_id,category_id,paid_by,created_by,amount_minor,occurred_on) values($1,$2,$3,$3,2000,$4)',[h,cat,A,month]);
 assert.equal((await get()).facts.categories[0].planned_minor,5000);assert.equal((await get()).facts.categories[0].spent_minor,2000);
 const cats=await rpc(A,'get_goals',[h]),c=cats.categories.find(c=>c.id===cat),replacement=cats.categories.find(c=>c.id!==cat&&!c.archived);
 await rpc(A,'archive_category',[cat,c.version,replacement.id]);const w=await get();assert.equal(w.facts.categories[0].category_id,replacement.id);assert.equal(w.facts.categories[0].spent_minor,2000);
 await check();await close();const frozen=(await get()).period.snapshot;await db.query('update public.budget_costs set amount_minor=9000 where id=$1',[cost.id]);assert.deepEqual((await get()).period.snapshot,frozen);
});
it('blocks out-of-order closing and prevents arbitrary guide steps',async()=>{
 const earlier=(await db.query("select ($1::date-interval '1 month')::date::text d",[month])).rows[0].d;
 await db.query('insert into public.budget_periods(household_id,starts_on,ends_on,plan_snapshot) select household_id,$2,$3,plan_snapshot from public.budget_periods where household_id=$1 and starts_on=$3',[h,earlier,month]);
 await check();await approve();await approve(B);await assert.rejects(apply('lock'),/Money Date not ready/);
 await assert.rejects(as(A,tx=>tx.query("insert into public.guide_progress(user_id,guide_id,guide_version,step_id,status,revision,request_id) values($1,'money-date',1,'not-a-step','in_progress',1,$2)",[A,randomUUID()])),/check constraint|permission denied/);
});
it('never lets correction of a current-month contribution make savings negative after a release',async()=>{
 let goals=await rpc(A,'get_goals',[h]);const category=goals.categories.find(c=>c.starter_key==='savings').id;
 const result=await rpc(A,'apply_goal',[h,A,randomUUID(),goals.revision,'save',JSON.stringify({id:null,version:0,name:'New goal',categoryId:category,targetMinor:10000,deadlineOn:today})]);
 goals=await rpc(A,'get_goals',[h]);await rpc(A,'apply_goal',[h,A,randomUUID(),goals.revision,'contribute',JSON.stringify({id:result.id,version:goals.goals[0].version,amountMinor:1000,on:today})]);
 const original=(await rpc(A,'get_goal_history',[h,result.id]))[0];await check();await options({drawdowns:[{goal_id:result.id,amount_minor:500}]});await close();
 goals=await rpc(A,'get_goals',[h]);await assert.rejects(rpc(A,'apply_goal',[h,A,randomUUID(),goals.revision,'reverse',JSON.stringify({id:result.id,version:goals.goals[0].version,contributionId:original.id})]),/Goal balance below correction/);
 assert.equal((await rpc(A,'get_goals',[h])).goals[0].saved_minor,500);
});
it('keeps a later-joining partner’s unrecorded historic allowance unknown rather than inventing a grant',async()=>{
 await db.query("update public.budget_periods set plan_snapshot=jsonb_set(plan_snapshot,'{members}',(select jsonb_agg(m) from jsonb_array_elements(plan_snapshot->'members') m where m->>'user_id'<>$3)) where household_id=$1 and starts_on=$2",[h,month,B]);
 await check();await close();const totals=(await get()).period.snapshot.allowances;assert.equal(totals.length,2);assert.equal(totals.find(a=>a.user_id===B).allowance_minor,null);assert.equal(totals.find(a=>a.user_id===A).allowance_minor,10000);
});

it('snapshots gifts as aggregate allowance use, protects their original month and starts the next cleanly',async()=>{
 const gw=await rpc(A,'get_goals',[h]);const savings=gw.categories.find(c=>c.starter_key==='savings').id;
 const created=await rpc(A,'apply_goal',[h,A,randomUUID(),gw.revision,'save',JSON.stringify({id:null,version:0,name:'Insurance',categoryId:savings,targetMinor:10000,deadlineOn:today,kind:'sinking'})]);
 // A real previous-month gift, seeded as if made while that period was open.
 const contribution=(await db.query("insert into public.goal_contributions(household_id,goal_id,contributor_id,amount_minor,source,occurred_on) values($1,$2,$3,1200,'gift',$4) returning id",[h,created.id,A,month])).rows[0].id;
 await db.query('insert into public.goal_allowance_entries values($1,$2,$3,1200,$4)',[h,contribution,A,month]);
 await check();await close();const locked=await get();assert.equal(locked.period.snapshot.allowances.find(a=>a.user_id===A).spent_minor,1200);
 assert.equal((await as(A,tx=>tx.query('select * from public.allowance_balances($1)',[h]))).rows.find(a=>a.user_id===A).spent_minor,0);
 assert.equal((await db.query('select count(*) n from public.private_transactions')).rows[0].n,0);
 const currentGoals=await rpc(A,'get_goals',[h]);const g=currentGoals.goals.find(g=>g.id===created.id);
 await assert.rejects(rpc(A,'apply_goal',[h,A,randomUUID(),currentGoals.revision,'reverse',JSON.stringify({id:g.id,version:g.version,contributionId:contribution})]),/Goal period locked/);
});
