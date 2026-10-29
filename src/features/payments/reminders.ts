import { useEffect } from 'react';
import type { Household } from '@/features/household/schema';
import { deviceRemindersAvailable, reconcileDeviceReminders } from './device-reminders';
/** Cancel the previous local scheduler when the upgraded app starts. */
export function usePaymentReminderSync(_household: Household | undefined) {
 useEffect(() => {
  if (!deviceRemindersAvailable) return;
  void reconcileDeviceReminders([], { title: '', body: '', channel: 'Payments', language: 'en' }).catch(() => {});
 }, []);
}
