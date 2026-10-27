import { z } from 'zod';
import { findGuide } from './registry';

export const progressRow = z.object({
  guide_id: z.string(), guide_version: z.number().int(), step_id: z.string(),
  status: z.enum(['in_progress', 'paused', 'dismissed', 'completed']),
  revision: z.number().int().nonnegative(), request_id: z.uuid(),
}).refine(row => {
  const guide = findGuide(row.guide_id);
  return guide?.version === row.guide_version && guide.steps.some(step => step.id === row.step_id);
});
export type Progress = z.infer<typeof progressRow>;
export type LocalProgress = Progress & { pending: boolean };
export type ProgressMap = Record<string, LocalProgress>;
const stored = z.array(progressRow.and(z.object({ pending: z.boolean() })));
export const storageKey = (userId: string) => `guides:v1:${process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'local'}:${userId}`;
export function readProgress(store: Pick<Storage, 'getItem'>, userId: string): ProgressMap {
  const raw = store.getItem(storageKey(userId));
  if (!raw) return {};
  return Object.fromEntries(stored.parse(JSON.parse(raw)).map(row => [row.guide_id, row]));
}
export function writeProgress(store: Pick<Storage, 'setItem'>, userId: string, rows: ProgressMap) {
  store.setItem(storageKey(userId), JSON.stringify(stored.parse(Object.values(rows))));
}

/** Newer remote revisions win conflicts. A lost acknowledgement keeps the newer local edit. */
export function mergeRemote(local: ProgressMap, remote: Progress[]): ProgressMap {
  const result = { ...local };
  for (const row of remote) {
    const draft = result[row.guide_id];
    if (!draft || (!draft.pending && row.revision >= draft.revision) ||
      (draft.pending && row.revision > draft.revision && row.request_id !== draft.request_id)) {
      result[row.guide_id] = { ...row, pending: false };
    } else if (draft.request_id === row.request_id) {
      result[row.guide_id] = { ...row, pending: false };
    }
  }
  return result;
}

/** An edit made during an in-flight write inherits its acknowledgement's new revision. */
export function acknowledge(local: ProgressMap, sent: LocalProgress, saved: Progress): ProgressMap {
  const latest = local[sent.guide_id];
  if (!latest) return local;
  return { ...local, [sent.guide_id]: latest.request_id === sent.request_id
    ? { ...saved, pending: false } : { ...latest, revision: saved.revision } };
}
