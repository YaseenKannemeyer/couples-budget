import { z } from 'zod';
import { queuedLog, type QueuedLog } from './schema';

export interface LocalStore { length: number; key(index: number): string | null; getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const prefix = (userId: string, householdId: string) => `quick-log:v1:${userId}:${householdId}:`;
export function readQueue(store: LocalStore, userId: string, householdId: string): QueuedLog[] {
  const entries: QueuedLog[] = [];
  let unreadable = false;
  for (let i = 0; i < store.length; i++) {
    const key = store.key(i);
    if (!key?.startsWith(prefix(userId, householdId))) continue;
    try {
      const value = queuedLog.parse(JSON.parse(store.getItem(key) ?? 'null'));
      if (value.userId === userId && value.householdId === householdId) entries.push(value);
    } catch { unreadable = true; /* Preserve unreadable data; never submit it. */ }
  }
  if (unreadable) throw new Error('Saved queue needs recovery');
  return entries.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
}
export function writeQueueItem(store: LocalStore, item: QueuedLog) {
  const value = queuedLog.parse(item);
  const key = prefix(value.userId, value.householdId) + value.id;
  const serialized = JSON.stringify(value);
  if (store.getItem(key) === serialized) return false;
  store.setItem(key, serialized);
  return true;
}
export function deleteQueueItem(store: LocalStore, item: QueuedLog) { store.removeItem(prefix(item.userId, item.householdId) + item.id); }
export function readCached<T>(key: string, schema: z.ZodType<T>): T | undefined {
  try { const result = schema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null')); return result.success ? result.data : undefined; }
  catch { return undefined; }
}
export function cacheRaw(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Online reads still work if device storage is full. */ }
}
