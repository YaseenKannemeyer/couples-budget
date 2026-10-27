import { randomUUID } from 'expo-crypto';
import { router, usePathname } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { GuideContext } from './context';
import { acknowledge, mergeRemote, progressRow, readProgress, storageKey, writeProgress, type Progress, type ProgressMap } from './progress';
import { findGuide, type GuideAction } from './registry';
import { automaticGuide } from './automatic';

export function GuidesProvider({ children }: { children: ReactNode }) {
  const { session, offlineUserId } = useSession();
  const userId = session?.user.id ?? offlineUserId ?? undefined;
  // Remount on account changes: no transient render or late response can show another account's progress.
  return <PersonalGuides key={userId ?? 'signed-out'} userId={userId} authenticated={!!session}>{children}</PersonalGuides>;
}
function PersonalGuides({ userId, authenticated, children }: { userId?: string; authenticated: boolean; children: ReactNode }) {
  const path = usePathname();
  const rows = useRef<ProgressMap>({});
  const [rendered, setRendered] = useState<ProgressMap>({});
  const [ready, setReady] = useState(false);
  const [autoReady, setAutoReady] = useState(false);
  const [targetGeneration, setTargetGeneration] = useState(0);
  const attemptedAuto = useRef(new Set<string>());
  const [active, setActive] = useState<string | null>(null);
  const activeRef = useRef(active);
  const pathRef = useRef(path);
  useEffect(() => { activeRef.current = active; pathRef.current = path; }, [active, path]);
  const [localError, setLocalError] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const targets = useRef(new Map<string, number>());
  const syncRef = useRef<() => void>(() => {});
  const publish = useCallback((next: ProgressMap) => {
    rows.current = next; setRendered(next);
    if (!userId) return;
    try { writeProgress(localStorage, userId, next); setLocalError(false); }
    catch { setLocalError(true); }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let disposed = false, syncing = false, again = false;
    try {
      const hasCache = localStorage.getItem(storageKey(userId)) !== null;
      rows.current = readProgress(localStorage, userId); setRendered(rows.current); setReady(hasCache);
    } catch { setLocalError(true); }
    async function sync() {
      if (disposed || !authenticated) return;
      if (syncing) { again = true; return; }
      syncing = true;
      try {
        const result = await supabase.from('guide_progress').select('guide_id,guide_version,step_id,status,revision,request_id')
          .eq('user_id', userId!).eq('guide_version', 1);
        if (disposed) return;
        if (result.error) throw result.error;
        const remote = (result.data ?? []).flatMap(row => { const parsed = progressRow.safeParse(row); return parsed.success ? [parsed.data] : []; });
        publish(mergeRemote(rows.current, remote)); setReady(true); setAutoReady(true);
        for (const id of Object.keys(rows.current)) {
          if (disposed) return;
          const sent = rows.current[id];
          if (!sent.pending) continue;
          const saved = await supabase.rpc('save_guide_progress', {
            p_guide_id: sent.guide_id, p_guide_version: sent.guide_version, p_step_id: sent.step_id,
            p_status: sent.status, p_revision: sent.revision, p_request_id: sent.request_id,
          });
          if (disposed) return;
          if (saved.error) throw saved.error;
          publish(acknowledge(rows.current, sent, progressRow.parse(saved.data)));
        }
        setSyncError(false);
      } catch { if (!disposed) setSyncError(true); }
      finally {
        syncing = false;
        if (again && !disposed) { again = false; void sync(); }
      }
    }
    syncRef.current = () => { void sync(); };
    void sync();
    const timer = setInterval(() => { if (AppState.currentState === 'active') void sync(); }, 30_000);
    const state = AppState.addEventListener('change', value => {
      if (value === 'active') void sync();
      else setActive(null);
    });
    // Browser reconnect/focus also recovers progress without reopening the app.
    const refresh = () => { void sync(); };
    globalThis.addEventListener?.('online', refresh);
    globalThis.addEventListener?.('focus', refresh);
    return () => {
      disposed = true; syncRef.current = () => {}; clearInterval(timer); state.remove();
      globalThis.removeEventListener?.('online', refresh); globalThis.removeEventListener?.('focus', refresh);
    };
  }, [userId, authenticated, publish]);

  const update = useCallback((id: string, index: number, status: Progress['status']) => {
    const guide = findGuide(id); if (!guide || !userId) return;
    const previous = rows.current[id];
    publish({ ...rows.current, [id]: { guide_id: id, guide_version: guide.version,
      step_id: guide.steps[index].id, status, revision: previous?.revision ?? 0, request_id: randomUUID(), pending: true } });
    syncRef.current();
  }, [userId, publish]);
  const start = (id: string, replay = false) => {
    const guide = findGuide(id); if (!guide || !userId) return;
    const row = rows.current[id];
    const index = replay || !row || ['completed', 'dismissed'].includes(row.status) ? 0 : Math.max(0, guide.steps.findIndex(step => step.id === row.step_id));
    update(id, index, 'in_progress'); setActive(id);
    if (!guide.steps[index].paths.includes(path)) router.push(guide.steps[index].route);
  };
  const close = (status: Progress['status'] = 'paused') => {
    const id = activeRef.current; if (!id) return;
    const guide = findGuide(id)!;
    update(id, Math.max(0, guide.steps.findIndex(step => step.id === rows.current[id]?.step_id)), status);
    setActive(null);
  };
  const move = (direction: -1 | 1, action?: GuideAction) => {
    const id = activeRef.current; if (!id) return;
    const guide = findGuide(id)!; const row = rows.current[id];
    const index = guide.steps.findIndex(step => step.id === row?.step_id);
    if (index < 0 || (direction === 1 && guide.steps[index].action && guide.steps[index].action !== action)) return;
    if (action && (!guide.steps[index].paths.includes(pathRef.current) || guide.steps[index].action !== action)) return;
    if (index + direction >= guide.steps.length) { close('completed'); return; }
    const next = Math.max(0, index + direction);
    update(id, next, 'in_progress');
    if (!guide.steps[next].paths.includes(pathRef.current)) router.push(guide.steps[next].route);
  };

  useEffect(() => {
    if (!active) return;
    const guide = findGuide(active)!;
    const step = guide.steps.find(step => step.id === rendered[active]?.step_id);
    // Navigation away, failed loading or a missing control pauses cleanly. Progress stays resumable.
    const timer = setTimeout(() => {
      if (['completed', 'dismissed'].includes(rendered[active]?.status) ||
        !step?.paths.includes(path) || (!targets.current.has(step.target) &&
          (!step.preparation || !targets.current.has(step.preparation.target)))) setActive(null);
    }, 1500);
    return () => clearTimeout(timer);
  }, [active, path, rendered]);
  const register = useCallback((target: string) => {
    targets.current.set(target, (targets.current.get(target) ?? 0) + 1);
    setTargetGeneration(value => value + 1);
    return () => { const count = (targets.current.get(target) ?? 1) - 1; if (count) targets.current.set(target, count); else targets.current.delete(target); };
  }, []);

  useEffect(() => {
    if (!authenticated || !autoReady || active) return;
    const id = automaticGuide(rendered, path);
    const guide = id ? findGuide(id) : undefined;
    if (!guide || attemptedAuto.current.has(guide.id) || !targets.current.has(guide.steps[0].target)) return;
    attemptedAuto.current.add(guide.id);
    update(guide.id, 0, 'in_progress');
    setActive(guide.id);
  }, [authenticated, autoReady, active, rendered, path, targetGeneration, update]);

  return <GuideContext value={{ rows: rendered, ready, active, path, localError, syncError, start, close,
    dismiss: id => update(id, 0, 'dismissed'), move, signal: action => { if (action === 'household-connected' && activeRef.current === 'welcome') close('completed'); else move(1, action); }, register,
    retry: () => { publish(rows.current); syncRef.current(); } }}>{children}</GuideContext>;
}
