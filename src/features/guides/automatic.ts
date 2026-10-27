import type { ProgressMap } from './progress';

/** Only the first-use sequence starts itself. Existing decisions always win. */
export function automaticGuide(rows: ProgressMap, path: string): string | null {
  if (path === '/household' && !rows.welcome) return 'welcome';
  if (path === '/' && !rows['first-visit'] && (!rows.welcome || rows.welcome.status === 'completed')) return 'first-visit';
  if (path === '/quick-log' && !rows['quick-log'] && rows['first-visit']?.status === 'completed') return 'quick-log';
  return null;
}
