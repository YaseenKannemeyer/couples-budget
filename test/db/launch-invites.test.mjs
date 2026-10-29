import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { after, before, it } from 'node:test';

const root = new URL('../../', import.meta.url);
const db = new PGlite();
const A = '00000000-0000-4000-8000-00000000000a';
const B = '00000000-0000-4000-8000-00000000000b';
const C = '00000000-0000-4000-8000-00000000000c';
let home, other;
const as = (user, fn) => db.transaction(async tx => {
  await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [user ?? '']);
  await tx.exec(user ? 'set local role authenticated' : 'set local role anon');
  return fn(tx);
});
const revision = async () => (await as(A, tx => tx.query(`select budget_revision from public.households where id=$1`, [home.id]))).rows[0].budget_revision;
const preview = (user=B, code=home.invite_code) => as(user, tx => tx.query(`select public.preview_household_invite($1) as value`, [code])).then(r => r.rows[0].value);
const proposal = async amount => { const rev = await revision(); return as(A, tx => tx.query(`select public.save_invite_allowance($1,$2,$3)`, [home.id, rev, amount])); };
before(async () => {
  await db.exec(readFileSync(new URL('test/db/supabase-shim.sql', root), 'utf8'));
  for (const file of readdirSync(new URL('supabase/migrations', root)).sort())
    await db.exec(readFileSync(new URL(`supabase/migrations/${file}`, root), 'utf8'));
  await db.query(`insert into auth.users(id) values ($1),($2),($3)`, [A,B,C]);
  home = (await as(A, tx => tx.query(`select * from public.create_household('Our solo home','ZAR','Africa/Johannesburg','Alex')`))).rows[0];
  other = (await as(C, tx => tx.query(`select * from public.create_household('Another home','USD','UTC','Chris')`))).rows[0];
});
after(() => db.close());

