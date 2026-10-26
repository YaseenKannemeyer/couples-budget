import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync,readdirSync } from 'node:fs';
import { before,after,describe,it } from 'node:test';
const root=new URL('../../',import.meta.url).pathname;
const db=new PGlite();
const A='00000000-0000-4000-8000-000000000001', B='00000000-0000-4000-8000-000000000002', X='00000000-0000-4000-8000-000000000003';
let h,today,cat,otherCat,sourceId,privatePayment;
const as=(id,fn)=>db.transaction(async tx=>{await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`,[id??'']);await tx.exec(id?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=async(user,name,args=[])=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as value`,args)).rows[0].value);
const shift=(date,n)=>{let d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const flow=(u=A)=>rpc(u,'get_cashflow',[h]);
const own=(u=A)=>rpc(u,'get_my_income',[h]);
const entry=(overrides={})=>({name:'Secret bonus',expectedOn:shift(today,4),expectedAmountMinor:90000,status:'expected',actualOn:null,actualAmountMinor:null,sharedOn:shift(today,5),sharedAmountMinor:12000,sharedReceived:false,...overrides});
before(async()=>{
  await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
  for(const f of readdirSync(root+'supabase/migrations').sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
  await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
  const house=await rpc(A,'create_household',['A & B','USD','Pacific/Auckland','A']);h=house.id;
  await rpc(B,'join_household',[house.invite_code,'B']);
  today=(await flow()).today;
  const cats=(await flow()).categories;cat=cats[0].id;otherCat=cats[1].id;
  await db.query(`update public.members set budget_setup_step=3 where household_id=$1`,[h]);
  const revision=(await db.query('select budget_revision from public.households where id=$1',[h])).rows[0].budget_revision;
  await rpc(A,'save_budget_paydays',[h,revision,JSON.stringify([{name:'Private employer',cadence:'monthly',amountMinor:250000,nextPayday:shift(today,2)}])]);
  sourceId=(await own()).sources[0].id;
  privatePayment=await rpc(B,'save_scheduled_payment',[h,null,null,JSON.stringify({name:'Hidden medical bill',payerId:B,visibility:'private',expectedAmountMinor:10001,categoryId:cat,note:'secret',recurrence:'one_time',dateMode:'exact',dueStart:shift(today,2),dueEnd:shift(today,2),reminderDaysBefore:null})]);
});
after(()=>db.close());
describe('cash-flow boundary and lifecycle',()=>{
 it('hides raw sources/occurrences and private payments while generating only the owner’s income',async()=>{
  const a=await own();assert.ok(a.occurrences.length>0);assert.equal(a.sources[0].name,'Private employer');
  assert.deepEqual((await own(B)).sources,[]);assert.deepEqual((await own(B)).occurrences,[]);
  assert.equal((await as(B,tx=>tx.query('select * from public.income_occurrences'))).rows.length,0);
  const shared=await flow(B);assert.deepEqual(shared.income,[]);assert.ok(!JSON.stringify(shared).includes('Private employer'));assert.ok(!JSON.stringify(shared).includes('Hidden medical'));
 });
 it('publishes only approved daily totals without source ids, names, gross amounts or owner ids',async()=>{
  await rpc(A,'save_income_contribution',[h,sourceId,1,17000,1]);
  await rpc(B,'save_income_occurrence',[h,null,0,JSON.stringify(entry({name:'Secret partner bonus',sharedOn:shift(today,3),sharedAmountMinor:3000}))]);
  const rows=(await flow(B)).income.filter(i=>i.on_date===shift(today,3));
  assert.deepEqual(rows,[{on_date:shift(today,3),confirmed:false,amount_minor:20000}]);
  assert.deepEqual(Object.keys(rows[0]).sort(),['amount_minor','confirmed','on_date']);
  assert.ok(!JSON.stringify(await flow()).includes('Secret partner'));
 });
 it('does not emit a household revision for entirely private edits',async()=>{
  const id=await rpc(A,'save_income_occurrence',[h,null,0,JSON.stringify(entry({sharedAmountMinor:0,sharedOn:null}))]);
  const revision=async()=>(await db.query('select cashflow_revision from public.households where id=$1',[h])).rows[0].cashflow_revision;
  const v=await revision();
  await rpc(A,'save_income_occurrence',[h,id,1,JSON.stringify(entry({name:'Entirely private change',expectedAmountMinor:88000,sharedAmountMinor:0,sharedOn:null}))]);
  assert.equal(await revision(),v);
 });
 it('rejects partner, outsider, anonymous and direct writes on all new tables and internal helpers',async()=>{
  for(const name of ['get_cashflow','get_my_income']){
   await assert.rejects(rpc(X,name,[h]),/Forecast unavailable/);await assert.rejects(rpc(null,name,[h]),/permission denied/);
  }
  for(const table of ['income_occurrences','cashflow_balances','cashflow_budget_links','cashflow_goal_plans','cashflow_overrides']){
   assert.equal((await as(X,tx=>tx.query(`select * from public.${table}`))).rows.length,0);
   await assert.rejects(as(A,tx=>tx.query(`delete from public.${table}`)),/permission denied/);
  }
  await assert.rejects(rpc(B,'save_income_contribution',[h,sourceId,2,1,0]),/Income unavailable/);
  for(const name of ['refresh_income','lock_cashflow'])await assert.rejects(rpc(A,name,[h]),/permission denied/);
 });
 it('version-checks source sharing and caps contributions at known income',async()=>{
  await assert.rejects(rpc(A,'save_income_contribution',[h,sourceId,1,10,0]),/Forecast changed/);
  await assert.rejects(rpc(A,'save_income_contribution',[h,sourceId,2,300000,0]),/Invalid forecast input/);
  await assert.rejects(rpc(A,'save_income_contribution',[h,sourceId,2,100,32]),/Invalid forecast input/);
 });
 it('keeps receiving salary separate from confirming a shared transfer',async()=>{
  const id=await rpc(A,'save_income_occurrence',[h,null,0,JSON.stringify(entry({status:'received',actualOn:today,actualAmountMinor:80000,sharedOn:today}))]);
  let shared=await flow(B);assert.ok(shared.income.some(i=>i.on_date===today&&!i.confirmed));
  assert.ok(!shared.income.some(i=>i.on_date===today&&i.confirmed));
  await rpc(A,'save_income_occurrence',[h,id,1,JSON.stringify(entry({status:'received',actualOn:today,actualAmountMinor:80000,sharedOn:today,sharedReceived:true}))]);
  assert.ok((await flow(B)).income.some(i=>i.on_date===today&&i.confirmed&&i.amount_minor===12000));
  await assert.rejects(rpc(B,'save_income_occurrence',[h,id,2,JSON.stringify(entry())]),/Income unavailable/);
  await assert.rejects(rpc(A,'save_income_occurrence',[h,id,1,JSON.stringify(entry())]),/Forecast changed/);
 });
 it('invalidates aggregate income corrections when one contribution becomes confirmed',async()=>{
  const date=shift(today,-1);
  const first=await rpc(A,'save_income_occurrence',[h,null,0,JSON.stringify(entry({expectedOn:date,sharedOn:date,sharedAmountMinor:1000}))]);
  await rpc(B,'save_income_occurrence',[h,null,0,JSON.stringify(entry({expectedOn:date,sharedOn:date,sharedAmountMinor:1000}))]);
  await rpc(A,'save_cashflow_override',[h,`income:${date}`,0,JSON.stringify({amountMinor:1500})]);
  await rpc(A,'save_income_occurrence',[h,first,1,JSON.stringify(entry({expectedOn:date,status:'received',actualOn:date,actualAmountMinor:90000,sharedOn:date,sharedAmountMinor:1000,sharedReceived:true}))]);
  const f=await flow(B);assert.ok(!f.overrides.some(o=>o.item_key===`income:${date}`));
  assert.deepEqual(f.income.filter(i=>i.on_date===date).map(i=>i.amount_minor).sort(),[1000,1000]);
 });
 it('rejects future received money, excessive contributions and incomplete confirmed fields',async()=>{
  await assert.rejects(rpc(A,'save_income_occurrence',[h,null,0,JSON.stringify(entry({status:'received',actualOn:shift(today,1),actualAmountMinor:90000}))]),/Invalid forecast input/);
  await assert.rejects(rpc(A,'save_income_occurrence',[h,null,0,JSON.stringify(entry({sharedAmountMinor:100000}))]),/Invalid forecast input/);
  await assert.rejects(rpc(A,'save_income_occurrence',[h,null,0,JSON.stringify(entry({actualOn:today}))]),/Invalid forecast input/);
  await assert.rejects(rpc(A,'save_income_occurrence',[h,null,0,JSON.stringify(entry({sharedReceived:true,sharedOn:today}))]),/Invalid forecast input/);
 });
 it('supports undated irregular income without inventing dates or sharing unknown salary amounts',async()=>{
  await rpc(A,'save_income_occurrence',[h,null,0,JSON.stringify(entry({expectedOn:null,expectedAmountMinor:null,sharedOn:null,sharedAmountMinor:0}))]);
  assert.ok((await own()).occurrences.some(i=>i.expected_on===null&&i.expected_amount_minor===null));
  assert.ok((await flow()).income.every(i=>i.on_date));
 });
 it('preserves source identity, contribution settings and overridden occurrences across onboarding saves',async()=>{
  const data=await own();const original=data.occurrences.find(o=>o.source_id===sourceId);
  await rpc(A,'save_income_occurrence',[h,original.id,original.version,JSON.stringify(entry({name:'Temporary payday',expectedOn:shift(today,7)}))]);
  const revision=(await db.query('select budget_revision from public.households where id=$1',[h])).rows[0].budget_revision;
  const publicRevision=(await db.query('select cashflow_revision from public.households where id=$1',[h])).rows[0].cashflow_revision;
  await rpc(A,'save_budget_paydays',[h,revision,JSON.stringify([{id:sourceId,name:'Renamed private employer',cadence:'monthly',amountMinor:260000,nextPayday:shift(today,2)}])]);
  const next=await own();assert.equal(next.sources[0].id,sourceId);assert.equal(next.sources[0].shared_amount_minor,17000);
  assert.equal(next.occurrences.find(o=>o.id===original.id).name,'Temporary payday');
  assert.equal((await db.query('select cashflow_revision from public.households where id=$1',[h])).rows[0].cashflow_revision,publicRevision);
 });
 it('uses the original 31st anchor through February, generates weekly/biweekly and never repeats irregular sources',async()=>{
  const year=Number(today.slice(0,4));const start=`${year}-01-31`;
  const revision=(await db.query('select budget_revision from public.households where id=$1',[h])).rows[0].budget_revision;
  await rpc(B,'save_budget_paydays',[h,revision,JSON.stringify([
   {name:'Monthly',cadence:'monthly',amountMinor:100,nextPayday:start},
   {name:'Weekly',cadence:'weekly',amountMinor:200,nextPayday:today},
   {name:'Fortnight',cadence:'biweekly',amountMinor:300,nextPayday:today},
   {name:'Undated',cadence:'irregular',amountMinor:null,nextPayday:null},
   {name:'One-off',cadence:'irregular',amountMinor:null,nextPayday:today}
  ])]);
  const data=await own(B);const monthly=data.occurrences.filter(o=>o.name==='Monthly');
  assert.ok(monthly.some(o=>o.original_on.endsWith('-03-31')));
  assert.ok(monthly.some(o=>o.original_on.slice(5,7)==='02'&&['28','29'].includes(o.original_on.slice(8))));
  assert.equal(data.occurrences.filter(o=>o.name==='Undated').length,0);
  assert.equal(data.occurrences.filter(o=>o.name==='One-off').length,1);
  for(const [name,gap] of [['Weekly',7],['Fortnight',14]]){
   const dates=data.occurrences.filter(o=>o.name===name).map(o=>o.expected_on);assert.equal(dates[1],shift(dates[0],gap));
  }
 });
 it('stores signed closing balances with conflict and household-date checks',async()=>{
  await rpc(A,'save_cashflow_balance',[h,0,today,-500,2000]);
  assert.equal((await flow(B)).balance.amount_minor,-500);
  await assert.rejects(rpc(B,'save_cashflow_balance',[h,0,today,100,0]),/Forecast changed/);
  await assert.rejects(rpc(A,'save_cashflow_balance',[h,1,shift(today,1),100,0]),/Invalid forecast input/);
 });
 it('supports shared reservations and category links, rejecting private categories and stale edits',async()=>{
  await db.query(`insert into public.budget_costs(household_id,name,amount_minor,sort_order) values($1,'Monthly goal',15000,0)`,[h]);
  const cost=(await flow()).budgets[0];
  await rpc(A,'save_cashflow_plan',[h,'budget',cost.id,0,JSON.stringify({categoryId:cat})]);
  await rpc(B,'save_cashflow_plan',[h,'goal',null,0,JSON.stringify({name:'Trip',categoryId:cat,dueOn:shift(today,10),amountMinor:10000})]);
  assert.equal((await flow()).budgets[0].category_id,cat);assert.equal((await flow()).goals[0].name,'Trip');
  await assert.rejects(rpc(B,'save_cashflow_plan',[h,'budget',cost.id,0,JSON.stringify({categoryId:cat})]),/Forecast changed/);
  const privateCat=await rpc(A,'save_category',[h,null,null,JSON.stringify({name:'Secret category',emoji:null,bucket:'savings',visibility:'private'})]);
  await assert.rejects(rpc(A,'save_cashflow_plan',[h,'goal',null,0,JSON.stringify({name:'Leak',categoryId:privateCat,dueOn:today,amountMinor:1})]),/Category unavailable/);
 });
 it('preserves cost category links across unchanged onboarding saves',async()=>{
  const f=await flow();const cost=f.budgets[0];
  const revision=(await db.query('select budget_revision from public.households where id=$1',[h])).rows[0].budget_revision;
  await rpc(A,'save_budget_costs',[h,revision,JSON.stringify([{id:cost.id,name:cost.name,amountMinor:cost.amount_minor}])]);
  const next=(await flow()).budgets[0];assert.equal(next.id,cost.id);assert.equal(next.category_id,cat);assert.equal(next.version,cost.version);
 });
 it('allows corrections to visible targets without mutating schedules and gives identical errors for private/missing targets',async()=>{
  const goal=(await flow()).goals[0];
  await rpc(B,'save_cashflow_override',[h,`goal:${goal.id}`,0,JSON.stringify({dueOn:shift(today,12),amountMinor:4000,dismissed:false})]);
  const f=await flow();assert.equal(f.goals[0].due_on,shift(today,10));assert.equal(f.goals[0].amount_minor,10000);
  assert.equal(f.overrides[0].amount_minor,4000);
  await assert.rejects(rpc(A,'save_cashflow_override',[h,`goal:${goal.id}`,0,null]),/Forecast changed/);
  for(const id of [privatePayment,'00000000-0000-4000-8000-000000000099'])
    await assert.rejects(rpc(A,'save_cashflow_override',[h,`payment:${id}:${shift(today,2)}`,0,JSON.stringify({dismissed:true})]),/Forecast unavailable/);
 });
 it('reassigns calendar links and goals when a shared category is archived',async()=>{
  const c=(await flow()).categories.find(c=>c.id===cat);
  await rpc(A,'archive_category',[cat,c.version,otherCat]);
  const f=await flow();assert.equal(f.budgets[0].category_id,otherCat);assert.equal(f.goals[0].category_id,otherCat);
 });
});
