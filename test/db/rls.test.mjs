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
    assert.equal(rows.length, 8);
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
