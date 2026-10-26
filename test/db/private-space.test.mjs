import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { before, after, it } from 'node:test';
const root = new URL('../../', import.meta.url).pathname;
const db = new PGlite();
const A = '00000000-0000-4000-8000-000000000001', B = '00000000-0000-4000-8000-000000000002', X = '00000000-0000-4000-8000-000000000003';
const as = (id, fn) => db.transaction(async tx => {
  await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`, [id ?? '']);
  await tx.exec(id ? 'set local role authenticated' : 'set local role anon'); return fn(tx);
});
const rpc = (user, name, args) => as(user, async tx => (await tx.query(`select to_jsonb(public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')})) as value`, args)).rows[0].value);
let h, cat, today, end, prior;
before(async () => {
  await db.exec(readFileSync(root + 'test/db/supabase-shim.sql', 'utf8'));
  for (const f of readdirSync(root + 'supabase/migrations').sort()) await db.exec(readFileSync(root + 'supabase/migrations/' + f, 'utf8'));
  await db.query('insert into auth.users values($1),($2),($3)', [A, B, X]);
  const house = await rpc(A, 'create_household', ['Private fixture', 'USD', 'Pacific/Auckland', 'Alex']); h = house.id;
  await rpc(B, 'join_household', [house.invite_code, 'Sam']);
  const flow = await rpc(A, 'get_cashflow', [h]); today = flow.today; cat = flow.categories[0].id;
  const dates = (await db.query(`select (date_trunc('month',$1::date)+interval '1 month - 1 day')::date::text as last,
    (date_trunc('month',$1::date)-interval '1 day')::date::text as prior`, [today])).rows[0]; end = dates.last; prior = dates.prior;
  await db.query('update public.members set monthly_allowance_minor=10000 where household_id=$1', [h]);
  for (const [user, name, amount, on] of [[A,'My purchase',5000,today],[A,'My refund',-1000,today],
    [A,'Month-end entry',2000,end],[A,'Previous month',9000,prior],[B,'Partner medical',7000,today]]) {
    await as(user, tx => tx.query(`insert into public.private_transactions(household_id,category_id,amount_minor,description,occurred_on)
      values($1,$2,$3,$4,$5)`, [h,cat,amount,name,on]));
  }
  for (const [user, name] of [[A,'My private schedule'],[B,'Partner private schedule']]) {
    await rpc(user,'save_scheduled_payment',[h,null,null,JSON.stringify({name,payerId:user,visibility:'private',expectedAmountMinor:2000,
      categoryId:cat,note:null,recurrence:'one_time',dateMode:'exact',dueStart:end,dueEnd:end,reminderDaysBefore:null})]);
  }
});
after(() => db.close());
it('returns owner-only spending even when an authenticated partner knows household/category ids', async () => {
  const a = (await as(A, tx => tx.query('select description from public.private_transactions where household_id=$1 order by description', [h]))).rows;
  assert.equal(a.length,4); assert.ok(a.some(r=>r.description==='My refund')); assert.ok(!JSON.stringify(a).includes('Partner medical'));
  const b = (await as(B, tx => tx.query('select description from public.private_transactions where household_id=$1', [h]))).rows;
  assert.deepEqual(b,[{description:'Partner medical'}]);
  assert.deepEqual((await as(X,tx=>tx.query('select * from public.private_transactions where household_id=$1',[h]))).rows,[]);
});
it('uses net household-month allowance totals, including all month dates but excluding older entries and unpaid bills', async () => {
  for (const viewer of [A,B]) {
    const rows = await as(viewer, tx=>tx.query('select * from public.allowance_balances($1)',[h]));
    const own = rows.rows.find(r=>r.user_id===A);
    assert.equal(Number(own.allowance_minor),10000); assert.equal(Number(own.spent_minor),6000); assert.equal(Number(own.remaining_minor),4000);
    assert.ok(!JSON.stringify(rows.rows).includes('My purchase')); assert.ok(!JSON.stringify(rows.rows).includes('medical'));
  }
});
it('returns only each owner’s private schedules while outsiders receive no workspace', async () => {
  const a = await rpc(A,'get_payment_workspace',[h]); const b = await rpc(B,'get_payment_workspace',[h]);
  assert.deepEqual(a.schedules.map(s=>s.name),['My private schedule']);
  assert.deepEqual(b.schedules.map(s=>s.name),['Partner private schedule']);
  assert.equal(await rpc(X,'get_payment_workspace',[h]), null);
});
