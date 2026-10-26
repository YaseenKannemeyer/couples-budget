import { loadOwnAllowance, privateUpcoming } from '@/features/private-space/data';
import { household, me, partner, schedule } from '../test/fixtures/payments';

const own = { user_id: me.userId, allowance_minor: '30000', spent_minor: '7000', remaining_minor: '23000' };
const client = (data: unknown, error: unknown = null) => ({ rpc: jest.fn(async () => ({ data, error })) }) as unknown as Parameters<typeof loadOwnAllowance>[0];
it('retains only the signed-in owner’s aggregate, including exact integer money', async () => {
  const result = await loadOwnAllowance(client([{ ...own, user_id: partner.userId, display_name: 'Partner' }, { ...own, display_name: 'Me', extra: 'unused' }]), household.id, me.userId);
  expect(result).toEqual({ user_id: me.userId, allowance_minor: 30000, spent_minor: 7000, remaining_minor: 23000 });
  expect(JSON.stringify(result)).not.toMatch(/Partner|unused/);
});
it('keeps negative remaining and refunds without clamping', async () => {
  expect((await loadOwnAllowance(client([{ ...own, spent_minor: 35000, remaining_minor: -5000 }]), household.id, me.userId)).remaining_minor).toBe(-5000);
  expect((await loadOwnAllowance(client([{ ...own, spent_minor: -1000, remaining_minor: 31000 }]), household.id, me.userId)).remaining_minor).toBe(31000);
});
it('fails on missing or inconsistent own balance rather than substituting the partner or zero', async () => {
  await expect(loadOwnAllowance(client([{ ...own, user_id: partner.userId }]), household.id, me.userId)).rejects.toThrow();
  await expect(loadOwnAllowance(client([{ ...own, remaining_minor: 0 }]), household.id, me.userId)).rejects.toThrow();
  await expect(loadOwnAllowance(client([{ ...own, spent_minor: Number.MAX_SAFE_INTEGER + 1 }]), household.id, me.userId)).rejects.toThrow();
  await expect(loadOwnAllowance(client([{ ...own, allowance_minor: null, spent_minor: null, remaining_minor: null }]), household.id, me.userId)).rejects.toThrow();
  const failure = { message: 'offline' };
  await expect(loadOwnAllowance(client(null, failure), household.id, me.userId)).rejects.toBe(failure);
});
it('shows only active owner-private schedules in this household, sorted with overdue bills first', () => {
  const ownPayment = { ...schedule, visibility: 'private' as const };
  const result = privateUpcoming([schedule, ownPayment, { ...ownPayment, id: 'partner', ownerId: partner.userId },
    { ...ownPayment, id: 'elsewhere', householdId: 'other' }, { ...ownPayment, id: 'paused', status: 'paused' },
    { ...ownPayment, id: 'future', dueStart: '2027-03-01', dueEnd: '2027-03-01' },
    { ...ownPayment, id: 'late', dueStart: '2026-10-01', dueEnd: '2026-10-03' }], household.id, me.userId, '2026-10-25');
  expect(result.map(s => s.id)).toEqual(['late', schedule.id]);
  expect(result[1].estimateMinor).toBe(7500); expect(result[1].dueEnd).toBe('2026-11-16');
});
