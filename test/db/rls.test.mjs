// Proves the privacy promises in supabase/migrations hold at the database level:
// partners share the household, but a Private Space is only ever readable by its owner.
//
// Run with: npm run test:db

import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { before, describe, it } from 'node:test';

const root = new URL('../../', import.meta.url).pathname;
const migrationsDir = join(root, 'supabase/migrations');

const ALEX = '00000000-0000-0000-0000-00000000000a';
const SARAH = '00000000-0000-0000-0000-00000000000b';
const MALLORY = '00000000-0000-0000-0000-00000000000c';

const db = new PGlite();

/** Runs `fn` as a signed-in user, exactly as a request through Supabase would. */
async function as(userId, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [userId ?? '']);
    await tx.exec(userId ? 'set local role authenticated' : 'set local role anon');
    return fn(tx);
  });
}

let household;

before(async () => {
  await db.exec(readFileSync(join(root, 'test/db/supabase-shim.sql'), 'utf8'));
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
  }
  await db.query(`insert into auth.users (id) values ($1), ($2), ($3)`, [ALEX, SARAH, MALLORY]);

  household = await as(ALEX, async (tx) => {
    const { rows } = await tx.query(
      `select * from public.create_household('Alex & Sarah', 'usd', 'Africa/Johannesburg', 'Alex')`
    );
    return rows[0];
  });

  await as(SARAH, (tx) =>
    tx.query(`select public.join_household($1, 'Sarah')`, [household.invite_code.toLowerCase()])
  );

  // Both partners set their own allowance; Sarah spends some of hers privately.
  await as(ALEX, (tx) => tx.query(`update public.members set monthly_allowance_minor = 30000`));
  await as(SARAH, async (tx) => {
    await tx.query(`update public.members set monthly_allowance_minor = 30000 where user_id = $1`, [SARAH]);
    await tx.query(
      `insert into public.private_transactions (household_id, amount_minor, description, occurred_on)
       values ($1, 4500, 'Anniversary gift 🤫', (now() at time zone 'Africa/Johannesburg')::date)`,
      [household.id]
    );
  });

  await as(ALEX, (tx) =>
    tx.query(
      `insert into public.shared_transactions (household_id, paid_by, amount_minor, description)
       values ($1, $2, 6500, 'Fuel for our car')`,
      [household.id, ALEX]
    )
  );
});

describe('setting up a household', () => {
  it('creates the household with an uppercase base currency and starter categories', async () => {
    assert.equal(household.base_currency, 'USD');
    assert.match(household.invite_code, /^[A-HJ-KMNP-Z2-9]{8}$/);
    const { rows } = await as(ALEX, (tx) => tx.query(`select name from public.categories`));
    assert.equal(rows.length, 10);
  });

  it('links both partners to the household', async () => {
    const { rows } = await as(SARAH, (tx) =>
      tx.query(`select display_name from public.members order by joined_at`)
    );
    assert.deepEqual(rows.map((r) => r.display_name), ['Alex', 'Sarah']);
  });

  it('turns away a third person, even with the right code', async () => {
    await assert.rejects(
      as(MALLORY, (tx) => tx.query(`select public.join_household($1, 'Mallory')`, [household.invite_code])),
      /already has two partners/
    );
  });

  it('rejects unknown timezones and invite codes', async () => {
    await assert.rejects(
      as(MALLORY, (tx) => tx.query(`select public.create_household('x', 'USD', 'Not/AZone', 'M')`)),
      /Unknown timezone/
    );
    await assert.rejects(
      as(MALLORY, (tx) => tx.query(`select public.join_household('ZZZZZZZZ', 'Mallory')`)),
      /didn't match/
    );
  });

  it('stops someone joining a second household', async () => {
    await assert.rejects(
      as(SARAH, (tx) => tx.query(`select public.create_household('Mine', 'USD', 'UTC', 'Sarah')`)),
      /already part of a household/
    );
  });
});

describe('the Shared Bucket', () => {
  it('is visible to both partners', async () => {
    const { rows } = await as(SARAH, (tx) => tx.query(`select description from public.shared_transactions`));
    assert.deepEqual(rows.map((r) => r.description), ['Fuel for our car']);
  });

  it('is invisible to outsiders and signed-out visitors', async () => {
    for (const user of [MALLORY, null]) {
      const shared = await as(user, (tx) => tx.query(`select * from public.shared_transactions`)).catch(
        (e) => e
      );
      // Outsiders get zero rows; anon has no table access at all.
      if (shared instanceof Error) assert.match(shared.message, /permission denied/);
      else assert.equal(shared.rows.length, 0);
    }
    const { rows } = await as(MALLORY, (tx) => tx.query(`select * from public.households`));
    assert.equal(rows.length, 0);
  });

  it('cannot be logged in the partner\'s name', async () => {
    await assert.rejects(
      as(ALEX, (tx) =>
        tx.query(
          `insert into public.shared_transactions (household_id, paid_by, created_by, amount_minor)
           values ($1, $2, $2, 100)`,
          [household.id, SARAH]
        )
      ),
      /row-level security/
    );
  });
});

