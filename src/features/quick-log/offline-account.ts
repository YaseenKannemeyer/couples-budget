import { z } from 'zod';
const key = `offline-account:v1:${process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'unconfigured'}`;
export function rememberAccount(userId: string | null) {
  try { if (userId) localStorage.setItem(key, z.uuid().parse(userId)); else localStorage.removeItem(key); } catch { /* Device storage unavailable. */ }
}
export function offlineAccountFor(error: unknown): string | null {
  // This is a local drafting identity, never a fabricated Supabase session.
  // Explicit authentication rejection and sign-out must not unlock offline data.
  if (!error || typeof error !== 'object' || !('name' in error) ||
    !['AuthRetryableFetchError', 'TypeError'].includes(String(error.name))) return null;
  try { const value = z.uuid().safeParse(localStorage.getItem(key)); return value.success ? value.data : null; }
  catch { return null; }
}
