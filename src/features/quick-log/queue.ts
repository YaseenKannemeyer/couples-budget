import { useEffect, useSyncExternalStore } from 'react';
import { AppState, Platform } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { deleteQueueItem, readQueue, writeQueueItem } from './local';
import { deleteReceipt, readReceipt } from './receipt-files';
import { logResult, quickLogInput, type QueuedLog, type QuickLogInput } from './schema';
import { syncEntry } from './sync';

let version = 0;
let active = '';
let networkAllowed = false;
let storageError = false;
const listeners = new Set<() => void>();
const running = new Map<string, Promise<void>>();
const uploading = new Map<string, Promise<QueuedLog>>();
const removing = new Set<string>();
const scope = (user: string, household: string) => `${user}:${household}`;
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };
const notify = () => { version++; listeners.forEach(fn => fn()); };
const snapshot = () => version;
function write(item: QueuedLog) { if (writeQueueItem(localStorage, item)) notify(); }

async function send(entry: QueuedLog) {
  const { data, error } = await supabase.rpc('log_expense', { p_household_id: entry.householdId,
    p_user_id: entry.userId, p_client_id: entry.id, p_values: entry.values });
  if (error) throw error;
  return logResult.parse(data);
}
async function attachmentRemoved(entry: QueuedLog) {
  const request = await supabase.from('quick_log_requests').select('result').eq('id', entry.id)
    .eq('owner_id', entry.userId).eq('household_id', entry.householdId).maybeSingle();
  if (request.error) return false;
  return request.data && logResult.parse(request.data.result).receiptPath === null;
}
async function attach(entry: QueuedLog, path: string) {
  try {
    const params = { p_household_id: entry.householdId, p_user_id: entry.userId, p_id: entry.id };
    const first = await supabase.rpc('finish_expense_receipt', params);
    if (first.error && first.error.message !== 'Receipt upload pending') throw first.error;
    if (first.error) {
      const bytes = await readReceipt(entry.userId, entry.householdId, entry.id);
      if (active !== scope(entry.userId, entry.householdId) || removing.has(entry.id)) throw new Error('Account or attachment changed');
      const upload = await supabase.storage.from('expense-receipts').upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
      if (upload.error && String(upload.error.statusCode) !== '409' && upload.error.message !== 'The resource already exists') throw upload.error;
      const finished = await supabase.rpc('finish_expense_receipt', params);
      if (finished.error) throw finished.error;
    }
    await deleteReceipt(entry.userId, entry.householdId, entry.id).catch(() => undefined);
  } catch (error) {
    // Another device may have removed a ready photo while this device lost its
    // upload acknowledgement. A verified cancellation is terminal, not a retry.
    if (!await attachmentRemoved(entry)) throw error;
    await deleteReceipt(entry.userId, entry.householdId, entry.id).catch(() => undefined);
    return { cancelled: true };
  }
}
export async function removeReceipt(userId: string, householdId: string, id: string, path: string) {
  if (active !== scope(userId, householdId)) throw new Error('Not signed in');
  removing.add(id);
  try {
    // Let an in-flight attachment settle before deletion. Its stale catch cannot
    // subsequently overwrite the terminal local acknowledgement below.
    await uploading.get(id);
    const deleted = await supabase.storage.from('expense-receipts').remove([path]);
    if (deleted.error) throw deleted.error;
    const removed = await supabase.rpc('remove_expense_receipt', { p_household_id: householdId, p_user_id: userId, p_id: id });
    if (removed.error) throw removed.error;
    const entry = readQueue(localStorage, userId, householdId).find(item => item.id === id);
    if (entry) {
      const request = await supabase.from('quick_log_requests').select('result').eq('id', id)
        .eq('owner_id', userId).eq('household_id', householdId).single();
      if (request.error) throw request.error;
      write({ ...entry, status: 'synced', reason: null, result: logResult.parse(request.data.result) });
    }
    await deleteReceipt(userId, householdId, id).catch(() => undefined);
  } finally { removing.delete(id); }
}