it('lets one member finish setup, log and plan without creating a phantom partner', async () => {
  const save = async (name, values) => as(A, tx => tx.query(`select public.${name}($1,$2,${values.sql})`, [home.id, values.revision, ...values.params]));
  await save('save_budget_income',{sql:'$3,$4', revision: await revision(), params:[600000,'proportional']});
  await save('save_budget_allowances',{sql:'$3::jsonb', revision: await revision(), params:[JSON.stringify([{userId:A,amountMinor:30000}])]});
  await save('save_budget_costs',{sql:'$3::jsonb', revision: await revision(), params:[JSON.stringify([{name:'Rent',amountMinor:200000}])]});
  await save('save_budget_paydays',{sql:'$3::jsonb', revision: await revision(), params:[JSON.stringify([{name:'Private salary source',amountMinor:600000,cadence:'monthly',nextPayday:'2026-11-25'}])]});
  const setup = (await as(A, tx => tx.query(`select public.get_budget_setup($1) as value`,[home.id]))).rows[0].value;
  assert.equal(setup.members.length,1);
  assert.equal(setup.members[0].budget_setup_step,4);
  await as(A,tx=>tx.query(`insert into public.shared_transactions(household_id,paid_by,amount_minor,description) values($1,$2,1000,'Solo groceries')`,[home.id,A]));
  await as(A,tx=>tx.query(`insert into public.private_transactions(household_id,amount_minor,description) values($1,1234,'Secret private purchase')`,[home.id]));
});
it('does not grant an allowance to an absent partner or move money when a proposal is prepared', async () => {
  await proposal(45000);
  assert.equal((await as(A,tx=>tx.query(`select count(*)::int as n from public.members where household_id=$1`,[home.id]))).rows[0].n,1);
  assert.equal((await as(A,tx=>tx.query(`select monthly_allowance_minor from public.members where user_id=$1`,[A]))).rows[0].monthly_allowance_minor,30000);
  const p=await preview();
  assert.equal(p.allowance_minor,45000);
  assert.deepEqual(p.costs,[{name:'Rent',amount_minor:200000}]);
  assert.equal(p.split_mode,'proportional');
});
it('exposes only the allowlisted shared plan to a signed-in code holder',async()=>{
  const p=await preview(B,` ${home.invite_code.slice(0,4).toLowerCase()}-${home.invite_code.slice(4).toLowerCase()} `);
  assert.deepEqual(Object.keys(p).sort(),['allowance_minor','base_currency','costs','household_id','inviter_name','name','revision','split_mode'].sort());
  assert.doesNotMatch(JSON.stringify(p),/salary|Secret|income|transactions|receipt|balance/);
  for(const table of ['households','members','income_sources','private_transactions'])
    assert.equal((await as(B,tx=>tx.query(`select * from public.${table}`))).rows.length,0);
});
it('denies anonymous previews, invalid codes, outsiders saving and direct column writes',async()=>{
  await assert.rejects(preview(null),/permission denied/);
  await assert.rejects(preview(B,'ZZZZZZZZ'),/didn't match/);
  await assert.rejects(as(B,tx=>tx.query(`select public.save_invite_allowance($1,0,500)`,[home.id])),/Not a member/);
  await assert.rejects(as(A,tx=>tx.query(`update public.households set invite_allowance_minor=900 where id=$1`,[home.id])),/permission denied/);
  await assert.rejects(preview(C),/already part/);
});
it('rejects stale and invalid proposals, and accepts explicit zero or removal',async()=>{
  const old=await revision(); await proposal(0);
  assert.equal((await preview()).allowance_minor,0);
  await assert.rejects(as(A,tx=>tx.query(`select public.save_invite_allowance($1,$2,100)`,[home.id,old])),/Budget plan changed/);
  for(const amount of [-1,1000000000001]) await assert.rejects(proposal(amount),/Invalid budget input/);
  await proposal(null); assert.equal((await preview()).allowance_minor,null);
  await proposal(45000);
});
it('invalidates review after a shared plan change without adding the partner',async()=>{
  const p=await preview(); await proposal(46000);
  await assert.rejects(as(B,tx=>tx.query(`select public.join_household_reviewed($1,'Sam',$2,40000)`,[home.invite_code,p.revision])),/Budget plan changed/);
  assert.equal((await as(B,tx=>tx.query(`select * from public.members`))).rows.length,0);
});
it('invalidates rotated codes and does not allow a member to switch households',async()=>{
  const old=home.invite_code;
  home.invite_code=(await as(A,tx=>tx.query(`select public.regenerate_invite_code($1) as code`,[home.id]))).rows[0].code;
  await assert.rejects(preview(B,old),/didn't match/);
  const rev=await revision();
  await assert.rejects(as(C,tx=>tx.query(`select public.join_household_reviewed($1,'Chris',$2,1)`,[home.invite_code,rev])),/already part/);
  assert.equal((await as(C,tx=>tx.query(`select household_id from public.members where user_id=$1`,[C]))).rows[0].household_id,other.id);
});
it('validates the accepting partner’s amount and name atomically',async()=>{
  const rev=await revision();
  for(const amount of [null,-1,1000000000001])
    await assert.rejects(as(B,tx=>tx.query(`select public.join_household_reviewed($1,'Sam',$2,$3)`,[home.invite_code,rev,amount])),/Invalid budget input/);
  await assert.rejects(as(B,tx=>tx.query(`select public.join_household_reviewed($1,' ',$2,1)`,[home.invite_code,rev])),/Invalid budget input/);
});
it('joins with the adjusted own allowance, pending own income and owner-only payday details',async()=>{
  const rev=await revision();
  await as(B,tx=>tx.query(`select public.join_household_reviewed($1,'Sam',$2,40000)`,[home.invite_code,rev]));
  const members=(await as(B,tx=>tx.query(`select * from public.members order by display_name`))).rows;
  assert.equal(members.length,2);
  assert.equal(members[0].monthly_allowance_minor,30000);
  assert.equal(members[1].monthly_allowance_minor,40000);
  assert.equal(members[1].monthly_income_minor,0);
  assert.equal(members[1].budget_setup_step,0);
  assert.equal((await as(B,tx=>tx.query(`select * from public.income_sources`))).rows.length,0);
  assert.equal((await as(B,tx=>tx.query(`select * from public.private_transactions`))).rows.length,0);
  assert.equal((await as(B,tx=>tx.query(`select amount_minor from public.period_allowances where user_id=$1 order by month_on desc limit 1`,[B]))).rows[0].amount_minor,40000);
});
it('replays a lost join response without rewriting allowances or duplicating membership',async()=>{
  await as(B,tx=>tx.query(`select public.join_household_reviewed($1,'Sam',0,99999)`,[home.invite_code]));
  assert.equal((await as(B,tx=>tx.query(`select monthly_allowance_minor from public.members where user_id=$1`,[B]))).rows[0].monthly_allowance_minor,40000);
  await assert.rejects(proposal(90000),/Invite no longer available/);
  await assert.rejects(preview(B),/already part/);
});
