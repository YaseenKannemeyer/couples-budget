import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';

import { REMINDER_PREFIX, type Reminder, type ReminderCopy } from './reminder-plan';

export const deviceRemindersAvailable = true;
Notifications.setNotificationHandler({ handleNotification: async () => ({
  shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true,
}) });

async function channel(copy: ReminderCopy) {
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('payments', {
    name: copy.channel, importance: AndroidImportance.DEFAULT,
  });
}

export async function requestReminderPermission(copy: ReminderCopy) {
  await channel(copy);
  const permission = await Notifications.requestPermissionsAsync();
  return permission.granted || permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
}

// Serialize reconciliation so an older async render cannot restore a reminder
// after payment, disabling reminders, switching accounts or signing out.
let queue: Promise<void> = Promise.resolve();
export function reconcileDeviceReminders(plan: Reminder[], copy: ReminderCopy): Promise<void> {
  queue = queue.catch(() => {}).then(async () => {
    const permission = await Notifications.getPermissionsAsync();
    const allowed = permission.granted || permission.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    const desired = allowed ? plan : [];
    const existing = await Notifications.getAllScheduledNotificationsAsync();
    const managed = existing.filter((notification) => notification.identifier.startsWith(REMINDER_PREFIX));
    const wanted = new Set(desired.map((reminder) => reminder.identifier));
    for (const notification of managed) {
      if (!wanted.has(notification.identifier)) await Notifications.cancelScheduledNotificationAsync(notification.identifier);
    }
    if (!desired.length) return;
    await channel(copy);
    const present = new Set(managed.map((notification) => notification.identifier));
    for (const reminder of desired) {
      if (present.has(reminder.identifier)) continue;
      await Notifications.scheduleNotificationAsync({
        identifier: reminder.identifier,
        content: { title: copy.title, body: copy.body, data: { kind: 'payment-reminder' } },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: reminder.at, channelId: 'payments' },
      });
    }
  });
  return queue;
}
