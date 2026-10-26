import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { before, after, describe, it } from 'node:test';
const root = new URL('../../', import.meta.url).pathname;
const db = new PGlite();
const A='00000000-0000-4000-8000-000000000001',B='00000000-0000-4000-8000-000000000002',X='00000000-0000-4000-8000-000000000003';
let household,cat,today,privateCat,counter=100;
const id=()=>`00000000-0000-4000-8000-${String(++counter).padStart(12,'0')}`;
const as=(user,fn)=>db.transaction(async tx=>{await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`,[user??'']);await tx.exec(user?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=(user,name,args)=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as value`,args)).rows[0].value);
const value=(patch={})=>({baseCurrency:'USD',visibility:'shared',amountMinor:12345,categoryId:cat,frequency:'one_time',paidBy:A,description:'Our groceries',note:'For the week',occurredOn:today,
 originalCurrency:null,originalAmountMinor:null,fxRate:null,scheduleId:null,scheduleVersion:null,scheduleDueStart:null,receipt:false,...patch});
const log=(user,client,values,actor=user)=>rpc(user,'log_expense',[household.id,actor,client,JSON.stringify(values)]);
const upload=(user,path,metadata={size:500,mimetype:'image/jpeg'})=>as(user,tx=>tx.query(`insert into storage.objects(bucket_id,name,metadata) values('expense-receipts',$1,$2)`,[path,JSON.stringify(metadata)]));
const count=async(table)=>(await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count;
before(async()=>{
 await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
 for(const f of readdirSync(root+'supabase/migrations').sort())await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
 household=await rpc(A,'create_household',['A & B','USD','Africa/Johannesburg','A']);
 await rpc(B,'join_household',[household.invite_code,'B']);
 const workspace=await rpc(A,'get_cashflow',[household.id]);today=workspace.today;cat=workspace.categories[0].id;
 privateCat=await rpc(A,'save_category',[household.id,null,null,JSON.stringify({name:'Hidden gift',emoji:null,bucket:'wants',visibility:'private'})]);
});
after(()=>db.close());
describe('durable quick-log boundary',()=>{
 it('logs actual payer/category/note/date once and returns the same receipt for repeated queue IDs',async()=>{
  const client=id();const input=value({paidBy:B});const first=await log(A,client,input);const n=await count('shared_transactions');
  const second=await log(A,client,{...input});assert.deepEqual(second,first);assert.equal(await count('shared_transactions'),n);
  const row=(await as(B,tx=>tx.query('select * from public.shared_transactions where id=$1',[first.transactionId]))).rows[0];
  assert.equal(row.paid_by,B);assert.equal(row.created_by,A);assert.equal(row.amount_minor,12345);assert.equal(row.note,'For the week');assert.equal(row.frequency,'one_time');
 });
 it('rejects changing a payload after that identifier committed',async()=>{
  const client=id();await log(A,client,value());
  await assert.rejects(log(A,client,value({amountMinor:12000})),/Queued expense changed/);
 });
 it('rejects wrong-session replay and isolates request records from the partner and outsiders',async()=>{
  const client=id();await log(A,client,value());
  await assert.rejects(log(B,id(),value(),A),/Not signed in/);
  await assert.rejects(log(B,client,value()),/Expense unavailable/);
  await assert.rejects(log(X,id(),value({paidBy:X})),/Forecast unavailable/);
  await assert.rejects(log(null,id(),value()),/permission denied/);
  assert.equal((await as(B,tx=>tx.query('select * from public.quick_log_requests where id=$1',[client]))).rows.length,0);
 });
 it('keeps private fields and payer ownership private, including definer writes',async()=>{
  const result=await log(A,id(),value({visibility:'private',categoryId:privateCat,description:'Secret gift'}));
  assert.equal((await as(B,tx=>tx.query('select * from public.private_transactions where id=$1',[result.transactionId]))).rows.length,0);
  await assert.rejects(log(A,id(),value({visibility:'private',paidBy:B})),/Invalid expense input/);
  await assert.rejects(log(A,id(),value({categoryId:privateCat})),/Category unavailable/);
  assert.ok(!JSON.stringify(await rpc(B,'get_cashflow',[household.id])).includes('Secret gift'));
 });
 it('retains foreign provenance while using the explicitly entered base minor amount',async()=>{
  const result=await log(A,id(),value({originalCurrency:'EUR',originalAmountMinor:10000,fxRate:'1.2345000000'}));
  const row=(await db.query('select * from public.shared_transactions where id=$1',[result.transactionId])).rows[0];
  assert.equal(row.amount_minor,12345);assert.equal(row.original_currency,'EUR');assert.equal(row.original_amount_minor,10000);
  assert.equal(Number(row.fx_rate),1.2345);
  await assert.rejects(log(A,id(),value({originalCurrency:'EUR',originalAmountMinor:1000})),/Invalid expense input/);
 });
 it('rejects bad money/dates and stores no request for failed validation',async()=>{
  const n=await count('quick_log_requests');
  for(const patch of [{amountMinor:0},{amountMinor:-10},{amountMinor:1000000000001},{occurredOn:'2099-01-01'},{occurredOn:'2026-02-30'},{description:''}])
   await assert.rejects(log(A,id(),value(patch)),/Invalid expense input/);
  assert.equal(await count('quick_log_requests'),n);
 });
 it('requires review when the household currency changed after an offline draft',async()=>{
  await db.query(`update public.households set base_currency='EUR' where id=$1`,[household.id]);
  await assert.rejects(log(A,id(),value()),/Household currency changed/);
  await db.query(`update public.households set base_currency='USD' where id=$1`,[household.id]);
 });
 it('tags standalone monthly spending without inventing a payment schedule',async()=>{
  const n=await count('scheduled_payments');await log(A,id(),value({frequency:'monthly'}));assert.equal(await count('scheduled_payments'),n);
 });
 it('atomically logs and advances a linked cycle; retries never pay the following cycle',async()=>{
  const schedule=await rpc(A,'save_scheduled_payment',[household.id,null,null,JSON.stringify({name:'Internet',payerId:A,visibility:'shared',expectedAmountMinor:10000,
    categoryId:cat,note:null,recurrence:'monthly',dateMode:'window',dueStart:today,dueEnd:today,reminderDaysBefore:null})]);
  const client=id();const input=value({scheduleId:schedule,scheduleVersion:1,scheduleDueStart:today,frequency:'monthly',originalCurrency:'EUR',originalAmountMinor:10000,fxRate:'1.2345000000'});
  const first=await log(A,client,input);assert.equal(first.scheduleRef,schedule);
  const n=await count('shared_transactions');const records=await count('payment_records');
  assert.deepEqual(await log(A,client,input),first);assert.equal(await count('shared_transactions'),n);assert.equal(await count('payment_records'),records);
  const row=(await db.query('select * from public.shared_transactions where id=$1',[first.transactionId])).rows[0];
  assert.equal(row.description,'Our groceries');assert.equal(row.frequency,'monthly');assert.equal(row.scheduled_payment_ref,schedule);assert.equal(row.original_currency,'EUR');
  await assert.rejects(log(B,id(),input),/Payment changed/);
 });
 it('blocks linking a partner’s private schedule and direct writes to request/receipt tables',async()=>{
  const schedule=await rpc(B,'save_scheduled_payment',[household.id,null,null,JSON.stringify({name:'Private bill',payerId:B,visibility:'private',expectedAmountMinor:500,
    categoryId:cat,note:null,recurrence:'one_time',dateMode:'exact',dueStart:today,dueEnd:today,reminderDaysBefore:null})]);
  await assert.rejects(log(A,id(),value({scheduleId:schedule,scheduleVersion:1,scheduleDueStart:today})),/Payment not available/);
  for(const table of ['quick_log_requests','expense_receipts'])await assert.rejects(as(A,tx=>tx.query(`delete from public.${table}`)),/permission denied/);
 });
});
describe('receipt upload lifecycle and object policies',()=>{
 it('uses a private JPEG-only 5MB bucket',async()=>{
  const bucket=(await db.query(`select * from storage.buckets where id='expense-receipts'`)).rows[0];
  assert.equal(bucket.public,false);assert.equal(Number(bucket.file_size_limit),5242880);assert.deepEqual(bucket.allowed_mime_types,['image/jpeg']);
 });
 it('allows only the original logger to upload, keeps pending shared photos hidden, then exposes ready shared photos',async()=>{
  const client=id();const result=await log(A,client,value({receipt:true}));
  await assert.rejects(upload(B,result.receiptPath),/row-level security/);
  await upload(A,result.receiptPath);
  assert.equal((await as(B,tx=>tx.query('select * from storage.objects where name=$1',[result.receiptPath]))).rows.length,0);
  await rpc(A,'finish_expense_receipt',[household.id,A,client]);
  assert.equal((await as(B,tx=>tx.query('select * from storage.objects where name=$1',[result.receiptPath]))).rows.length,1);
  assert.equal((await as(X,tx=>tx.query('select * from storage.objects where name=$1',[result.receiptPath]))).rows.length,0);
  assert.equal((await as(B,tx=>tx.query(`update storage.objects set metadata='{}' where name=$1 returning *`,[result.receiptPath]))).rows.length,0);
 });
 it('hides private receipt metadata and objects from the partner even when the path is known',async()=>{
  const client=id();const result=await log(A,client,value({visibility:'private',categoryId:privateCat,receipt:true,description:'Secret receipt'}));
  await upload(A,result.receiptPath);await rpc(A,'finish_expense_receipt',[household.id,A,client]);
  assert.equal((await as(B,tx=>tx.query('select * from public.expense_receipts where id=$1',[client]))).rows.length,0);
  assert.equal((await as(B,tx=>tx.query('select * from storage.objects where name=$1',[result.receiptPath]))).rows.length,0);
  await assert.rejects(rpc(B,'finish_expense_receipt',[household.id,B,client]),/Receipt unavailable/);
 });
 it('rejects incomplete, oversized or wrong-type uploads without hiding the saved expense',async()=>{
  const client=id();const result=await log(A,client,value({receipt:true}));
  await assert.rejects(rpc(A,'finish_expense_receipt',[household.id,A,client]),/Receipt upload pending/);
  await upload(A,result.receiptPath,{size:5242881,mimetype:'image/png'});
  await assert.rejects(rpc(A,'finish_expense_receipt',[household.id,A,client]),/Receipt upload pending/);
  assert.equal((await as(B,tx=>tx.query('select id from public.shared_transactions where id=$1',[result.transactionId]))).rows.length,1);
 });
 it('keeps this bucket private even alongside a broad policy for other storage',async()=>{
  const client=id();const result=await log(A,client,value({visibility:'private',receipt:true}));
  await upload(A,result.receiptPath);await rpc(A,'finish_expense_receipt',[household.id,A,client]);
  await db.exec(`grant select on storage.objects to anon; create policy unrelated_broad_read on storage.objects for select to anon,authenticated using(true); create policy unrelated_broad_update on storage.objects for update to authenticated using(true) with check(true);`);
  assert.equal((await as(B,tx=>tx.query('select * from storage.objects where name=$1',[result.receiptPath]))).rows.length,0);
  assert.equal((await as(null,tx=>tx.query('select * from storage.objects where name=$1',[result.receiptPath]))).rows.length,0);
  assert.equal((await as(A,tx=>tx.query(`update storage.objects set metadata='{}' where name=$1 returning *`,[result.receiptPath]))).rows.length,0);
 });
 it('removes photo bytes before metadata, preserves the expense, and leaves replay without an attachment',async()=>{
  const client=id();const input=value({receipt:true});const result=await log(A,client,input);
  await upload(A,result.receiptPath);await rpc(A,'finish_expense_receipt',[household.id,A,client]);
  await assert.rejects(rpc(A,'remove_expense_receipt',[household.id,A,client]),/Receipt upload pending/);
  await as(A,tx=>tx.query('delete from storage.objects where name=$1',[result.receiptPath]));
  await rpc(A,'remove_expense_receipt',[household.id,A,client]);
  assert.equal((await log(A,client,input)).receiptPath,null);
  assert.equal((await db.query('select id from public.shared_transactions where id=$1',[result.transactionId])).rows.length,1);
 });
});