describe('the Private Space', () => {
  it('shows the owner their own purchases', async () => {
    const { rows } = await as(SARAH, (tx) => tx.query(`select description from public.private_transactions`));
    assert.deepEqual(rows.map((r) => r.description), ['Anniversary gift 🤫']);
  });

  it('hides every private purchase from the partner', async () => {
    const { rows } = await as(ALEX, (tx) => tx.query(`select * from public.private_transactions`));
    assert.equal(rows.length, 0);
  });

  it('lets the partner see only how much allowance is left', async () => {
    const { rows } = await as(ALEX, (tx) =>
      tx.query(`select * from public.allowance_balances($1)`, [household.id])
    );
    const sarah = rows.find((r) => r.user_id === SARAH);
    assert.equal(Number(sarah.allowance_minor), 30000);
    assert.equal(Number(sarah.spent_minor), 4500);
    assert.equal(Number(sarah.remaining_minor), 25500);
    assert.equal(Object.hasOwn(sarah, 'description'), false);
  });

  it('gives outsiders nothing from allowance_balances', async () => {
    const { rows } = await as(MALLORY, (tx) =>
      tx.query(`select * from public.allowance_balances($1)`, [household.id])
    );
    assert.equal(rows.length, 0);
  });

  it('cannot be written to on the partner\'s behalf', async () => {
    await assert.rejects(
      as(ALEX, (tx) =>
        tx.query(
          `insert into public.private_transactions (household_id, owner_id, amount_minor)
           values ($1, $2, 100)`,
          [household.id, SARAH]
        )
      ),
      /row-level security/
    );
  });

  it('cannot be edited or deleted by the partner', async () => {
    const updated = await as(ALEX, (tx) => tx.query(`update public.private_transactions set amount_minor = 1`));
    const deleted = await as(ALEX, (tx) => tx.query(`delete from public.private_transactions`));
    assert.equal(updated.affectedRows, 0);
    assert.equal(deleted.affectedRows, 0);
  });
});

describe('member rows', () => {
  it('cannot be edited by the other partner', async () => {
    const { affectedRows } = await as(ALEX, (tx) =>
      tx.query(`update public.members set monthly_income_minor = 1 where user_id = $1`, [SARAH])
    );
    assert.equal(affectedRows, 0);
  });

  it('cannot be moved to another household', async () => {
    await assert.rejects(
      as(ALEX, (tx) => tx.query(`update public.members set household_id = gen_random_uuid()`)),
      /permission denied/
    );
  });

  it('keeps the invite code out of direct edits', async () => {
    await assert.rejects(
      as(ALEX, (tx) => tx.query(`update public.households set invite_code = 'AAAAAAAA'`)),
      /permission denied/
    );
    const { rows } = await as(ALEX, (tx) =>
      tx.query(`select public.regenerate_invite_code($1) as code`, [household.id])
    );
    assert.notEqual(rows[0].code, household.invite_code);
  });
});

async function budgetRevision(user = ALEX) {
  const { rows } = await as(user, (tx) => tx.query(`select budget_revision from public.households where id = $1`, [household.id]));
  return rows[0].budget_revision;
}

async function saveBudget(user, name, values, revision) {
  const current = revision ?? await budgetRevision(user);
  return as(user, (tx) => tx.query(`select public.${name}($1, $2, $3::jsonb) as revision`, [
    household.id, current, JSON.stringify(values),
  ]));
}

const allowances = [
  { userId: ALEX, amountMinor: 30000 }, { userId: SARAH, amountMinor: 40000 },
];
const costs = [{ name: 'Rent', amountMinor: 120000 }, { name: 'Groceries', amountMinor: 60000 }];
const sources = [
  { name: 'Confidential employer', cadence: 'monthly', amountMinor: 300000, nextPayday: '2026-11-25' },
  { name: 'Freelance client', cadence: 'irregular', amountMinor: null, nextPayday: null },
];

