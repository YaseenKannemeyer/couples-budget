import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync,readdirSync } from 'node:fs';
import { before,beforeEach,after,it } from 'node:test';
const root=new URL('../../',import.meta.url).pathname,db=new PGlite();
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',X='00000000-0000-4000-8000-000000000003';
let h,cat,today,week,goal;
const as=(id,fn)=>db.transaction(async tx=>{await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[id??'']);await tx.exec(id?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=(user,name,args=[])=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) value`,args)).rows[0].value);
const goals=()=>rpc(A,'get_goals',[h]);
const row=async()=>(await goals()).goals.find(g=>g.id===goal);
const act=async(action,values,user=A,revision,request=randomUUID(),actor=user)=>rpc(user,'apply_goal',[h,actor,request,revision??(await goals()).revision,action,JSON.stringify(values)]);
const gift=async(amount=1000,user=A)=>act('gift',{id:goal,version:(await row()).version,amountMinor:amount},user);
const boosters=()=>rpc(A,'get_boosters',[h]);
const boost=async(amount=1000,user=A,token,request=randomUUID())=>rpc(user,'apply_booster',[h,user,request,token??(await boosters()).token,'boost',JSON.stringify({categoryId:cat,weekOn:week,amountMinor:amount,goalId:goal,goalVersion:(await row()).version})]);
const allowance=async(user=A)=>as(user,async tx=>(await tx.query('select * from public.allowance_balances($1) where user_id=$2',[h,user])).rows[0]);
const expense=async(amount=10001,on=today,category=cat)=>(await db.query('insert into public.shared_transactions(household_id,paid_by,created_by,category_id,amount_minor,occurred_on) values($1,$2,$2,$3,$4,$5) returning id',[h,A,category,amount,on])).rows[0].id;
const split=(id,user=A)=>rpc(user,'get_expense_split',[h,id]);
const saveSplit=async(id,mode,weights=[],user=A,token,request=randomUUID(),actor=user)=>rpc(user,'save_expense_split',[h,actor,request,id,token??(await split(id,user)).token,mode,JSON.stringify(weights)]);
before(async()=>{
 await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
 for(const f of readdirSync(root+'supabase/migrations').sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
});
beforeEach(async()=>{
 await db.exec('delete from public.households');
 const house=await rpc(A,'create_household',['Together','USD','Africa/Johannesburg','Alex']);h=house.id;
 await rpc(B,'join_household',[house.invite_code,'Sam']);
 await db.query('update public.members set monthly_income_minor=case user_id when $2 then 60000 else 40000 end, monthly_allowance_minor=5000,budget_setup_step=1 where household_id=$1',[h,A]);
 const w=await goals();today=w.today;cat=w.categories.find(c=>c.starter_key==='savings').id;
 week=(await db.query("select (date_trunc('week',$1::date)-interval '7 days')::date::text d",[today])).rows[0].d;
 goal=(await act('save',{id:null,version:0,name:'Car licence',targetMinor:50000,deadlineOn:today,categoryId:cat,kind:'sinking'})).id;
 await db.query('insert into public.weekly_goal_budgets values($1,$2,$3,4000,1)',[h,cat,week]);
});
after(()=>db.close());
it('creates a dated sinking fund using the real savings ledger and preserves kind on review',async()=>{
 assert.equal((await row()).kind,'sinking');assert.equal((await row()).saved_minor,0);assert.equal((await row()).month.target_minor,50000);
 await act('contribute',{id:goal,version:(await row()).version,amountMinor:500,on:today});assert.equal((await row()).saved_minor,500);
});
it('gifts debit only the giver allowance and earmark once without inventing a purchase or cash transfer',async()=>{
 await rpc(A,'save_cashflow_balance',[h,0,today,20000,0]);const before=await allowance();
 await gift();assert.equal((await allowance()).remaining_minor,before.remaining_minor-1000);assert.equal((await allowance(B)).remaining_minor,5000);
 assert.equal((await row()).saved_minor,1000);assert.equal((await rpc(A,'get_cashflow',[h])).balance.amount_minor,20000);
 for(const table of ['shared_transactions','private_transactions'])assert.equal((await db.query(`select count(*) n from public.${table}`)).rows[0].n,0);
 assert.equal((await as(B,tx=>tx.query('select * from public.goal_allowance_entries'))).rows.length,0);
 assert.ok(!JSON.stringify(await goals()).includes('remaining_minor'));
});
it('checks the latest own allowance even when a review predates a private purchase',async()=>{
 const revision=(await goals()).revision,version=(await row()).version;
 await db.query('insert into public.private_transactions(household_id,owner_id,category_id,amount_minor,occurred_on) values($1,$2,$3,4500,$4)',[h,A,cat,today]);
 await assert.rejects(act('gift',{id:goal,version,amountMinor:1000},A,revision),/Gift exceeds allowance/);assert.equal((await row()).saved_minor,0);
});
it('makes gift retries idempotent, actor checked, and payload scoped',async()=>{
 const revision=(await goals()).revision,values={id:goal,version:(await row()).version,amountMinor:1000},request=randomUUID();
 const result=await act('gift',values,A,revision,request);assert.deepEqual(await act('gift',values,A,revision,request),result);assert.equal((await allowance()).remaining_minor,4000);
 await assert.rejects(act('gift',{...values,amountMinor:500},A,revision,request),/Goal request changed/);
 await assert.rejects(act('gift',values,B,revision,randomUUID(),A),/Goal unavailable/);
});
it('reverses a gift once, restores the original allowance month, and protects ownership',async()=>{
 await gift();const c=(await rpc(A,'get_goal_history',[h,goal]))[0];
 await assert.rejects(act('reverse',{id:goal,version:(await row()).version,contributionId:c.id},B),/Goal contribution unavailable/);
 await act('reverse',{id:goal,version:(await row()).version,contributionId:c.id});assert.equal((await allowance()).remaining_minor,5000);assert.equal((await row()).saved_minor,0);
 await assert.rejects(act('reverse',{id:goal,version:(await row()).version,contributionId:c.id}),/Goal contribution unavailable/);
});
it('blocks gifts to locked, archived or funded goals and rejects invalid money',async()=>{
 for(const amount of [0,-1,1.5,'10',null,5001])await assert.rejects(gift(amount));
 await act('archive',{id:goal,version:(await row()).version,archived:true});await assert.rejects(gift(),/Goal unavailable/);
 await act('archive',{id:goal,version:(await row()).version,archived:false});
 await db.query("insert into public.budget_periods(household_id,starts_on,ends_on,status) values($1,$2::date,$2::date+1,'locked')",[h,today]);
 await assert.rejects(gift(),/Budget period locked/);assert.equal((await allowance()).remaining_minor,5000);
});
it('offers only explicit completed weekly budgets, caps refunds, and excludes private spending',async()=>{
 await expense(1000,week);
 await db.query('insert into public.private_transactions(household_id,owner_id,category_id,amount_minor,occurred_on) values($1,$2,$3,3500,$4)',[h,B,cat,week]);
 let c=(await boosters()).candidates.find(c=>c.week_on===week);assert.equal(c.spent_minor,1000);assert.equal(c.available_minor,3000);
 await expense(-3000,week);c=(await boosters()).candidates.find(c=>c.week_on===week);assert.equal(c.available_minor,4000);
});
it('reserves leftover once across partners, detects changed spending, and recovers lost responses',async()=>{
 const token=(await boosters()).token;await expense(500,week);await assert.rejects(boost(1000,A,token),/Goal changed/);
 const request=randomUUID(),t=(await boosters()).token,version=(await row()).version,values={categoryId:cat,weekOn:week,amountMinor:3000,goalId:goal,goalVersion:version};
 const args=[h,A,request,t,'boost',JSON.stringify(values)];await rpc(A,'apply_booster',args);await rpc(A,'apply_booster',args);
 assert.equal((await row()).saved_minor,3000);assert.deepEqual((await row()).month.shares.map(s=>s.contributed_minor),[1800,1200]);assert.equal((await boosters()).candidates.find(c=>c.week_on===week).available_minor,500);
 await assert.rejects(boost(1000,B),/Invalid goal input/);
 assert.equal((await allowance()).remaining_minor,5000);
});
it('returns a reversed booster to its original week without creating cash or allowance entries',async()=>{
 await boost();const c=(await rpc(A,'get_goal_history',[h,goal]))[0];await act('reverse',{id:goal,version:(await row()).version,contributionId:c.id});
 assert.equal((await boosters()).candidates.find(c=>c.week_on===week).available_minor,4000);assert.equal((await row()).saved_minor,0);
 assert.equal((await db.query('select count(*) n from public.goal_allowance_entries')).rows[0].n,0);
});
it('starts weekly changes next Monday, preserves history, supports pause and rejects retroactive budgets',async()=>{
 const w=await boosters(),values={categoryId:cat,weekOn:w.next_week_on,amountMinor:2000,version:0};
 const args=[h,A,randomUUID(),w.token,'budget',JSON.stringify(values)];await rpc(A,'apply_booster',args);await rpc(A,'apply_booster',args);
 assert.equal((await boosters()).candidates.find(c=>c.week_on===week).amount_minor,4000);
 await assert.rejects(rpc(A,'apply_booster',[h,A,randomUUID(),(await boosters()).token,'budget',JSON.stringify({...values,weekOn:week,version:1})]),/Invalid goal input/);
 await rpc(A,'apply_booster',[h,A,randomUUID(),(await boosters()).token,'budget',JSON.stringify({...values,amountMinor:0,version:1})]);
 assert.equal((await boosters()).budgets.find(b=>b.starts_on===values.weekOn).amount_minor,0);
});
it('will not boost a week intersecting a closed period',async()=>{
 await db.query("insert into public.budget_periods(household_id,starts_on,ends_on,status) values($1,$2::date,$2::date+1,'locked')",[h,week]);
 await assert.rejects(boost(),/Goal period locked/);
});
it('keeps fixed and percentage splits exact down to an odd minor unit, including signed refunds',async()=>{
 const id=await expense();await saveSplit(id,'equal');assert.deepEqual((await split(id)).saved.shares.map(s=>s.amount_minor),[5001,5000]);
 await saveSplit(id,'income');assert.deepEqual((await split(id)).saved.shares.map(s=>s.amount_minor),[6001,4000]);
 await saveSplit(id,'percentage',[{userId:A,weight:2500},{userId:B,weight:7500}]);assert.deepEqual((await split(id)).saved.shares.map(s=>s.amount_minor),[2500,7501]);
 await saveSplit(id,'fixed',[{userId:A,weight:1},{userId:B,weight:10000}]);assert.deepEqual((await split(id)).saved.shares.map(s=>s.amount_minor),[1,10000]);
 const refund=await expense(-101);await saveSplit(refund,'custom',[{userId:A,weight:1},{userId:B,weight:2}]);assert.deepEqual((await split(refund)).saved.shares.map(s=>s.amount_minor),[-34,-67]);
 assert.equal((await allowance()).remaining_minor,5000);
});
it('does not guess missing incomes, supports equal/custom explicitly, and requires two current members',async()=>{
 const id=await expense();await db.query('update public.members set budget_setup_step=0 where household_id=$1',[h]);
 assert.equal((await split(id)).default_ready,false);await assert.rejects(saveSplit(id,'income'),/Expense split needs income/);await saveSplit(id,'equal');
 await db.query('delete from public.members where household_id=$1 and user_id=$2',[h,B]);await assert.rejects(saveSplit(id,'equal'),/Expense split needs partner/);
});
it('rejects forged members, duplicates, incorrect totals, decimals, negative and zero weights',async()=>{
 const id=await expense();
 for(const [mode,weights] of [['percentage',[{userId:A,weight:50},{userId:B,weight:50}]],['fixed',[{userId:A,weight:1},{userId:B,weight:1}]],['custom',[{userId:A,weight:0},{userId:B,weight:0}]],['custom',[{userId:A,weight:1.1},{userId:B,weight:2}]],['custom',[{userId:A,weight:-1},{userId:B,weight:2}]],['custom',[{userId:A,weight:1},{userId:X,weight:2}]],['custom',[{userId:A,weight:1},{userId:A,weight:2}]]])await assert.rejects(saveSplit(id,mode,weights),/Invalid expense split/);
 assert.equal((await split(id)).saved,null);
});
it('version-checks shared edits/income changes and retries the original split after an uncertain response',async()=>{
 const id=await expense(),token=(await split(id)).token,request=randomUUID();await saveSplit(id,'equal',[],A,token,request);await saveSplit(id,'equal',[],A,token,request);assert.equal((await split(id)).saved.version,1);
 await assert.rejects(saveSplit(id,'income',[],B,token),/Expense split changed/);
 const next=(await split(id)).token;await db.query('update public.members set monthly_income_minor=monthly_income_minor+1 where household_id=$1 and user_id=$2',[h,B]);await assert.rejects(saveSplit(id,'income',[],A,next),/Expense split changed/);
 await db.query('update public.shared_transactions set amount_minor=amount_minor+1 where id=$1',[id]);assert.equal((await split(id)).stale,true);await saveSplit(id,'income');assert.equal((await split(id)).stale,false);
});
it('includes splits in exact Money Date consent and prevents changing locked-period agreements',async()=>{
 const id=await expense();let w=await rpc(A,'get_money_date',[h,null]);const token=w.token;await saveSplit(id,'equal');w=await rpc(A,'get_money_date',[h,null]);assert.notEqual(w.token,token);assert.equal(w.facts.bill_splits.length,1);
 await db.query("update public.budget_periods set status='locked' where id=$1",[w.period.id]);await assert.rejects(saveSplit(id,'income'),/Budget period locked/);
});
it('denies outsider/anonymous reads, direct writes, spoofed actors and internal helper execution',async()=>{
 const id=await expense();
 for(const table of ['relationship_requests','goal_allowance_entries','weekly_goal_budgets','booster_claims','expense_splits']){
  assert.equal((await as(X,tx=>tx.query(`select * from public.${table}`))).rows.length,0);
  await assert.rejects(as(A,tx=>tx.exec(`delete from public.${table}`)),/permission denied/);
 }
 await assert.rejects(split(id,X),/Forecast unavailable/);await assert.rejects(split(id,null),/permission denied/);
 await assert.rejects(saveSplit(id,'equal',[],B,undefined,randomUUID(),A),/Expense unavailable/);
 for(const [name,args] of [['allocate_expense_split',[100,'[]']],['allowance_balances_before_gifts',[h]],['apply_goal_before_relationships',[h,A,randomUUID(),0,'gift','{}']]])await assert.rejects(rpc(A,name,args),/permission denied/);
});
