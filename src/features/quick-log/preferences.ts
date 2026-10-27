import { z } from 'zod';
const preference = z.object({ lastSpace: z.enum(['shared', 'private']).optional(), shared: z.string().optional(), private: z.string().optional() });
type Preference = z.infer<typeof preference>;
const key = (user: string, household: string) => `log-preferences:v1:${process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'local'}:${user}:${household}`;
export function readLogPreference(store: Pick<Storage, 'getItem'>, user: string, household: string): Preference {
  try { const result = preference.safeParse(JSON.parse(store.getItem(key(user, household)) ?? '{}')); return result.success ? result.data : {}; }
  catch { return {}; }
}
export function rememberLogChoice(store: Pick<Storage, 'getItem' | 'setItem'>, user: string, household: string, space: 'shared' | 'private', category: string) {
  try { store.setItem(key(user, household), JSON.stringify({ ...readLogPreference(store, user, household), lastSpace: space, [space]: category })); }
  catch { /* Optional defaults must never turn a durably saved expense into an error. */ }
}
export function preferredCategory(saved: string | undefined, eligible: { id: string }[]) {
  return eligible.some(category => category.id === saved) ? saved! : eligible[0]?.id ?? '';
}
