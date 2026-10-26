import * as Notifications from 'expo-notifications';

import { reconcileDeviceReminders } from '@/features/payments/device-reminders.native';
import { REMINDER_PREFIX } from '@/features/payments/reminder-plan';

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(async () => ({ granted: true })),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  cancelScheduledNotificationAsync: jest.fn(async () => {}),
  setNotificationChannelAsync: jest.fn(async () => {}),
  scheduleNotificationAsync: jest.fn(async () => 'id'),
  AndroidImportance: { DEFAULT: 5 }, IosAuthorizationStatus: { PROVISIONAL: 3 }, SchedulableTriggerInputTypes: { DATE: 'date' },
}));

const copy = { title: 'Payment reminder', body: 'Open the app to check your payment.', channel: 'Payments', language: 'en' };
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: true } as Notifications.NotificationPermissionsStatus);
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([]);
});

it('removes only managed stale reminders and schedules generic content without private details', async () => {
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
    { identifier: `${REMINDER_PREFIX}old-account:old-cycle` }, { identifier: 'unrelated-notification' },
  ] as Notifications.NotificationRequest[]);
  const identifier = `${REMINDER_PREFIX}new-account:new-cycle`;
  await reconcileDeviceReminders([{ identifier, at: 1800000000000 }], copy);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(`${REMINDER_PREFIX}old-account:old-cycle`);
  expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith({ identifier,
    content: { title: copy.title, body: copy.body, data: { kind: 'payment-reminder' } },
    trigger: { type: 'date', date: 1800000000000, channelId: 'payments' },
  });
});

it('cancels pending reminders on disable/sign-out and after OS permission is revoked', async () => {
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([
    { identifier: `${REMINDER_PREFIX}account:cycle` },
  ] as Notifications.NotificationRequest[]);
  await reconcileDeviceReminders([], copy);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  jest.mocked(Notifications.getPermissionsAsync).mockResolvedValue({ granted: false } as Notifications.NotificationPermissionsStatus);
  await reconcileDeviceReminders([{ identifier: `${REMINDER_PREFIX}account:next`, at: 1800000000000 }], copy);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(2);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('deduplicates an unchanged reminder on repeated app refreshes', async () => {
  const identifier = `${REMINDER_PREFIX}account:cycle`;
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockResolvedValue([{ identifier }] as Notifications.NotificationRequest[]);
  await reconcileDeviceReminders([{ identifier, at: 1800000000000 }], copy);
  expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  expect(Notifications.cancelScheduledNotificationAsync).not.toHaveBeenCalled();
});

it('serializes sign-out behind an in-flight update so stale async work cannot restore reminders', async () => {
  const scheduled = new Map<string, Notifications.NotificationRequest>();
  const identifier = `${REMINDER_PREFIX}account:cycle`;
  let release!: (value: Notifications.NotificationPermissionsStatus) => void;
  let signalStarted!: () => void;
  const started = new Promise<void>((resolve) => { signalStarted = resolve; });
  jest.mocked(Notifications.getPermissionsAsync).mockImplementationOnce(() => {
    signalStarted();
    return new Promise((resolve) => { release = resolve; });
  });
  jest.mocked(Notifications.getAllScheduledNotificationsAsync).mockImplementation(async () => [...scheduled.values()]);
  jest.mocked(Notifications.scheduleNotificationAsync).mockImplementation(async (request) => {
    scheduled.set(request.identifier!, request as unknown as Notifications.NotificationRequest);
    return request.identifier!;
  });
  jest.mocked(Notifications.cancelScheduledNotificationAsync).mockImplementation(async (id) => { scheduled.delete(id); });
  const pending = reconcileDeviceReminders([{ identifier, at: 1800000000000 }], copy);
  await started;
  const signedOut = reconcileDeviceReminders([], copy);
  release({ granted: true } as Notifications.NotificationPermissionsStatus);
  await Promise.all([pending, signedOut]);
  expect(scheduled.size).toBe(0);
  expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith(identifier);
});
