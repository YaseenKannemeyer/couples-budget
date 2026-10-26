import { loadHomeActivity } from '@/features/dashboard/data';
import { me, partner } from '../test/fixtures/payments';

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
type Row = Record<string, unknown>;

// A minimal PostgREST test double. Own private payment history is deliberately
// readable here, as in RLS, so omitting the dashboard's shared filter leaks it.
class Query {
  fields = '';
  cap = Infinity;
  sort: { key: string; ascending: boolean }[] = [];
  constructor(public rows: Row[]) {}
  select(fields: string) { this.fields = fields; return this; }
  eq(key: string, value: unknown) { this.rows = this.rows.filter(row => row[key] === value); return this; }
  lte(key: string, value: string) { this.rows = this.rows.filter(row => String(row[key]) <= value); return this; }
  gte(key: string, value: string) { this.rows = this.rows.filter(row => String(row[key]) >= value); return this; }
  lt(key: string, value: string) { this.rows = this.rows.filter(row => String(row[key]) < value); return this; }
  order(key: string, options: { ascending: boolean }) { this.sort.push({ key, ...options }); return this; }
  limit(count: number) { this.cap = count; return this; }
  then(resolve: (value: { data: Row[]; error: null }) => unknown) {
    const rows = [...this.rows].sort((a, b) => {
      for (const sort of this.sort) {
        const delta = String(a[sort.key]).localeCompare(String(b[sort.key]));
        if (delta) return sort.ascending ? delta : -delta;
      }
      return 0;
    }).slice(0, this.cap).map(row => Object.fromEntries(this.fields.split(',').map(key => [key, row[key]])));
    return Promise.resolve({ data: rows, error: null }).then(resolve);
  }
}
const hid = uuid(50);
const expense = (id: number, on: string, created: string): Row => ({
  id: uuid(id), household_id: hid, description: `Shared ${id}`, amount_minor: 2500, occurred_on: on, created_at: created, paid_by: partner.userId,
});
const payment = (id: number, visibility: string): Row => ({
  id: uuid(id), household_id: hid, visibility, name: visibility === 'shared' ? 'Shared bill' : 'Private medical history',
  amount_minor: 9999, paid_on: '2026-10-24', due_start: '2026-10-24', due_end: '2026-10-24', cycle_on: '2026-10-24', schedule_ref: uuid(80),
});

it('loads only shared activity/history, excludes future activity and caps the feed on the server', async () => {
  const tables: Record<string, Row[]> = {
    shared_transactions: [...Array.from({ length: 8 }, (_, i) => expense(i + 1, '2026-10-24', `2026-10-25T${String(i + 1).padStart(2, '0')}:00:00Z`)),
      expense(9, '2026-10-30', '2026-10-25T20:00:00Z'), { ...expense(10, '2026-10-24', '2026-10-25T21:00:00Z'), household_id: uuid(99) }],
    private_transactions: [{ ...expense(11, '2026-10-24', '2026-10-25T21:00:00Z'), description: 'Private gift' }],
    payment_records: [payment(12, 'private'), payment(13, 'shared'), { ...payment(14, 'shared'), cycle_on: '2026-09-24' }],
  };
  const client = { from: (table: string) => new Query(tables[table]), rpc: jest.fn(async () => ({ data: [
    { user_id: me.userId, display_name: 'Alex', remaining_minor: 12345, spent_minor: 'RAW_AGGREGATE_FIELD' },
  ], error: null })) } as unknown as Parameters<typeof loadHomeActivity>[0];
  const data = await loadHomeActivity(client, hid, '2026-10-25');
  expect(data.recent).toHaveLength(5);
  expect(data.recent.map(row => row.id)).toEqual([8, 7, 6, 5, 4].map(uuid));
  expect(data.paid.map(row => row.id)).toEqual([uuid(13)]);
  expect(JSON.stringify(data)).not.toMatch(/Private|RAW_AGGREGATE_FIELD/);
  expect(data.allowances[0]).toEqual({ user_id: me.userId, display_name: 'Alex', remaining_minor: 12345 });
});
it('propagates failed aggregate reads rather than fabricating a zero allowance', async () => {
  const failure = { message: 'Connection interrupted' };
  const client = { from: () => new Query([]), rpc: async () => ({ data: null, error: failure }) } as unknown as Parameters<typeof loadHomeActivity>[0];
  await expect(loadHomeActivity(client, hid, '2026-10-25')).rejects.toBe(failure);
});
