import type { LogResult, QueuedLog } from './schema';

type Dependencies = {
  current: () => boolean;
  send: (entry: QueuedLog) => Promise<LogResult>;
  attach: (entry: QueuedLog, result: LogResult) => Promise<void | { cancelled: boolean }>;
  write: (entry: QueuedLog) => void;
};
export function definitiveFailure(error: unknown) {
  return !!error && typeof error === 'object' && 'code' in error && typeof error.code === 'string' &&
    /^(P0001|42501|22023|40001|23503|23514|23505|PGRST301|PGRST302)$/.test(error.code);
}
/** Each phase is durable. Attachment failures never replay the ledger mutation. */
export async function syncEntry(entry: QueuedLog, deps: Dependencies): Promise<QueuedLog> {
  if (entry.status === 'synced' || !deps.current()) return entry;
  let next = { ...entry };
  if (!entry.values.baseCurrency && !entry.result) {
    next = { ...next, status: 'blocked', reason: 'review' };
    deps.write(next);
    return next;
  }
  try {
    if (!next.result) {
      const result = await deps.send(next);
      next = { ...next, result, status: next.values.receipt ? 'receipt_pending' : 'synced', reason: null };
      deps.write(next); // Persist the server acknowledgement before any upload.
    }
    if (!deps.current()) return next;
    if (next.values.receipt && next.status !== 'synced') {
      const attachment = await deps.attach(next, next.result!);
      next = { ...next, result: attachment?.cancelled ? { ...next.result!, receiptPath: null } : next.result, status: 'synced', reason: null };
      deps.write(next);
    }
    return next;
  } catch (error) {
    next = { ...next, status: next.result ? 'receipt_pending' : definitiveFailure(error) ? 'blocked' : 'pending',
      reason: next.result ? 'receipt' : definitiveFailure(error) ? 'review' : 'network' };
    deps.write(next);
    return next;
  }
}