export function syncQueue(userId: string, householdId: string, retryBlocked = false): Promise<void> {
  const key = scope(userId, householdId);
  const existing = running.get(key);
  if (existing) return existing;
  const current = () => active === key && networkAllowed;
  const job = (async () => {
    if (!current() || (Platform.OS === 'web' && typeof navigator !== 'undefined' && !navigator.onLine)) return;
    for (const entry of readQueue(localStorage, userId, householdId)) {
      if (!current()) return;
      if (entry.status === 'synced' || removing.has(entry.id) || (!retryBlocked && entry.status === 'blocked')) continue;
      const attempt = syncEntry(entry, { current, send, write, attach: async (item, result) => {
        if (result.receiptPath) return attach(item, result.receiptPath);
        await deleteReceipt(item.userId, item.householdId, item.id).catch(() => undefined);
        return { cancelled: true };
      } });
      uploading.set(entry.id, attempt);
      try { await attempt; } finally { uploading.delete(entry.id); }
    }
    if (storageError) { storageError = false; notify(); }
  })().catch(() => { if (!storageError) { storageError = true; notify(); } });
  running.set(key, job);
  void job.finally(() => running.delete(key));
  return job;
}

export function useQuickLogSync(householdId?: string) {
  const { session, accountId } = useSession(); const userId = accountId; const client = useQueryClient();
  const tick = useSyncExternalStore(subscribe, snapshot, snapshot);
  useEffect(() => {
    const key = userId && householdId ? scope(userId, householdId) : '';
    active = key;
    networkAllowed = !!session;
    if (!userId || !householdId) return;
    try {
      const saved = readQueue(localStorage, userId, householdId).filter(entry => entry.status === 'synced');
      const expired = saved.filter((entry, index) => entry.createdAt < Date.now() - 86_400_000 || index < saved.length - 50);
      for (const entry of expired) {
        deleteQueueItem(localStorage, entry);
        void deleteReceipt(userId, householdId, entry.id).catch(() => undefined);
      }
      if (expired.length) notify();
    } catch { storageError = true; }
    const refresh = () => { void syncQueue(userId, householdId); };
    refresh();
    const timer = setInterval(refresh, 15_000);
    const state = AppState.addEventListener('change', value => { if (value === 'active') refresh(); });
    if (Platform.OS === 'web') { window.addEventListener('online', refresh); window.addEventListener('storage', notify); }
    return () => {
      if (active === key) active = '';
      clearInterval(timer); state.remove();
      if (Platform.OS === 'web') { window.removeEventListener('online', refresh); window.removeEventListener('storage', notify); }
    };
  }, [userId, householdId, session]);
  useEffect(() => {
    if (!userId || !householdId) return;
    void syncQueue(userId, householdId);
    for (const prefix of ['expenses', 'payments', 'payment-history', 'cashflow', 'dashboard', 'receipt', 'allowance-balances', 'transactions'])
      void client.invalidateQueries({ queryKey: [prefix, householdId] });
  }, [tick, userId, householdId, client]);
}
export function useQuickLogQueue(householdId: string) {
  const { accountId } = useSession(); const userId = accountId;
  useSyncExternalStore(subscribe, snapshot, snapshot);
  const state = (() => {
    try { return { entries: userId ? readQueue(localStorage, userId, householdId) : [], error: storageError }; }
    catch { return { entries: [], error: true }; }
  })();
  return { ...state,
    enqueue: (id: string, value: QuickLogInput) => {
      if (!userId) throw new Error('Not signed in');
      const previous = readQueue(localStorage, userId, householdId).find(entry => entry.id === id);
      if (previous && previous.status !== 'blocked') throw new Error('Queued expense changed');
      if (!previous && state.entries.filter(e => e.status !== 'synced').length >= 100) throw new Error('Expense queue full');
      write({ id, userId, householdId, values: quickLogInput.parse(value), createdAt: previous?.createdAt ?? Date.now(), status: 'pending', reason: null, result: null });
    },
    retry: () => userId ? syncQueue(userId, householdId, true) : Promise.resolve(),
    discard: async (entry: QueuedLog) => {
      if (entry.userId !== userId || entry.householdId !== householdId || entry.status !== 'blocked' || entry.result) return;
      deleteQueueItem(localStorage, entry); notify();
      await deleteReceipt(entry.userId, entry.householdId, entry.id).catch(() => undefined);
    },
  };
}