describe('budget onboarding', () => {
  it('prevents finishing or skipping ahead before earlier steps are saved', async () => {
    await assert.rejects(saveBudget(ALEX, 'save_budget_paydays', sources), /earlier budget steps/);
    await assert.rejects(saveBudget(ALEX, 'save_budget_allowances', allowances), /earlier budget steps/);
    await assert.rejects(saveBudget(ALEX, 'save_budget_costs', costs), /earlier budget steps/);
  });

  it('saves only the caller’s income, records progress and returns the current revision', async () => {
    const revision = await budgetRevision();
    const result = await as(ALEX, (tx) => tx.query(
      `select public.save_budget_income($1, $2, 300000, 'proportional') as revision`, [household.id, revision]
    ));
    assert.equal(result.rows[0].revision, await budgetRevision());
    const { rows } = await as(SARAH, (tx) => tx.query(`select user_id, monthly_income_minor, budget_setup_step from public.members`));
    assert.equal(Number(rows.find((row) => row.user_id === ALEX).monthly_income_minor), 300000);
    assert.equal(rows.find((row) => row.user_id === ALEX).budget_setup_step, 1);
    assert.equal(Number(rows.find((row) => row.user_id === SARAH).monthly_income_minor), 0);
  });

  it('rejects stale revisions without altering either person’s income', async () => {
    const revision = await budgetRevision();
    await as(SARAH, (tx) => tx.query(`select public.save_budget_income($1, $2, 200000, 'equal')`, [household.id, revision]));
    await assert.rejects(as(ALEX, (tx) => tx.query(
      `select public.save_budget_income($1, $2, 1, 'combined')`, [household.id, revision]
    )), /Budget plan changed/);
    const { rows } = await as(ALEX, (tx) => tx.query(`select monthly_income_minor from public.members where user_id = $1`, [ALEX]));
    assert.equal(Number(rows[0].monthly_income_minor), 300000);
  });

  it('lets partners agree on both allowances without changing their incomes', async () => {
    await saveBudget(ALEX, 'save_budget_allowances', allowances);
    const { rows } = await as(SARAH, (tx) => tx.query(`select * from public.members order by user_id`));
    assert.deepEqual(rows.map((row) => Number(row.monthly_allowance_minor)), [30000, 40000]);
    assert.deepEqual(rows.map((row) => Number(row.monthly_income_minor)), [300000, 200000]);
    assert.equal(rows[0].budget_setup_step, 2);
    assert.equal(rows[1].budget_setup_step, 1);
  });

  it('rejects duplicate or non-member allowance rows atomically', async () => {
    for (const values of [
      [{ userId: ALEX, amountMinor: 1 }, { userId: ALEX, amountMinor: 2 }],
      [{ userId: ALEX, amountMinor: 1 }, { userId: MALLORY, amountMinor: 2 }],
      [{ userId: ALEX, amountMinor: -1 }, { userId: SARAH, amountMinor: 2 }],
    ]) await assert.rejects(saveBudget(ALEX, 'save_budget_allowances', values), /Invalid budget input/);
    const { rows } = await as(ALEX, (tx) => tx.query(`select monthly_allowance_minor from public.members where user_id = $1`, [ALEX]));
    assert.equal(Number(rows[0].monthly_allowance_minor), 30000);
  });

  it('shares monthly costs with the partner and resumes from the saved step', async () => {
    await saveBudget(ALEX, 'save_budget_costs', costs);
    const { rows } = await as(SARAH, (tx) => tx.query(`select name, amount_minor from public.budget_costs order by sort_order`));
    assert.deepEqual(rows.map((row) => row.name), ['Rent', 'Groceries']);
    const snapshot = await as(ALEX, (tx) => tx.query(`select public.get_budget_setup($1) as setup`, [household.id]));
    assert.equal(snapshot.rows[0].setup.members.find((row) => row.user_id === ALEX).budget_setup_step, 3);
    assert.equal(snapshot.rows[0].setup.household.budget_revision, await budgetRevision());
  });

  it('rolls back replacement costs and revision when any cost is invalid', async () => {
    const revision = await budgetRevision();
    await assert.rejects(saveBudget(ALEX, 'save_budget_costs', [costs[0], { name: '', amountMinor: 1 }]), /check constraint/);
    await assert.rejects(saveBudget(ALEX, 'save_budget_costs', [{ name: 'x', amountMinor: 1.5 }]), /Invalid budget input/);
    await assert.rejects(saveBudget(ALEX, 'save_budget_costs', [
      { name: 'x', amountMinor: 1000000000000 }, { name: 'y', amountMinor: 1 },
    ]), /Invalid budget input/);
    assert.equal(await budgetRevision(), revision);
    const { rows } = await as(ALEX, (tx) => tx.query(`select name from public.budget_costs order by sort_order`));
    assert.deepEqual(rows.map((row) => row.name), ['Rent', 'Groceries']);
  });

  it('saves multiple private payday sources and completes only the caller’s setup', async () => {
    await saveBudget(ALEX, 'save_budget_paydays', sources);
    const { rows } = await as(ALEX, (tx) => tx.query(`select * from public.income_sources order by sort_order`));
    assert.deepEqual(rows.map((row) => row.name), sources.map((source) => source.name));
    assert.equal(rows[1].amount_minor, null);
    const members = await as(SARAH, (tx) => tx.query(`select user_id, budget_completed_at from public.members`));
    assert.ok(members.rows.find((row) => row.user_id === ALEX).budget_completed_at);
    assert.equal(members.rows.find((row) => row.user_id === SARAH).budget_completed_at, null);
  });

  it('supports different weekly and biweekly paydays for the other partner', async () => {
    await saveBudget(SARAH, 'save_budget_allowances', allowances);
    await saveBudget(SARAH, 'save_budget_costs', costs);
    await saveBudget(SARAH, 'save_budget_paydays', [
      { name: 'Weekly work', cadence: 'weekly', amountMinor: 30000, nextPayday: '2026-11-02' },
      { name: 'Other work', cadence: 'biweekly', amountMinor: 40000, nextPayday: '2026-11-06' },
    ]);
    const { rows } = await as(SARAH, (tx) => tx.query(`select cadence from public.income_sources order by sort_order`));
    assert.deepEqual(rows.map((row) => row.cadence), ['weekly', 'biweekly']);
  });

  it('never exposes source names, amounts or dates to the partner, including through the snapshot RPC', async () => {
    for (const [user, expectedName] of [[ALEX, 'Confidential employer'], [SARAH, 'Weekly work']]) {
      const result = await as(user, (tx) => tx.query(`select public.get_budget_setup($1) as setup`, [household.id]));
      const setup = result.rows[0].setup;
      assert.equal(setup.sources.length, 2);
      assert.equal(setup.sources[0].name, expectedName);
      assert.ok(setup.sources.every((source) => source.owner_id === user));
      const direct = await as(user, (tx) => tx.query(`select * from public.income_sources where owner_id <> $1`, [user]));
      assert.equal(direct.rows.length, 0);
    }
  });

  it('blocks outsiders and signed-out clients from reading or writing the plan', async () => {
    const revision = await budgetRevision();
    const { rows } = await as(MALLORY, (tx) => tx.query(`select public.get_budget_setup($1) as setup`, [household.id]));
    assert.equal(rows[0].setup, null);
    assert.equal((await as(MALLORY, (tx) => tx.query(`select * from public.budget_costs`))).rows.length, 0);
    for (const name of ['save_budget_allowances', 'save_budget_costs', 'save_budget_paydays']) {
      await assert.rejects(saveBudget(MALLORY, name, [], revision), /Not a member/);
      await assert.rejects(saveBudget(null, name, [], revision), /permission denied/);
    }
    await assert.rejects(as(null, (tx) => tx.query(`select public.get_budget_setup($1)`, [household.id])), /permission denied/);
  });

  it('prevents direct writes from bypassing validation or claiming someone else’s completion', async () => {
    const revision = await budgetRevision();
    await assert.rejects(as(ALEX, (tx) => tx.query(`update public.members set budget_completed_at = now()`)), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`update public.income_sources set name = 'changed'`)), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`delete from public.budget_costs`)), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.lock_budget_setup($1, $2)`, [household.id, revision])), /permission denied/);
  });

  it('rejects impossible dates and preserves the existing private sources', async () => {
    await assert.rejects(saveBudget(ALEX, 'save_budget_paydays', [{ ...sources[0], nextPayday: '2026-02-30' }]), /date\/time field value out of range/);
    await assert.rejects(saveBudget(ALEX, 'save_budget_paydays', [{ ...sources[0], nextPayday: null }]), /check constraint/);
    const { rows } = await as(ALEX, (tx) => tx.query(`select name from public.income_sources order by sort_order`));
    assert.deepEqual(rows.map((row) => row.name), sources.map((source) => source.name));
  });
});


let paymentCategory;
async function createPayment(user, overrides = {}) {
  if (!paymentCategory) {
    const result = await as(ALEX, (tx) => tx.query(`select id from public.categories where household_id = $1 order by sort_order limit 1`, [household.id]));
    paymentCategory = result.rows[0].id;
  }
  const values = { name: 'Our bill', visibility: 'shared', recurrence: 'monthly', payerId: user,
    dateMode: 'window',
    categoryId: paymentCategory, expectedAmountMinor: 10000, note: 'Our note',
    dueStart: '2026-01-30', dueEnd: '2026-01-31', reminderDaysBefore: 3, ...overrides };
  const { rows } = await as(user, (tx) => tx.query(
    `select public.save_scheduled_payment($1, null, null, $2::jsonb) as id`, [household.id, JSON.stringify(values)]
  ));
  return { id: rows[0].id, values };
}
async function schedule(user, id) {
  const { rows } = await as(user, (tx) => tx.query(`select * from public.scheduled_payments where id = $1`, [id]));
  return rows[0] && { ...rows[0], due_start: dateOnly(rows[0].due_start), due_end: dateOnly(rows[0].due_end) };
}
const dateOnly = (value) => value instanceof Date ? value.toISOString().slice(0, 10) : value;
async function pay(user, row, amount = 12000, createTransaction = true, paidBy = user) {
  return as(user, (tx) => tx.query(
    `select public.mark_scheduled_payment_paid($1, $2, $3, $4, '2026-01-29', $5, $6) as id`,
    [row.id, row.version, row.due_start, amount, paidBy, createTransaction]
  ));
}

describe('scheduled payments', () => {
  let sharedBill, privateBill;
  it('shares shared schedules while hiding private names, amounts, notes and reminders', async () => {
    sharedBill = await createPayment(ALEX);
    privateBill = await createPayment(SARAH, { name: 'Private therapy', visibility: 'private', expectedAmountMinor: null, note: 'Private note' });
    const visible = await as(ALEX, (tx) => tx.query(`select name from public.scheduled_payments`));
    assert.deepEqual(visible.rows.map((row) => row.name), ['Our bill']);
    const workspace = await as(ALEX, (tx) => tx.query(`select public.get_payment_workspace($1) as data`, [household.id]));
    assert.equal(workspace.rows[0].data.schedules.length, 1);
    assert.ok(!JSON.stringify(workspace.rows).includes('Private therapy'));
    assert.ok(!JSON.stringify(workspace.rows).includes('Private note'));
    assert.equal((await schedule(SARAH, privateBill.id)).reminder_days_before, 3);
  });

  it('atomically records the actual amount, paid date and actual payer with a shared transaction', async () => {
    const before = await schedule(ALEX, sharedBill.id);
    const result = await pay(ALEX, before, 12345, true, SARAH);
    const { rows } = await as(SARAH, (tx) => tx.query(`select * from public.payment_records where id = $1`, [result.rows[0].id]));
    const record = rows[0];
    assert.equal(Number(record.amount_minor), 12345);
    assert.equal(Number(record.expected_amount_minor), 10000);
    assert.equal(dateOnly(record.paid_on), '2026-01-29');
    assert.equal(dateOnly(record.due_start), '2026-01-30');
    assert.equal(record.payer_id, SARAH);
    const transaction = await as(SARAH, (tx) => tx.query(`select * from public.shared_transactions where id = $1`, [record.shared_transaction_id]));
    assert.equal(Number(transaction.rows[0].amount_minor), 12345);
    assert.equal(dateOnly(transaction.rows[0].occurred_on), '2026-01-29');
    assert.equal(transaction.rows[0].paid_by, SARAH);
    assert.equal(transaction.rows[0].created_by, ALEX);
    assert.equal(transaction.rows[0].category_id, paymentCategory);
    await assert.rejects(pay(ALEX, before, 12345), /Payment changed/);
    assert.equal((await as(ALEX, (tx) => tx.query(`select id from public.payment_records where schedule_ref = $1`, [sharedBill.id]))).rows.length, 1);
  });

  it('clamps a date window in February and restores the original March anchors', async () => {
    let row = await schedule(ALEX, sharedBill.id);
    assert.equal(row.due_start, '2026-02-28');
    assert.equal(row.due_end, '2026-02-28');
    // Editing a note during a clamped month must preserve the original window.
    await as(ALEX, (tx) => tx.query(`select public.save_scheduled_payment($1, $2, $3, $4::jsonb)`, [
      household.id, row.id, row.version, JSON.stringify({ ...sharedBill.values, dueStart: row.due_start, dueEnd: row.due_end, note: 'February note' }),
    ]));
    row = await schedule(ALEX, sharedBill.id);
    await pay(SARAH, row, 15000, false);
    row = await schedule(ALEX, sharedBill.id);
    assert.equal(row.due_start, '2026-03-30');
    assert.equal(row.due_end, '2026-03-31');
    assert.equal(row.anchor_start_day, 30);
    assert.equal(row.anchor_end_day, 31);
  });

  it('keeps private payment records and transactions owner-only', async () => {
    const row = await schedule(SARAH, privateBill.id);
    const result = await pay(SARAH, row, 9400);
    const records = await as(ALEX, (tx) => tx.query(`select * from public.payment_records where schedule_ref = $1`, [privateBill.id]));
    assert.equal(records.rows.length, 0);
    assert.equal((await as(ALEX, (tx) => tx.query(`select * from public.private_transactions where description = 'Private therapy'`))).rows.length, 0);
    const own = await as(SARAH, (tx) => tx.query(`select * from public.payment_records where id = $1`, [result.rows[0].id]));
    const transaction = await as(SARAH, (tx) => tx.query(`select * from public.private_transactions where id = $1`, [own.rows[0].private_transaction_id]));
    assert.equal(Number(transaction.rows[0].amount_minor), 9400);
    assert.equal(transaction.rows[0].category_id, paymentCategory);
    assert.equal(transaction.rows[0].note, 'Private note');
  });

  it('blocks partners from changing, paying, pausing or deleting a private schedule', async () => {
    const row = await schedule(SARAH, privateBill.id);
    await assert.rejects(pay(ALEX, row), /Payment not available/);
    for (const operation of ['paused', 'archived']) await assert.rejects(as(ALEX, (tx) => tx.query(
      `select public.set_scheduled_payment_status($1, $2, $3)`, [row.id, row.version, operation]
    )), /Payment not available/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.delete_scheduled_payment($1, $2)`, [row.id, row.version])), /Payment not available/);
    await assert.rejects(as(ALEX, (tx) => tx.query(
      `select public.save_scheduled_payment($1, $2, $3, $4::jsonb)`, [household.id, row.id, row.version, JSON.stringify(privateBill.values)]
    )), /Payment not available/);
  });

  it('supports pausing, resuming and archiving without losing history', async () => {
    let row = await schedule(ALEX, sharedBill.id);
    await as(SARAH, (tx) => tx.query(`select public.set_scheduled_payment_status($1, $2, 'paused')`, [row.id, row.version]));
    row = await schedule(ALEX, sharedBill.id);
    await assert.rejects(pay(ALEX, row), /Payment changed/);
    await as(ALEX, (tx) => tx.query(`select public.set_scheduled_payment_status($1, $2, 'active')`, [row.id, row.version]));
    row = await schedule(ALEX, sharedBill.id);
    await as(SARAH, (tx) => tx.query(`select public.set_scheduled_payment_status($1, $2, 'archived')`, [row.id, row.version]));
    assert.equal((await schedule(ALEX, sharedBill.id)).status, 'archived');
    assert.equal((await as(ALEX, (tx) => tx.query(`select id from public.payment_records where schedule_ref = $1`, [sharedBill.id]))).rows.length, 2);
  });

  it('deletes schedules while keeping immutable history snapshots and transaction links', async () => {
    for (const [user, bill] of [[ALEX, sharedBill], [SARAH, privateBill]]) {
      const row = await schedule(user, bill.id);
      await as(user, (tx) => tx.query(`select public.delete_scheduled_payment($1, $2)`, [row.id, row.version]));
      const records = await as(user, (tx) => tx.query(`select * from public.payment_records where schedule_ref = $1`, [row.id]));
      assert.ok(records.rows.length > 0);
      assert.ok(records.rows.every((record) => record.schedule_id === null));
      assert.ok(records.rows.every((record) => record.name === bill.values.name));
    }
    assert.equal((await as(ALEX, (tx) => tx.query(`select * from public.payment_records where schedule_ref = $1`, [privateBill.id]))).rows.length, 0);
    await assert.rejects(as(ALEX, (tx) => tx.query(`update public.payment_records set amount_minor = 1`)), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`delete from public.payment_records`)), /permission denied/);
  });

  it('estimates variable bills from the latest three cycles without logging unwanted transactions', async () => {
    const variable = await createPayment(ALEX, { name: 'Variable bank bill', expectedAmountMinor: null, dueStart: '2026-01-14', dueEnd: '2026-01-16' });
    for (const amount of [100, 200, 400]) await pay(ALEX, await schedule(ALEX, variable.id), amount, false);
    const result = await as(SARAH, (tx) => tx.query(`select public.get_payment_workspace($1) as data`, [household.id]));
    const row = result.rows[0].data.schedules.find((value) => value.id === variable.id);
    assert.equal(Number(row.estimate_minor), 233);
    assert.deepEqual(row.recent_amounts.map((value) => Number(value.amount_minor)), [400, 200, 100]);
    assert.equal(row.due_start, '2026-04-14');
    assert.equal(row.due_end, '2026-04-16');
    const records = await as(ALEX, (tx) => tx.query(`select shared_transaction_id from public.payment_records where schedule_ref = $1`, [variable.id]));
    assert.ok(records.rows.every((value) => value.shared_transaction_id === null));
  });

  it('completes one-time bills and does not allow paying the same cycle twice', async () => {
    const bill = await createPayment(ALEX, { recurrence: 'one_time', dueStart: '2026-11-02', dueEnd: '2026-11-02' });
    const row = await schedule(ALEX, bill.id);
    await pay(ALEX, row, 1000, false);
    const completed = await schedule(ALEX, bill.id);
    assert.equal(completed.status, 'completed');
    await assert.rejects(pay(ALEX, completed), /Payment changed/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.set_scheduled_payment_status($1, $2, 'active')`, [completed.id, completed.version])), /Invalid payment state/);
  });

  it('rejects invalid dates, cross-month recurring windows, negative amounts and private payer spoofing', async () => {
    for (const invalid of [
      { dueStart: '2026-02-30', dueEnd: '2026-02-30' },
      { dueStart: '2026-11-30', dueEnd: '2026-12-02' },
      { dueStart: '2026-11-16', dueEnd: '2026-11-14' },
      { expectedAmountMinor: -1 }, { expectedAmountMinor: 1.5 }, { reminderDaysBefore: 31 },
      { visibility: 'private', payerId: SARAH }, { payerId: MALLORY },
    ]) await assert.rejects(createPayment(ALEX, invalid));
  });

  it('rejects stale edits, fixed privacy changes and rescheduling a paid monthly cycle', async () => {
    const bill = await createPayment(ALEX);
    const row = await schedule(ALEX, bill.id);
    const update = (values, version = row.version) => as(SARAH, (tx) => tx.query(
      `select public.save_scheduled_payment($1, $2, $3, $4::jsonb)`, [household.id, row.id, version, JSON.stringify(values)]
    ));
    await update({ ...bill.values, name: 'Updated bill' });
    await assert.rejects(update(bill.values), /Payment changed/);
    let latest = await schedule(ALEX, bill.id);
    await assert.rejects(update({ ...bill.values, visibility: 'private', payerId: SARAH }, latest.version), /Payment type is fixed/);
    await pay(ALEX, latest, 1000, false);
    latest = await schedule(ALEX, bill.id);
    await assert.rejects(update({ ...bill.values, dueStart: '2026-01-02', dueEnd: '2026-01-02' }, latest.version), /Payment cycle already paid/);
  });

  it('records the current month paid state by the due cycle rather than the actual paid month', async () => {
    const dates = await db.query(`select date_trunc('month', now() at time zone 'Africa/Johannesburg')::date as start`);
    const start = dateOnly(dates.rows[0].start);
    const bill = await createPayment(ALEX, { dueStart: start, dueEnd: start });
    await pay(ALEX, await schedule(ALEX, bill.id), 1000, false);
    const result = await as(SARAH, (tx) => tx.query(`select public.get_payment_workspace($1) as data`, [household.id]));
    assert.equal(result.rows[0].data.schedules.find((value) => value.id === bill.id).paid_this_month, true);
  });

  it('blocks outsiders, anonymous users and direct writes, including internal helper access', async () => {
    const bill = await createPayment(ALEX);
    const row = await schedule(ALEX, bill.id);
    const outsider = await as(MALLORY, (tx) => tx.query(`select public.get_payment_workspace($1) as data`, [household.id]));
    assert.equal(outsider.rows[0].data, null);
    assert.equal((await as(MALLORY, (tx) => tx.query(`select * from public.payment_records`))).rows.length, 0);
    await assert.rejects(pay(MALLORY, row), /Payment not available/);
    await assert.rejects(pay(null, row), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`update public.scheduled_payments set payer_id = $1`, [SARAH])), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.lock_scheduled_payment($1, $2)`, [row.id, row.version])), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`delete from public.categories where id = $1`, [paymentCategory])), /permission denied/);
    await assert.rejects(as(null, (tx) => tx.query(`select * from public.scheduled_payments`)), /permission denied/);
  });
});

