import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { before,beforeEach,after,it } from 'node:test';
const root=new URL('../../',import.meta.url).pathname,db=new PGlite();
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',X='00000000-0000-4000-8000-000000000003';
let h,today,deadline,cat;
const as=(id,fn)=>db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);await tx.exec(id?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=(user,name,args=[])=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) value`,args)).rows[0].value);
const get=(user=A)=>rpc(user,'get_goals',[h]);
const apply=async(action,values,user=A,revision,request=randomUUID(),actor=user)=>rpc(user,'apply_goal',[h,actor,request,revision??(await get(user)).revision,action,JSON.stringify(values)]);
const create=(values={})=>apply('save',{id:null,version:0,name:'Our trip',targetMinor:10001,deadlineOn:deadline,categoryId:cat,...values});
const row=async(id)=>(await get()).goals.find(g=>g.id===id);
const contribute=async(id,amount=1000,user=A,on=today)=>apply('contribute',{id,version:(await row(id)).version,amountMinor:amount,on},user);
before(async()=>{
 await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
 for(const f of readdirSync(root+'supabase/migrations').sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
});
beforeEach(async()=>{
 await db.exec('delete from public.households');
 const house=await rpc(A,'create_household',['Our goals','USD','Africa/Johannesburg','Alex']);h=house.id;
 await rpc(B,'join_household',[house.invite_code,'Sam']);
 await db.query(`update public.members set monthly_income_minor=case user_id when $2 then 60000 else 40000 end,budget_setup_step=1 where household_id=$1`,[h,A]);
 today=(await get()).today;deadline=(await db.query("select (date_trunc('month',$1::date)+interval '2 months' - interval '1 day')::date::text value",[today])).rows[0].value;
 cat=(await get()).categories.find(c=>c.starter_key==='savings').id;
});
after(()=>db.close());

it('creates exact monthly and proportional partner targets without inventing savings',async()=>{
 const {id}=await create();const g=await row(id);assert.equal(g.saved_minor,0);assert.equal(g.month.target_minor,5001);assert.equal(g.month.split_ready,true);
 assert.equal(g.month.shares.reduce((s,v)=>s+Number(v.target_minor),0),5001);
 assert.equal(g.month.shares.find(s=>s.user_id===A).target_minor,3001);assert.equal(g.month.shares.find(s=>s.user_id===B).target_minor,2000);
});
it('keeps the monthly target fixed while each partner contributes and never writes an expense',async()=>{
 const {id}=await create();await contribute(id,3001);await contribute(id,2000,B);
 const g=await row(id);assert.equal(g.saved_minor,5001);assert.equal(g.month.target_minor,5001);
 assert.equal(g.month.shares.find(s=>s.user_id===A).contributed_minor,3001);assert.equal(g.month.shares.find(s=>s.user_id===B).contributed_minor,2000);
 assert.equal((await db.query('select count(*) n from public.shared_transactions')).rows[0].n,0);
 assert.equal((await db.query('select count(*) n from public.private_transactions')).rows[0].n,0);
});
it('marks missing income/partner shares pending until an explicit replan, honoring equal/combined splits',async()=>{
 await db.query('update public.members set budget_setup_step=0 where household_id=$1 and user_id=$2',[h,B]);
 const {id}=await create();assert.equal((await row(id)).month.split_ready,false);assert.ok((await row(id)).month.shares.every(s=>s.target_minor===null));
 await db.query('update public.members set budget_setup_step=1 where household_id=$1 and user_id=$2',[h,B]);
 assert.equal((await row(id)).month.split_ready,false);
 await apply('replan',{id,version:(await row(id)).version});assert.equal((await row(id)).month.split_ready,true);
 await db.query("update public.households set split_mode='equal' where id=$1",[h]);
 await apply('replan',{id,version:(await row(id)).version});assert.deepEqual((await row(id)).month.shares.map(s=>s.target_minor),[2501,2500]);
 await db.query("update public.households set split_mode='combined' where id=$1",[h]);
 await apply('replan',{id,version:(await row(id)).version});assert.equal((await row(id)).month.shares.find(s=>s.user_id===A).target_minor,3001);
});
it('is idempotent after lost responses and rejects actor/request/payload changes',async()=>{
 const {id}=await create();const g=await row(id),revision=(await get()).revision,request=randomUUID(),values={id,version:g.version,amountMinor:1000,on:today};
 const result=await apply('contribute',values,A,revision,request);assert.deepEqual(await apply('contribute',values,A,revision,request),result);
 assert.equal((await row(id)).saved_minor,1000);
 await assert.rejects(apply('contribute',{...values,amountMinor:1001},A,revision,request),/Goal request changed/);
 await assert.rejects(apply('contribute',values,B,undefined,randomUUID(),A),/Goal unavailable/);
});
it('rejects stale edits/contributions and invalid or excessive money/dates atomically',async()=>{
 const {id}=await create();const g=await row(id),revision=(await get()).revision;await contribute(id,1000,B);
 await assert.rejects(apply('contribute',{id,version:g.version,amountMinor:1,on:today},A,revision),/Goal changed/);
 for(const amountMinor of [0,-1,1.1,10002,null,'100'])await assert.rejects(contribute(id,amountMinor),/Invalid goal input/);
 await assert.rejects(contribute(id,1,A,'2099-01-01'),/Invalid goal input/);
 assert.equal((await row(id)).saved_minor,1000);
});
it('reverses only the owner’s genuine contribution, once, retaining immutable history',async()=>{
 const {id}=await create();await contribute(id,3000);let history=await rpc(A,'get_goal_history',[h,id]);const c=history[0];
 await assert.rejects(apply('reverse',{id,version:(await row(id)).version,contributionId:c.id},B),/Goal contribution unavailable/);
 const revision=(await get()).revision,request=randomUUID(),values={id,version:(await row(id)).version,contributionId:c.id};
 await apply('reverse',values,A,revision,request);await apply('reverse',values,A,revision,request);
 assert.equal((await row(id)).saved_minor,0);history=await rpc(A,'get_goal_history',[h,id]);assert.equal(history.length,2);assert.equal(history.find(r=>r.id===c.id).reversed,true);
 await assert.rejects(apply('reverse',{...values,version:(await row(id)).version}),/Goal contribution unavailable/);
});
it('reserves saved funds and remaining monthly targets in cash flow without changing actual cash',async()=>{
 const {id}=await create();await contribute(id,3000);
 await rpc(A,'save_cashflow_balance',[h,0,today,20000,0]);
 const flow=await rpc(A,'get_cashflow',[h]);assert.equal(flow.balance.amount_minor,20000);assert.equal(flow.savings.reserved_minor,3000);
 assert.equal(flow.savings.month_allocations.find(c=>c.category_id===cat).amount_minor,3000);
 assert.equal(flow.savings.plans[0].amount_minor,2001);assert.equal(flow.savings.plans.reduce((s,p)=>s+p.amount_minor,0),7001);
 const recon=await rpc(A,'get_reconciliation',[h,today]);assert.equal(recon.expected_minor,20000);
});
it('replaces an explicitly selected forecast reservation without claiming it was saved money',async()=>{
 await rpc(A,'save_cashflow_plan',[h,'goal',null,0,JSON.stringify({name:'Trip reservation',categoryId:cat,amountMinor:5000,dueOn:today})]);
 const planRow=(await get()).forecast_plans[0],plan=planRow.id;
 const {id}=await create({replacePlanId:plan,replacePlanVersion:planRow.version});
 assert.equal((await row(id)).saved_minor,0);assert.equal((await get()).forecast_plans.length,0);
 assert.deepEqual((await rpc(A,'get_cashflow',[h])).goals,[]);
});
it('archives without releasing saved earmarks and never accepts unshipped gift/booster payloads',async()=>{
 const {id}=await create();await contribute(id,1000);
 await apply('archive',{id,version:(await row(id)).version,archived:true});
 const flow=await rpc(A,'get_cashflow',[h]);assert.equal(flow.savings.reserved_minor,1000);assert.deepEqual(flow.savings.plans,[]);
 await assert.rejects(contribute(id),/Invalid goal input/);
 await assert.rejects(apply('contribute',{id,version:(await row(id)).version,amountMinor:100,on:today,source:'gift'}),/Invalid goal input/);
});
it('blocks locked-period changes and target reductions below recorded savings',async()=>{
 const {id}=await create();await contribute(id,1000);
 await assert.rejects(create({id,version:(await row(id)).version,targetMinor:999}),/Goal target below saved/);
 await db.query(`insert into public.budget_periods(household_id,starts_on,ends_on,status) values($1,$2::date,$2::date+1,'locked')`,[h,today]);
 await assert.rejects(contribute(id,1),/Goal period locked/);
 const c=(await rpc(A,'get_goal_history',[h,id]))[0];await assert.rejects(apply('reverse',{id,version:(await row(id)).version,contributionId:c.id}),/Goal period locked/);
});
it('reassigns a shared goal when its category is archived and keeps private categories unavailable',async()=>{
 const {id}=await create();const cats=(await get()).categories,replacement=cats.find(c=>c.id!==cat&&!c.archived);
 await rpc(A,'archive_category',[cat,cats.find(c=>c.id===cat).version,replacement.id]);assert.equal((await row(id)).category_id,replacement.id);
 const privateCat=(await db.query("insert into public.categories(household_id,name,visibility,owner_id) values($1,'Hidden label','private',$2) returning id",[h,B])).rows[0].id;
 await assert.rejects(create({categoryId:privateCat}),/Invalid goal input/);
 assert.ok(!JSON.stringify(await get(A)).includes('Hidden label'));
});
it('isolates outsiders, anonymous/direct writes, internal helpers and owner request records',async()=>{
 const {id}=await create();await contribute(id);
 for(const table of ['goals','goal_contributions','goal_months','goal_requests']){
  assert.equal((await as(X,tx=>tx.query(`select * from public.${table}`))).rows.length,0);
  for(const sql of [`delete from public.${table}`,`update public.${table} set household_id='${h}'`,`insert into public.${table}(household_id) values('${h}')`])await assert.rejects(as(A,tx=>tx.exec(sql)),/permission denied/);
 }
 assert.equal((await as(B,tx=>tx.query('select * from public.goal_requests'))).rows.length,0);
 await assert.rejects(get(X),/Forecast unavailable/);await assert.rejects(get(null),/permission denied/);
 await assert.rejects(rpc(A,'prepare_goal_month',[h,id,false]),/permission denied/);
 await assert.rejects(rpc(A,'get_cashflow_before_goals',[h]),/permission denied/);
});

it('uses exact integer allocation for large targets and marks completion without overfunding',async()=>{
 await db.query('update public.members set monthly_income_minor=case user_id when $2 then 1000000000000 else 333333333333 end where household_id=$1',[h,A]);
 const {id}=await create({targetMinor:1000000000000,deadlineOn:today});const g=await row(id);
 assert.equal(g.month.shares.reduce((s,p)=>s+p.target_minor,0),1000000000000);
 const result=await contribute(id,1000000000000);assert.equal(result.completed,true);
 await assert.rejects(contribute(id,1),/Invalid goal input/);
});

it('invalidates an opened monthly-plan review when the household split changes',async()=>{
 const {id}=await create();const revision=(await get()).revision,g=await row(id);
 await as(B,tx=>tx.query("update public.households set split_mode='equal' where id=$1",[h]));
 await assert.rejects(apply('replan',{id,version:g.version},A,revision),/Goal changed/);
 assert.equal((await row(id)).month.split_mode,'proportional');
});

it('paginates equal-time history with a stable UUID cursor and includes corrections exactly once',async()=>{
 const {id}=await create();
 for(let n=0;n<51;n++)await contribute(id,1);
 const first=await rpc(A,'get_goal_history',[h,id]);assert.equal(first.length,50);
 const last=first.at(-1),second=await rpc(A,'get_goal_history',[h,id,last.created_at,last.id]);assert.equal(second.length,1);
 assert.equal(new Set([...first,...second].map(c=>c.id)).size,51);
});

it('does not include private purchases or source details in goal summaries or signals',async()=>{
 await create();const revision=(await get()).revision;
 await db.query("insert into public.private_transactions(household_id,owner_id,category_id,amount_minor,description,occurred_on) values($1,$2,$3,700,'PRIVATE PURCHASE',$4)",[h,B,cat,today]);
 await db.query("insert into public.income_occurrences(household_id,owner_id,name) values($1,$2,'PRIVATE EMPLOYER')",[h,B]);
 assert.equal((await get()).revision,revision);assert.ok(!JSON.stringify(await get(A)).includes('PRIVATE'));
});
