import { StyleSheet, View } from 'react-native';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { useFormatters } from '@/hooks/use-formatters';
import { SpaceContext, useTheme } from '@/hooks/use-theme';

import { dueState, useHouseholdToday } from './dates';
import { useDevicePaymentReminders } from './reminders';
import type { Schedule } from './schema';
import { Choice, Choices, dueLabel, PaymentLoading, usePaymentData } from './ui';

export function PaymentsScreen() {
  const { visibility: routeVisibility } = useLocalSearchParams<{ visibility?: string }>();
  const [visibility, setVisibility] = useState<'all' | 'shared' | 'private'>(routeVisibility === 'private' || routeVisibility === 'shared' ? routeVisibility : 'all');
  const { t } = useTranslation();
  const theme = useTheme();
  const { household, workspace } = usePaymentData();
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const format = useFormatters(household?.household.timezone);
  const today = useHouseholdToday(household?.household.timezone ?? 'UTC');
  const reminders = useDevicePaymentReminders(household?.me.userId);
  const [reminderBusy, setReminderBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [status, setStatus] = useState<Schedule['status']>('active');
  if (!household || !workspace.data || workspace.isError) return <PaymentLoading error={workspace.isError} onRetry={() => workspace.refetch()} />;
  const schedules = workspace.data.schedules.filter((schedule) => schedule.status === status && (visibility === 'all' || schedule.visibility === visibility) && (schedule.visibility === 'shared' || schedule.ownerId === household.me.userId));

  async function toggleReminders() {
    setReminderBusy(true);
    setDenied(false);
    try { setDenied(!await reminders.setEnabled(!reminders.enabled)); }
    catch { setDenied(true); }
    finally { setReminderBusy(false); }
  }

  return <SpaceContext value={visibility === 'private' ? 'private' : 'shared'}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('payments.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('payments.description')}</ThemedText>
    <GuideSlot target="payments-list" offer="payments" />
    <Button title={t('payments.add')} onPress={() => router.push({ pathname: '/payment', params: { visibility: visibility === 'private' ? 'private' : 'shared' } })} />
    <Button title={t('payments.history')} variant="secondary" onPress={() => router.push('/payment-history')} />
    <Choices label={t('payments.visibility')}>
      {(['all', 'shared', 'private'] as const).map(value => <Choice key={value} label={t(value === 'all' ? 'payments.allSpaces' : `payments.${value}`)} selected={visibility === value} onPress={() => setVisibility(value)} />)}
    </Choices>
    <Choices label={t('payments.title')}>
      {(['active', 'paused', 'archived', 'completed'] as const).map((value) => <Choice key={value}
        label={t(`payments.${value}`)} selected={status === value} onPress={() => setStatus(value)} />)}
    </Choices>
    {!schedules.length && <ThemedText themeColor="textSecondary">{t('payments.empty')}</ThemedText>}
    {schedules.map((schedule) => <SpaceContext key={schedule.id} value={schedule.visibility === 'private' ? 'private' : 'shared'}><View style={{gap:8,paddingVertical:16,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:theme.border}}>
      <ThemedText type="smallBold">{schedule.name}</ThemedText>
      <ThemedText themeColor="textSecondary">{t(`payments.${schedule.visibility}`)} · {t(`payments.${schedule.recurrence}`)}</ThemedText>
      <ThemedText>{dueLabel(schedule, locale)}</ThemedText>
      <ThemedText>{schedule.estimateMinor === null ? t('payments.unknownAmount') :
        t(schedule.expectedAmountMinor === null ? 'payments.estimatedValue' : 'payments.expectedValue', {
          amount: format.money(schedule.estimateMinor, household.household.baseCurrency),
        })}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('payments.payerDisplay', {
        name: household.members.find((member) => member.userId === schedule.payerId)?.displayName ?? t('common.unknown'),
      })}</ThemedText>
      {schedule.status === 'active' && <ThemedText type="smallBold" themeColor={dueState(schedule.dueStart, schedule.dueEnd, today) === 'upcoming' ? 'textSecondary' : 'attention'}>
        {t(`payments.${dueState(schedule.dueStart, schedule.dueEnd, today)}`)}
      </ThemedText>}
      {schedule.recurrence === 'monthly' && (schedule.paidThisMonth || schedule.dueStart.slice(0, 7) <= today.slice(0, 7)) &&
        <ThemedText type="small" themeColor={schedule.paidThisMonth ? 'success' : 'textSecondary'}>
          {t(schedule.paidThisMonth ? 'payments.paidThisMonth' : 'payments.unpaidThisMonth')}
        </ThemedText>}
      <Button title={t('payments.view')} variant="secondary" onPress={() => router.push({ pathname: '/payment-detail', params: { id: schedule.id } })} />
    </View></SpaceContext>)}
    <Card>
      <ThemedText type="smallBold">{t('payments.reminder')}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">{t(reminders.available ? 'payments.reminderDeviceHint' : 'payments.reminderWeb')}</ThemedText>
      {reminders.available && <>
        <Button variant="secondary" title={t(reminders.enabled ? 'payments.disableDeviceReminders' : 'payments.enableDeviceReminders')}
          onPress={toggleReminders} loading={reminderBusy} />
        <ThemedText type="small" themeColor="textSecondary">{t('payments.reminderLocalLimit')}</ThemedText>
      </>}
      {denied && <ThemedText themeColor="attention">{t('payments.reminderDenied')}</ThemedText>}
      {reminders.hasError && <ThemedText themeColor="attention">{t('payments.reminderFailed')}</ThemedText>}
    </Card>
    <Button variant="ghost" title={t('payments.home')} onPress={() => router.replace('/')} />
  </Screen></SpaceContext>;
}