async function category(user, id) {
  const { rows } = await as(user, (tx) => tx.query(`select * from public.categories where id = $1`, [id]));
  return rows[0];
}
async function createCategory(user, name, visibility = 'shared') {
  const { rows } = await as(user, (tx) => tx.query(`select public.save_category($1, null, null, $2::jsonb) as id`, [
    household.id, JSON.stringify({ name, visibility, bucket: 'needs', emoji: '🛒' }),
  ]));
  return category(user, rows[0].id);
}
async function archiveCategory(user, source, replacementId) {
  return as(user, (tx) => tx.query(`select public.archive_category($1, $2, $3) as result`, [source.id, source.version, replacementId]));
}

describe('categories and expense frequency', () => {
  let privateA, privateB, shared;
  it('seeds the ten planned editable categories in a new household', async () => {
    const result = await as(MALLORY, (tx) => tx.query(`select public.create_household('Another home', 'USD', 'UTC', 'Mallory')`));
    assert.ok(result.rows.length);
    const { rows } = await as(MALLORY, (tx) => tx.query(`select name, bucket from public.categories order by sort_order`));
    assert.deepEqual(rows.map((row) => row.name), ['Essentials', 'Entertainment', 'Housing', 'Transport', 'Utilities', 'Health', 'Personal', 'Fun', 'Savings', 'Other']);
    assert.equal(rows.find((row) => row.name === 'Essentials').bucket, 'needs');
    assert.equal(rows.find((row) => row.name === 'Entertainment').bucket, 'wants');
    assert.equal(rows.find((row) => row.name === 'Savings').bucket, 'savings');
  });

  it('shares household custom categories but hides private custom names and buckets', async () => {
    privateA = await createCategory(ALEX, 'Private treatment', 'private');
    privateB = await createCategory(SARAH, 'Private surprise', 'private');
    shared = await createCategory(ALEX, 'Our custom label');
    assert.equal((await category(SARAH, shared.id)).name, 'Our custom label');
    assert.equal(await category(SARAH, privateA.id), undefined);
    assert.equal(await category(ALEX, privateB.id), undefined);
    const workspace = await as(ALEX, (tx) => tx.query(`select public.get_payment_workspace($1) as data`, [household.id]));
    assert.ok(workspace.rows[0].data.categories.some((row) => row.id === privateA.id));
    assert.ok(!workspace.rows[0].data.categories.some((row) => row.id === privateB.id));
    assert.ok(!JSON.stringify(workspace.rows).includes('Private surprise'));
  });

  it('lets either partner rename shared categories, set emoji/bucket and rejects stale edits', async () => {
    await as(SARAH, (tx) => tx.query(`select public.save_category($1, $2, $3, $4::jsonb)`, [household.id, shared.id, shared.version,
      JSON.stringify({ name: 'Our renamed label', emoji: '🎬', bucket: 'wants', visibility: 'shared' })]));
    const updated = await category(ALEX, shared.id);
    assert.equal(updated.name, 'Our renamed label');
    assert.equal(updated.emoji, '🎬');
    assert.equal(updated.bucket, 'wants');
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.save_category($1, $2, $3, $4::jsonb)`, [household.id, shared.id, shared.version,
      JSON.stringify({ name: 'Stale name', emoji: null, bucket: 'needs', visibility: 'shared' })])), /Category changed/);
  });

  it('reorders only the requested visible scope and updates neighbor versions', async () => {
    const first = await createCategory(ALEX, 'First private', 'private');
    const second = await createCategory(ALEX, 'Second private', 'private');
    const otherBefore = await category(SARAH, privateB.id);
    await as(ALEX, (tx) => tx.query(`select public.move_category($1, $2, -1)`, [second.id, second.version]));
    const a = await category(ALEX, first.id); const b = await category(ALEX, second.id);
    assert.ok(b.sort_order < a.sort_order);
    assert.equal(a.version, first.version + 1);
    assert.equal(b.version, second.version + 1);
    assert.equal((await category(SARAH, privateB.id)).sort_order, otherBefore.sort_order);
    await assert.rejects(as(SARAH, (tx) => tx.query(`select public.move_category($1, $2, -1)`, [b.id, b.version])), /Category unavailable/);
  });

  it('prevents private labels entering shared expenses or schedules, even through definer RPCs', async () => {
    await assert.rejects(as(ALEX, (tx) => tx.query(`insert into public.shared_transactions(household_id, paid_by, amount_minor, category_id) values ($1, $2, 100, $3)`,
      [household.id, ALEX, privateA.id])), /Category unavailable/);
    await assert.rejects(createPayment(ALEX, { categoryId: privateA.id }), /Category unavailable/);
    await assert.rejects(createPayment(ALEX, { categoryId: privateB.id, visibility: 'private' }), /Category unavailable/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`insert into public.private_transactions(household_id, category_id, amount_minor) values ($1, $2, 100)`,
      [household.id, privateB.id])), /Category unavailable/);
    const own = await createPayment(ALEX, { categoryId: privateA.id, visibility: 'private' });
    assert.equal((await schedule(ALEX, own.id)).category_id, privateA.id);
    assert.equal(await schedule(SARAH, own.id), undefined);
  });

  it('requires a replacement regardless of whether only hidden private usage exists', async () => {
    const empty = await createCategory(ALEX, 'Empty category');
    const hidden = await createCategory(ALEX, 'Hidden usage category');
    await as(SARAH, (tx) => tx.query(`insert into public.private_transactions(household_id, category_id, amount_minor, description) values ($1, $2, 777, 'Never reveal this')`, [household.id, hidden.id]));
    await assert.rejects(archiveCategory(ALEX, empty, null), /Choose replacement category/);
    await assert.rejects(archiveCategory(ALEX, hidden, null), /Choose replacement category/);
    const target = await createCategory(ALEX, 'Archive destination');
    const first = await archiveCategory(ALEX, empty, target.id);
    const second = await archiveCategory(ALEX, hidden, target.id);
    assert.deepEqual(first.rows, second.rows); // no affected-row counts or private data
    assert.equal((await category(ALEX, hidden.id)).archived, true);
    const privateRows = await as(SARAH, (tx) => tx.query(`select category_id from public.private_transactions where description = 'Never reveal this'`));
    assert.equal(privateRows.rows[0].category_id, target.id);
    assert.equal((await as(ALEX, (tx) => tx.query(`select * from public.private_transactions where description = 'Never reveal this'`))).rows.length, 0);
  });

  it('atomically reassigns shared/private expenses and schedules while preserving paid history snapshots', async () => {
    const source = await createCategory(ALEX, 'Move all items');
    const target = await createCategory(ALEX, 'Moved items');
    await as(ALEX, (tx) => tx.query(`insert into public.shared_transactions(household_id, paid_by, category_id, amount_minor) values ($1, $2, $3, 1234)`, [household.id, ALEX, source.id]));
    await as(SARAH, (tx) => tx.query(`insert into public.private_transactions(household_id, category_id, amount_minor, description) values ($1, $2, 2222, 'Private archive case')`, [household.id, source.id]));
    const bill = await createPayment(ALEX, { categoryId: source.id });
    const secretBill = await createPayment(SARAH, { visibility: 'private', categoryId: source.id });
    await pay(ALEX, await schedule(ALEX, bill.id), 3333, false);
    const staleBill = await schedule(ALEX, bill.id);
    await archiveCategory(SARAH, source, target.id);
    assert.equal((await schedule(ALEX, bill.id)).category_id, target.id);
    assert.equal((await schedule(SARAH, secretBill.id)).category_id, target.id);
    assert.equal((await as(SARAH, (tx) => tx.query(`select category_id from public.private_transactions where description = 'Private archive case'`))).rows[0].category_id, target.id);
    const history = await as(ALEX, (tx) => tx.query(`select category_name from public.payment_records where schedule_ref = $1`, [bill.id]));
    assert.equal(history.rows[0].category_name, 'Move all items');
    await assert.rejects(pay(ALEX, staleBill), /Payment changed/);
    await assert.rejects(createPayment(ALEX, { categoryId: source.id }), /Invalid payment input/);
    const archived = await category(ALEX, source.id);
    await as(ALEX, (tx) => tx.query(`select public.restore_category($1, $2)`, [archived.id, archived.version]));
    assert.equal((await category(SARAH, source.id)).archived, false);
  });

  it('does not move shared items into a private label and rolls the archive back', async () => {
    const source = await createCategory(ALEX, 'Must stay shared');
    await assert.rejects(archiveCategory(ALEX, source, privateA.id), /Category unavailable/);
    assert.equal((await category(ALEX, source.id)).archived, false);
    assert.equal((await category(ALEX, source.id)).version, source.version);
    await assert.rejects(archiveCategory(SARAH, privateA, shared.id), /Category unavailable/);
  });

  it('gives uncategorized legacy-client inserts an active shared category and a one-time frequency', async () => {
    const { rows } = await as(ALEX, (tx) => tx.query(`insert into public.shared_transactions(household_id, paid_by, amount_minor) values ($1, $2, 456) returning category_id, frequency`, [household.id, ALEX]));
    assert.ok(rows[0].category_id);
    assert.equal(rows[0].frequency, 'one_time');
    assert.equal((await category(ALEX, rows[0].category_id)).visibility, 'shared');
  });

  it('keeps monthly schedule links/frequency on transactions even after the schedule is deleted', async () => {
    const bill = await createPayment(ALEX);
    const paid = await pay(ALEX, await schedule(ALEX, bill.id));
    const record = await as(ALEX, (tx) => tx.query(`select shared_transaction_id from public.payment_records where id = $1`, [paid.rows[0].id]));
    const expense = await as(ALEX, (tx) => tx.query(`select * from public.shared_transactions where id = $1`, [record.rows[0].shared_transaction_id]));
    const row = expense.rows[0];
    assert.equal(row.frequency, 'monthly');
    assert.equal(row.scheduled_payment_ref, bill.id);
    await assert.rejects(as(ALEX, (tx) => tx.query(`update public.shared_transactions set scheduled_payment_ref = null, frequency = 'one_time' where id = $1`, [row.id])), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`update public.shared_transactions set frequency = 'one_time' where id = $1`, [row.id])), /Linked frequency is fixed/);
    await assert.rejects(as(SARAH, (tx) => tx.query(`select public.classify_expense($1, 'shared', $2, $3, $4, 'one_time')`, [household.id, row.id, row.version, row.category_id])), /Linked frequency is fixed/);
    const next = await schedule(ALEX, bill.id);
    await as(ALEX, (tx) => tx.query(`select public.delete_scheduled_payment($1, $2)`, [bill.id, next.version]));
    await assert.rejects(as(SARAH, (tx) => tx.query(`update public.shared_transactions set scheduled_payment_ref = null where id = $1`, [row.id])), /permission denied/);
    await assert.rejects(as(SARAH, (tx) => tx.query(`update public.shared_transactions set frequency = 'one_time' where id = $1`, [row.id])), /Linked frequency is fixed/);
    await as(SARAH, (tx) => tx.query(`select public.classify_expense($1, 'shared', $2, $3, $4, 'monthly')`, [household.id, row.id, row.version, shared.id]));
    const after = await as(ALEX, (tx) => tx.query(`select frequency, scheduled_payment_ref from public.shared_transactions where id = $1`, [row.id]));
    assert.equal(after.rows[0].frequency, 'monthly');
    assert.equal(after.rows[0].scheduled_payment_ref, bill.id);
  });

  it('classifies manual expenses without changing their amount/date and blocks partner private edits', async () => {
    const inserted = await as(ALEX, (tx) => tx.query(`insert into public.shared_transactions(household_id, paid_by, amount_minor, occurred_on) values ($1, $2, 9876, '2026-10-20') returning *`, [household.id, ALEX]));
    const row = inserted.rows[0];
    await as(SARAH, (tx) => tx.query(`select public.classify_expense($1, 'shared', $2, $3, $4, 'monthly')`, [household.id, row.id, row.version, shared.id]));
    const after = await as(ALEX, (tx) => tx.query(`select * from public.shared_transactions where id = $1`, [row.id]));
    assert.equal(Number(after.rows[0].amount_minor), 9876);
    assert.equal(dateOnly(after.rows[0].occurred_on), '2026-10-20');
    assert.equal(after.rows[0].frequency, 'monthly');
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.classify_expense($1, 'shared', $2, $3, $4, 'monthly')`, [household.id, row.id, row.version, shared.id])), /Expense changed/);
    const secret = await as(SARAH, (tx) => tx.query(`insert into public.private_transactions(household_id, amount_minor, category_id) values ($1, 100, $2) returning *`, [household.id, privateB.id]));
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.classify_expense($1, 'private', $2, $3, $4, 'monthly')`, [household.id, secret.rows[0].id, secret.rows[0].version, shared.id])), /Expense unavailable/);
  });

  it('keeps private paid-expense links immutable before and after schedule deletion', async () => {
    const bill = await createPayment(SARAH, { visibility: 'private', categoryId: privateB.id });
    const paid = await pay(SARAH, await schedule(SARAH, bill.id), 2222);
    const records = await as(SARAH, (tx) => tx.query(`select private_transaction_id from public.payment_records where id = $1`, [paid.rows[0].id]));
    const id = records.rows[0].private_transaction_id;
    await assert.rejects(as(SARAH, (tx) => tx.query(`update public.private_transactions set frequency = 'one_time' where id = $1`, [id])), /Linked frequency is fixed/);
    const next = await schedule(SARAH, bill.id);
    await as(SARAH, (tx) => tx.query(`select public.delete_scheduled_payment($1, $2)`, [bill.id, next.version]));
    await assert.rejects(as(SARAH, (tx) => tx.query(`update public.private_transactions set scheduled_payment_ref = null where id = $1`, [id])), /permission denied/);
    await assert.rejects(as(SARAH, (tx) => tx.query(`update public.private_transactions set frequency = 'one_time' where id = $1`, [id])), /Linked frequency is fixed/);
    const { rows } = await as(SARAH, (tx) => tx.query(`select scheduled_payment_ref, frequency, amount_minor from public.private_transactions where id = $1`, [id]));
    assert.equal(rows[0].scheduled_payment_ref, bill.id);
    assert.equal(rows[0].frequency, 'monthly');
    assert.equal(Number(rows[0].amount_minor), 2222);
  });

  it('blocks outsiders, direct category writes, scope changes and internal helper execution', async () => {
    await assert.rejects(createCategory(MALLORY, 'Intrusion'), /Category unavailable/);
    await assert.rejects(createCategory(null, 'Anonymous'), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`update public.categories set archived = true`)), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`insert into public.categories(household_id, name) values ($1, 'Bypass')`, [household.id])), /permission denied/);
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.validate_expense_category($1, $2, 'private', $3)`, [household.id, privateB.id, SARAH])), /permission denied/);
    const latest = await category(ALEX, shared.id);
    await assert.rejects(as(ALEX, (tx) => tx.query(`select public.save_category($1, $2, $3, $4::jsonb)`, [household.id, shared.id, latest.version,
      JSON.stringify({ name: latest.name, emoji: null, bucket: 'needs', visibility: 'private' })])), /Category visibility is fixed/);
    const outsider = await as(MALLORY, (tx) => tx.query(`select * from public.categories where household_id = $1`, [household.id]));
    assert.equal(outsider.rows.length, 0);
  });
});
