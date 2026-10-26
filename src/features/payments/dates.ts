import { useEffect, useState } from 'react';

/** Date-only strings are household calendar dates, never device-midnight instants. */
export function householdToday(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find((value) => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function formatCalendarDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', dateStyle: 'medium' }).format(new Date(`${value}T12:00:00Z`));
}

export function shiftCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function dueState(dueStart: string, dueEnd: string, today: string): 'overdue' | 'dueNow' | 'dueSoon' | 'upcoming' {
  if (dueEnd < today) return 'overdue';
  if (dueStart <= today) return 'dueNow';
  if (dueStart <= shiftCalendarDays(today, 3)) return 'dueSoon';
  return 'upcoming';
}

/** Nine in the household's timezone, including dates across DST changes. */
export function reminderInstant(day: string, timeZone: string): number {
  const target = new Date(`${day}T09:00:00Z`).getTime();
  let instant = target;
  const format = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  });
  for (let i = 0; i < 3; i++) {
    const parts = format.formatToParts(instant);
    const value = (type: string) => Number(parts.find((part) => part.type === type)!.value);
    const wallClock = Date.UTC(value('year'), value('month') - 1, value('day'), value('hour'), value('minute'), value('second'));
    instant += target - wallClock;
  }
  return instant;
}

export function useHouseholdToday(timeZone: string) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);
  return householdToday(timeZone, now);
}
