import type { Reminder, ReminderCopy } from './reminder-plan';

export const deviceRemindersAvailable = false;
export async function requestReminderPermission(_copy: ReminderCopy): Promise<boolean> { return false; }
export async function reconcileDeviceReminders(_plan: Reminder[], _copy: ReminderCopy): Promise<void> {}
