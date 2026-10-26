import { reminderInstant, shiftCalendarDays } from './dates';
import type { Schedule } from './schema';

export type Reminder = { identifier: string; at: number };
export type ReminderCopy = { title: string; body: string; channel: string; language: string };
export const REMINDER_PREFIX = 'co-pilot-payment:';

/** No private names, amounts, notes or category data enter a notification payload. */
export function buildReminderPlan(schedules: Schedule[], userId: string, timeZone: string, language: string, now = Date.now()): Reminder[] {
  return schedules.filter((schedule) => schedule.status === 'active' && schedule.payerId === userId &&
    (schedule.visibility === 'shared' || schedule.ownerId === userId) && schedule.reminderDaysBefore !== null)
    .map((schedule) => {
      const at = reminderInstant(shiftCalendarDays(schedule.dueStart, -schedule.reminderDaysBefore!), timeZone);
      return { at, identifier: `${REMINDER_PREFIX}${userId}:${schedule.id}:${schedule.version}:${at}:${language}` };
    }).filter((reminder) => reminder.at > now).sort((a, b) => a.at - b.at).slice(0, 50);
}
