import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { before, after, it } from 'node:test';
const root = new URL('../../',import.meta.url).pathname;
const db = new PGlite();
const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const A=uuid(1),B=uuid(2),X=uuid(3); let h,other,shared,privateId,second;
const as=(id,fn)=>db.transaction(async tx=>{await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`,[id??'']);await tx.exec(id?'set local role authenticated':'set local role anon');return fn(tx);});
const rpc=(user,name,args)=>as(user,async tx=>(await tx.query(`select to_jsonb(public.${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})) as value`,args)).rows[0].value);
const save=(u,id,body,version=0,tid=shared,hid=h,actor=u)=>rpc(u,'save_transaction_comment',[hid,tid,actor,id,version,body]);
const remove=(u,id,version,tid=shared)=>rpc(u,'remove_transaction_comment',[h,tid,u,id,version]);
const react=(u,kind,active,tid=shared,hid=h,actor=u)=>rpc(u,'set_transaction_reaction',[hid,tid,actor,kind,active]);
const rows=(u,table)=>as(u,async tx=>(await tx.query(`select * from public.${table} where household_id=$1`,[h])).rows);
before(async()=>{
 await db.exec(readFileSync(root+'test/db/supabase-shim.sql','utf8'));
 for(const f of readdirSync(root+'supabase/migrations').sort()) await db.exec(readFileSync(root+'supabase/migrations/'+f,'utf8'));
 await db.query('insert into auth.users values($1),($2),($3)',[A,B,X]);
 const house=await rpc(A,'create_household',['A & B','USD','Africa/Johannesburg','Alex']);h=house.id;
 await rpc(B,'join_household',[house.invite_code,'Sam']);other=(await rpc(X,'create_household',['Other','USD','UTC','Outsider'])).id;
 const cat=(await rpc(A,'get_cashflow',[h])).categories[0].id;
 for(const description of ['Our coffee','Our second expense']){
  const result=await as(A,tx=>tx.query(`insert into public.shared_transactions(household_id,category_id,paid_by,amount_minor,description)
   values($1,$2,$3,2500,$4) returning id`,[h,cat,A,description]));if(!shared)shared=result.rows[0].id;else second=result.rows[0].id;
 }
 privateId=(await as(A,tx=>tx.query(`insert into public.private_transactions(household_id,category_id,amount_minor,description)
  values($1,$2,1000,'Secret gift') returning id`,[h,cat]))).rows[0].id;
});
after(()=>db.close());
it('lets partners read a shared comment, with trimmed body and server-owned author/timestamps',async()=>{
 const c=await save(A,uuid(10),'  Thanks for the coffee ☕  ');
 assert.equal(c.body,'Thanks for the coffee ☕');assert.equal(c.author_id,A);assert.equal(c.version,1);
 assert.equal((await rows(B,'comments'))[0].body,c.body);
});
it('denies outsiders and anonymous reads, even with known household and transaction ids',async()=>{
 assert.deepEqual(await rows(X,'comments'),[]);assert.deepEqual(await rows(X,'reactions'),[]);
 await assert.rejects(rows(null,'comments'),/permission denied/);
 await assert.rejects(save(X,uuid(11),'Hidden',0,shared,h),/Conversation unavailable/);
 await assert.rejects(save(null,uuid(12),'Hidden',0,shared,h,null),/permission denied/);
});
it('cannot target private transactions, another household or a spoofed actor',async()=>{
 await assert.rejects(save(A,uuid(13),'Not shared',0,privateId),/Conversation unavailable/);
 await assert.rejects(save(A,uuid(14),'Wrong scope',0,shared,other),/Conversation unavailable/);
 await assert.rejects(save(A,uuid(15),'Wrong actor',0,shared,h,B),/Not signed in/);
 await assert.rejects(react(A,'heart',true,privateId),/Conversation unavailable/);
 await assert.rejects(react(A,'heart',true,shared,h,B),/Not signed in/);
});
it('rejects blank, oversized and null comments without creating rows',async()=>{
 for(const body of ['', ' \n\t ',null,'a'.repeat(1001)])await assert.rejects(save(A,uuid(16),body),/Invalid comment input/);
 assert.ok(!(await rows(A,'comments')).some(c=>c.id===uuid(16)));
});
it('retries create and edit without duplicate comments or an extra version',async()=>{
 const id=uuid(20);await save(A,id,'Original');await save(A,id,'Original');
 assert.equal((await rows(A,'comments')).filter(c=>c.id===id).length,1);
 const edited=await save(A,id,'Updated',1);assert.equal(edited.version,2);
 assert.equal((await save(A,id,'Updated',1)).version,2);
 await assert.rejects(save(A,id,'Different retry'),/Comment changed/);
});
it('version-checks edits and prevents changing the partner’s comment or the target expense',async()=>{
 const id=uuid(21);await save(A,id,'Mine');await save(A,id,'My revision',1);
 await assert.rejects(save(A,id,'Old draft',1),/Comment changed/);
 await assert.rejects(save(B,id,'Partner edit',2),/Comment unavailable/);
 await assert.rejects(remove(B,id,2),/Comment unavailable/);
 await assert.rejects(save(A,id,'Moved',2,second),/Comment unavailable/);
});
it('requires the captured version for removal, clears the text and never resurrects on create retry',async()=>{
 const id=uuid(22);await save(A,id,'Remove me');await save(A,id,'Latest',1);
 await assert.rejects(remove(A,id,1),/Comment changed/);await remove(A,id,2);await remove(A,id,2);
 const c=(await rows(B,'comments')).find(c=>c.id===id);assert.equal(c.body,'');assert.ok(c.deleted_at);assert.equal(c.version,3);
 await assert.rejects(save(A,id,'Remove me'),/Comment unavailable/);await assert.rejects(save(A,id,'Return',3),/Comment unavailable/);
});
it('uses desired-state reactions, allows both partners and removes only the caller’s own reaction',async()=>{
 await react(A,'heart',true);await react(A,'heart',true);await react(B,'heart',true);
 let r=await rows(A,'reactions');assert.equal(r.filter(x=>x.kind==='heart').length,2);
 await react(A,'heart',false);await react(A,'heart',false);
 r=await rows(A,'reactions');assert.deepEqual(r.filter(x=>x.kind==='heart').map(x=>x.author_id),[B]);
 await react(A,'coffee',true);assert.ok((await rows(B,'reactions')).some(x=>x.kind==='coffee'&&x.author_id===A));
});
it('rejects unsupported/null reactions, unknown state and outsider mutations',async()=>{
 for(const kind of ['angry','',null])await assert.rejects(react(A,kind,true),/Invalid reaction input/);
 await assert.rejects(react(A,'thanks',null),/Invalid reaction input/);
 await assert.rejects(react(X,'heart',true),/Conversation unavailable/);
});
it('blocks direct table writes and internal helper execution',async()=>{
 for(const table of ['comments','reactions']){
  await assert.rejects(as(A,tx=>tx.query(`delete from public.${table}`)),/permission denied/);
  await assert.rejects(as(A,tx=>tx.query(`update public.${table} set author_id=$1`,[B])),/permission denied/);
 }
 await assert.rejects(as(A,tx=>tx.query(`insert into public.comments(id,household_id,transaction_id,author_id,body) values($1,$2,$3,$4,'Spoof')`,[uuid(30),h,shared,B])),/permission denied/);
 await assert.rejects(rpc(A,'lock_shared_conversation',[h,shared,A]),/permission denied/);
});
it('signals only the household revision and never changes money, dates, classifications or paid records',async()=>{
 const before=(await db.query('select * from public.shared_transactions where id=$1',[shared])).rows[0];
 const revision=async()=>Number((await db.query('select conversation_revision from public.households where id=$1',[h])).rows[0].conversation_revision);
 const original=await revision();await save(B,uuid(31),'A thank you');assert.equal(await revision(),original+1);
 await save(B,uuid(31),'A thank you');assert.equal(await revision(),original+1);
 await react(B,'celebrate',true);assert.equal(await revision(),original+2);
 assert.deepEqual((await db.query('select * from public.shared_transactions where id=$1',[shared])).rows[0],before);
 assert.equal((await db.query('select * from public.payment_records')).rows.length,0);
});
it('cascades the conversation when its shared expense is removed',async()=>{
 await save(A,uuid(32),'Temporary',0,second);await react(A,'thanks',true,second);
 await as(A,tx=>tx.query('delete from public.shared_transactions where id=$1',[second]));
 assert.equal((await rows(A,'comments')).filter(c=>c.transaction_id===second).length,0);
 assert.equal((await rows(B,'reactions')).filter(c=>c.transaction_id===second).length,0);
});
