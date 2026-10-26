import { queued, quickInput, saved } from '../test/fixtures/quick-log';
import { readQueue, writeQueueItem, type LocalStore } from '@/features/quick-log/local';
import { quickLogInput, recordedRate, type QueuedLog } from '@/features/quick-log/schema';
import { syncEntry } from '@/features/quick-log/sync';

function storage(): LocalStore {
  const map = new Map<string, string>();
  return { get length() { return map.size; }, key: i => [...map.keys()][i] ?? null, getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); }, removeItem: key => { map.delete(key); } };
}
const dependencies = () => ({ current: () => true, send: jest.fn(async (_entry: QueuedLog) => saved), attach: jest.fn(async (): Promise<void | { cancelled: boolean }> => {}), write: jest.fn((_entry: QueuedLog) => {}) });
it('durably roundtrips a queue and scopes it to the exact account and household', () => {
  const store = storage();
  expect(writeQueueItem(store, queued)).toBe(true);
  expect(readQueue(store, queued.userId, queued.householdId)).toEqual([queued]);
  expect(readQueue(store, 'other-account', queued.householdId)).toEqual([]);
  expect(readQueue(store, queued.userId, 'other-household')).toEqual([]);
  expect(writeQueueItem(store, queued)).toBe(false); // no sync-trigger loop from unchanged state
});
it('never sends corrupted device data and preserves it for recovery', () => {
  const store = storage(); writeQueueItem(store, queued);
  store.setItem(store.key(0)!, '{invalid');
  expect(() => readQueue(store, queued.userId, queued.householdId)).toThrow('Saved queue needs recovery');
  expect(store.length).toBe(1);
});
it('reports local storage failure before claiming a queued entry was saved', () => {
  const store = storage(); store.setItem = () => { throw new Error('Quota exceeded'); };
  expect(() => writeQueueItem(store, queued)).toThrow('Quota exceeded');
});
it('retries a lost acknowledgement using the same identifier and original payload', async () => {
  const deps = dependencies();
  deps.send.mockRejectedValueOnce(new TypeError('Network interrupted after commit'));
  const first = await syncEntry(queued, deps);
  expect(first.status).toBe('pending');
  const second = await syncEntry(first, deps);
  expect(second.status).toBe('synced');
  expect(deps.send.mock.calls.map(call => call[0].id)).toEqual([queued.id, queued.id]);
  expect(deps.send.mock.calls.map(call => call[0].values)).toEqual([quickInput, quickInput]);
});
it('stores the ledger acknowledgement before uploading a receipt and never logs it again on upload retry', async () => {
  const deps = dependencies(); deps.send.mockResolvedValue({ ...saved, receiptPath: 'test.jpg' });
  deps.attach.mockRejectedValueOnce(new TypeError('Upload offline'));
  const first = await syncEntry({ ...queued, values: { ...quickInput, receipt: true } }, deps);
  expect(first.status).toBe('receipt_pending'); expect(first.result?.transactionId).toBe(saved.transactionId);
  expect(deps.write.mock.calls[0][0].result).toEqual({ ...saved, receiptPath: 'test.jpg' });
  const second = await syncEntry(first, deps);
  expect(second.status).toBe('synced'); expect(deps.send).toHaveBeenCalledTimes(1); expect(deps.attach).toHaveBeenCalledTimes(2);
});
it('asks for review when a schedule/category changed instead of silently logging another expense', async () => {
  const deps = dependencies(); deps.send.mockRejectedValue({ code: '40001', message: 'Payment changed' });
  const item = await syncEntry(queued, deps);
  expect(item.status).toBe('blocked'); expect(item.reason).toBe('review'); expect(item.result).toBeNull();
  expect(item.values).toEqual(quickInput); expect(deps.attach).not.toHaveBeenCalled();
});
it('does not send another account’s entry and stops the attachment phase if account changes', async () => {
  const deps = dependencies(); deps.current = () => false;
  expect(await syncEntry(queued, deps)).toBe(queued); expect(deps.send).not.toHaveBeenCalled();
  let current = true; deps.current = () => current;
  deps.send.mockImplementation(async () => { current = false; return { ...saved, receiptPath: 'private.jpg' }; });
  await syncEntry({ ...queued, values: { ...quickInput, receipt: true } }, deps);
  expect(deps.attach).not.toHaveBeenCalled();
});
it('skips entries already acknowledged as fully synced', async () => {
  const deps = dependencies(); await syncEntry({ ...queued, status: 'synced', result: saved }, deps);
  expect(deps.send).not.toHaveBeenCalled(); expect(deps.attach).not.toHaveBeenCalled();
});
it('validates foreign provenance and records a rate from explicitly supplied base money', () => {
  expect(recordedRate(12345, 'USD', 10000, 'EUR')).toBe('1.2345000000');
  expect(recordedRate(12345, 'USD', 100, 'JPY')).toBe('1.2345000000');
  expect(quickLogInput.safeParse({ ...quickInput, originalCurrency: 'EUR' }).success).toBe(false);
  expect(quickLogInput.safeParse({ ...quickInput, scheduleId: queued.id }).success).toBe(false);
});

it('ends receipt retries after a verified removal, including a lost finalization acknowledgement', async () => {
  const deps = dependencies();
  deps.send.mockResolvedValue({ ...saved, receiptPath: 'photo.jpg' });
  deps.attach.mockRejectedValueOnce(new TypeError('Finalization committed but acknowledgement lost'));
  const pending = await syncEntry({ ...queued, values: { ...quickInput, receipt: true } }, deps);
  expect(pending.status).toBe('receipt_pending');
  deps.attach.mockResolvedValueOnce({ cancelled: true });
  const cancelled = await syncEntry(pending, deps);
  expect(cancelled.status).toBe('synced'); expect(cancelled.result?.receiptPath).toBeNull();
  await syncEntry(cancelled, deps);
  expect(deps.send).toHaveBeenCalledTimes(1); expect(deps.attach).toHaveBeenCalledTimes(2);
});

it('preserves older drafts without currency context and requires review before submission', async () => {
  const store = storage(); const legacy = { ...queued, values: { ...quickInput, baseCurrency: undefined } };
  writeQueueItem(store, legacy);
  const restored = readQueue(store, queued.userId, queued.householdId)[0];
  const deps = dependencies(); const result = await syncEntry(restored, deps);
  expect(result.status).toBe('blocked'); expect(deps.send).not.toHaveBeenCalled();
});
