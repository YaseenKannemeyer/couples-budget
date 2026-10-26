// Exercise the actual upgrade path, not just a fresh database with all migrations.
import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, it } from 'node:test';

const root = new URL('../../', import.meta.url);
const db = new PGlite();
const USER = '00000000-0000-0000-0000-00000000000a';
let householdId, oldCategoryId, expenseId, scheduleId;
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const asUser = (callback) => db.transaction(async (tx) => {
  await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [USER]);
  await tx.exec('set local role authenticated');
  return callback(tx);
});

before(async () => {
  await db.exec(read('test/db/supabase-shim.sql'));
  for (const file of ['20261025152237_foundation.sql', '20261025180000_budget_onboarding.sql', '20261025193000_scheduled_payments.sql']) {
    await db.exec(read(`supabase/migrations/${file}`));
  }
  await db.query(`insert into auth.users(id) values ($1)`, [USER]);
  const created = await asUser((tx) => tx.query(`select (public.create_household('Existing home', 'USD', 'UTC', 'Alex')).id as id`));
  householdId = created.rows[0].id;
  const category = await asUser((tx) => tx.query(`select id from public.categories where name = 'Utilities'`));
  oldCategoryId = category.rows[0].id;
  await asUser((tx) => tx.query(`update public.categories set name = 'My renamed bills', bucket = 'wants' where id = $1`, [oldCategoryId]));
  await asUser((tx) => tx.query(`insert into public.private_transactions(household_id, amount_minor, description) values ($1, 1234, 'Old uncategorized entry')`, [householdId]));
  const bill = await asUser((tx) => tx.query(`select public.save_scheduled_payment($1, null, null, $2::jsonb) as id`, [householdId, JSON.stringify({
    name: 'Old monthly bill', visibility: 'shared', payerId: USER, categoryId: oldCategoryId, expectedAmountMinor: 5000, note: null,
    recurrence: 'monthly', dateMode: 'exact', dueStart: '2026-10-02', dueEnd: '2026-10-02', reminderDaysBefore: null,
  })]));
  scheduleId = bill.rows[0].id;
  const paid = await asUser((tx) => tx.query(`select public.mark_scheduled_payment_paid($1, 1, '2026-10-02', 5500, '2026-10-01', $2, true) as id`, [scheduleId, USER]));
  const record = await asUser((tx) => tx.query(`select shared_transaction_id from public.payment_records where id = $1`, [paid.rows[0].id]));
  expenseId = record.rows[0].shared_transaction_id;
  await asUser((tx) => tx.query(`select public.delete_scheduled_payment($1, 2)`, [scheduleId]));
  await db.exec(read('supabase/migrations/20261025210000_categories_and_frequency.sql'));
});
after(() => db.close());

it('keeps existing category IDs, renamed labels and custom buckets, while adding the missing starters', async () => {
  const old = await asUser((tx) => tx.query(`select * from public.categories where id = $1`, [oldCategoryId]));
  assert.equal(old.rows[0].name, 'My renamed bills');
  assert.equal(old.rows[0].bucket, 'wants');
  const defaults = await asUser((tx) => tx.query(`select starter_key from public.categories where starter_key is not null`));
  assert.equal(defaults.rows.length, 10);
  const transaction = await asUser((tx) => tx.query(`select category_id from public.shared_transactions where id = $1`, [expenseId]));
  assert.equal(transaction.rows[0].category_id, oldCategoryId);
});

it('backfills uncategorized private entries and frequencies without changing money or descriptions', async () => {
  const { rows } = await asUser((tx) => tx.query(`select t.*, c.starter_key from public.private_transactions t join public.categories c on c.id = t.category_id`));
  assert.equal(rows[0].starter_key, 'other');
  assert.equal(rows[0].frequency, 'one_time');
  assert.equal(Number(rows[0].amount_minor), 1234);
  assert.equal(rows[0].description, 'Old uncategorized entry');
});

it('recovers a paid expense’s monthly frequency/link even when its schedule was deleted before upgrading', async () => {
  const { rows } = await asUser((tx) => tx.query(`select * from public.shared_transactions where id = $1`, [expenseId]));
  assert.equal(rows[0].frequency, 'monthly');
  assert.equal(rows[0].scheduled_payment_ref, scheduleId);
  assert.equal(Number(rows[0].amount_minor), 5500);
  const records = await asUser((tx) => tx.query(`select schedule_id, category_name from public.payment_records where schedule_ref = $1`, [scheduleId]));
  assert.equal(records.rows[0].schedule_id, null);
  assert.equal(records.rows[0].category_name, 'My renamed bills');
});
