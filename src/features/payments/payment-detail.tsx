import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { HeroCard } from '@/components/ui/hero-card';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { useFormatters } from '@/hooks/use-formatters';
import { SpaceContext } from '@/hooks/use-theme';

import { usePaymentAction } from './api';
import { formatCalendarDate } from './dates';
import { dueLabel, PaymentError, PaymentLoading, usePaymentData } from './ui';

export function PaymentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, workspace } = usePaymentData();
  if (!household || !workspace.data || workspace.isError) return <PaymentLoading error={workspace.isError} onRetry={() => workspace.refetch()} />;
  return <PaymentDetail householdId={household.household.id} id={id} context={{ household, workspace }} />;
}

function PaymentDetail({ householdId, id, context }: { householdId: string; id: string; context: ReturnType<typeof usePaymentData> }) {
  const { t } = useTranslation();
  const { household, workspace } = context;
  const action = usePaymentAction(householdId);
  const format = useFormatters(household?.household.timezone);
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const [deleting, setDeleting] = useState<{ id: string; version: number } | null>(null);
  const schedule = workspace.data?.schedules.find((row) => row.id === id);
  if (!schedule || !household) return <Screen>
    <ThemedText>{t('payments.notFound')}</ThemedText>
    <Button title={t('payments.history')} onPress={() => router.replace({ pathname: '/payment-history', params: { id } })} />
    <Button title={t('payments.back')} variant="ghost" onPress={() => router.replace('/payments')} />
  </Screen>;
  const status = (value: 'active' | 'paused' | 'archived') => action.mutate({ kind: 'status', id, version: schedule.version, status: value });
  const category = workspace.data!.categories.find((value) => value.id === schedule.categoryId)?.name;

  async function remove() {
    if (!deleting) return;
    try { await action.mutateAsync({ kind: 'delete', ...deleting }); router.replace('/payments'); }
    catch { /* The mutation retains the error. */ }
  }

  return <SpaceContext value={schedule.visibility === 'private' ? 'private' : 'shared'}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{schedule.name}</ThemedText>
    <ThemedText themeColor="textSecondary">{t(`payments.${schedule.visibility}`)} · {t(`payments.${schedule.recurrence}`)} · {t(`payments.${schedule.status}`)}</ThemedText>
    <ThemedText>{dueLabel(schedule, locale)}</ThemedText>
    {schedule.recurrence === 'monthly' && <ThemedText type="small" themeColor="textSecondary">
      {t('payments.monthlyAnchor', { startDay: format.number(schedule.anchorStartDay), endDay: format.number(schedule.anchorEndDay) })}
    </ThemedText>}
    <HeroCard icon="bill" title={t('payments.title')}
      value={schedule.estimateMinor === null ? t('payments.unknownAmount') : format.money(schedule.estimateMinor, household.household.baseCurrency)}
      subtitle={schedule.estimateMinor === null ? dueLabel(schedule, locale) : t(schedule.expectedAmountMinor === null ? 'payments.estimatedValue' : 'payments.expectedValue', { amount: format.money(schedule.estimateMinor, household.household.baseCurrency) })} />
    <ThemedText themeColor="textSecondary">{category}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('payments.payerDisplay', {
      name: household.members.find((member) => member.userId === schedule.payerId)?.displayName ?? t('common.unknown'),
    })}</ThemedText>
    {schedule.note && <ThemedText>{schedule.note}</ThemedText>}
    {schedule.reminderDaysBefore !== null && <ThemedText type="small">{t(schedule.reminderDaysBefore === 0
      ? 'payments.onDueDate' : 'payments.daysBefore', { count: schedule.reminderDaysBefore })}</ThemedText>}
    {schedule.recentAmounts.length > 0 && <Card>
      <ThemedText type="smallBold">{t('payments.recent')}</ThemedText>
      {schedule.recentAmounts.map((record, index) => <ThemedText key={index}>
        {formatCalendarDate(record.paidOn, locale)} · {format.money(record.amountMinor, household.household.baseCurrency)}
      </ThemedText>)}
    </Card>}
    {schedule.status === 'active' && <Button title={t('payments.markPaid')} disabled={action.isPending}
      onPress={() => router.push({ pathname: '/payment-paid', params: { id } })} />}
    {schedule.status !== 'completed' && <Button title={t('payments.edit')} variant="secondary" disabled={action.isPending}
      onPress={() => router.push({ pathname: '/payment', params: { id } })} />}
    <Button title={t('payments.history')} variant="secondary" disabled={action.isPending}
      onPress={() => router.push({ pathname: '/payment-history', params: { id } })} />
    {schedule.status === 'active' && <Button title={t('payments.pause')} variant="secondary" loading={action.isPending} onPress={() => status('paused')} />}
    {schedule.status === 'paused' && <Button title={t('payments.resume')} variant="secondary" loading={action.isPending} onPress={() => status('active')} />}
    {schedule.status === 'archived' && !(schedule.recurrence === 'one_time' && schedule.recentAmounts.length > 0) &&
      <Button title={t('payments.restore')} variant="secondary" loading={action.isPending} onPress={() => status('active')} />}
    {schedule.status !== 'archived' && <Button title={t('payments.archive')} variant="ghost" disabled={action.isPending} onPress={() => status('archived')} />}
    <PaymentError error={action.error} reload={() => { void workspace.refetch(); setDeleting(null); action.reset(); }} />
    {deleting ? <Card>
      <ThemedText>{t('payments.deleteQuestion')}</ThemedText>
      <Button title={t('payments.confirmDelete')} loading={action.isPending} onPress={remove} />
      <Button title={t('payments.cancel')} variant="ghost" disabled={action.isPending} onPress={() => setDeleting(null)} />
    </Card> : <Button title={t('payments.delete')} variant="ghost" disabled={action.isPending}
      onPress={() => setDeleting({ id, version: schedule.version })} />}
    <Button title={t('payments.back')} variant="ghost" disabled={action.isPending} onPress={() => router.replace('/payments')} />
  </Screen></SpaceContext>;
}
