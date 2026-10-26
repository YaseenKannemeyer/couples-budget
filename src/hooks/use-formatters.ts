import { useCalendars, useLocales } from 'expo-localization';
import { useMemo } from 'react';

import { createFormatters } from '@/i18n/format';

/** Pass the household timezone for all household dates, rather than the viewer's timezone. */
export function useFormatters(householdTimezone?: string) {
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const calendars = useCalendars();
  const timezone = householdTimezone ?? calendars[0]?.timeZone ?? 'UTC';
  return useMemo(() => createFormatters(locale, timezone), [locale, timezone]);
}
