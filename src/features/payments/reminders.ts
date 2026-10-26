import { useEffect, useSyncExternalStore } from 'react';
import { useTranslation } from 'react-i18next';

import type { Household } from '@/features/household/schema';
import { APP_NAME } from '@/constants/app';
import { useSession } from '@/hooks/use-session';

import { usePaymentWorkspace } from './api';
import { deviceRemindersAvailable, reconcileDeviceReminders, requestReminderPermission } from './device-reminders';
import { buildReminderPlan, type ReminderCopy } from './reminder-plan';

const listeners = new Set<() => void>();
let failed = false;
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
const emit = () => { for (const listener of listeners) listener(); };
const storageKey = (userId: string | undefined) => `co-pilot:payment-reminders:${userId ?? 'signed-out'}`;
const enabledFor = (userId: string | undefined) => {
  try { return !!userId && localStorage.getItem(storageKey(userId)) === 'true'; } catch { return false; }
};

export function useDevicePaymentReminders(userId: string | undefined) {
  const { t, i18n } = useTranslation();
  const enabled = useSyncExternalStore(subscribe, () => enabledFor(userId), () => false);
  const hasError = useSyncExternalStore(subscribe, () => failed, () => false);
  const copy: ReminderCopy = { title: t('payments.reminderTitle'), body: t('payments.reminderBody', { appName: APP_NAME }),
    channel: t('payments.reminderChannel'), language: i18n.resolvedLanguage ?? 'en' };
  async function setEnabled(value: boolean) {
    if (!userId || !deviceRemindersAvailable) return false;
    if (value && !await requestReminderPermission(copy)) return false;
    localStorage.setItem(storageKey(userId), String(value));
    emit();
    return true;
  }
  return { enabled, hasError, setEnabled, available: deviceRemindersAvailable, copy };
}

export function usePaymentReminderSync(household: Household | undefined) {
  const { session } = useSession();
  const userId = session?.user.id;
  const { enabled, copy } = useDevicePaymentReminders(userId);
  const payments = usePaymentWorkspace(deviceRemindersAvailable && enabled ? household?.id : undefined);
  const { title, body, channel, language } = copy;
  const timeZone = household?.timezone ?? 'UTC';
  useEffect(() => {
    if (!deviceRemindersAvailable) return;
    // Don't turn a transient loading failure into lost reminders. Signed-out or
    // disabled accounts always reconcile to an empty plan immediately.
    if (enabled && userId && !payments.data) return;
    const plan = enabled && userId ? buildReminderPlan(payments.data?.schedules ?? [], userId, timeZone, language) : [];
    void reconcileDeviceReminders(plan, { title, body, channel, language }).then(() => {
      if (failed) { failed = false; emit(); }
    }).catch(() => { failed = true; emit(); });
  }, [enabled, userId, payments.data, timeZone, title, body, channel, language]);
}
