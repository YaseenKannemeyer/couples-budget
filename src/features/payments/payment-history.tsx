import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { useMyHousehold } from '@/features/household/api';
import { useFormatters } from '@/hooks/use-formatters';
import { SpaceContext } from '@/hooks/use-theme';

import { usePaymentHistory } from './api';
import { formatCalendarDate } from './dates';
import { dueLabel, PaymentLoading } from './ui';

export function PaymentHistoryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const { data } = useMyHousehold();
  const history = usePaymentHistory(data?.household.id, id);
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const format = useFormatters(data?.household.timezone);
  if (!data || !history.data || history.isError) return <PaymentLoading error={history.isError} onRetry={() => history.refetch()} />;
  const records = [...new Map(history.data.pages.flat().map((record) => [record.id, record])).values()];
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('payments.history')}</ThemedText>
    {!records.length && <ThemedText themeColor="textSecondary">{t('payments.noHistory')}</ThemedText>}
    {records.map((record) => <SpaceContext key={record.id} value={record.visibility === 'private' ? 'private' : 'shared'}><Card>
      <ThemedText type="smallBold">{record.name}</ThemedText>
      <ThemedText>{format.money(record.amountMinor, data.household.baseCurrency)}</ThemedText>
      <ThemedText>{t('payments.paidDateDisplay', { date: formatCalendarDate(record.paidOn, locale) })}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('payments.cycleDisplay', { date: dueLabel(record, locale) })}</ThemedText>
      <ThemedText themeColor="textSecondary">{t(`payments.${record.visibility}`)} · {record.categoryName}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('payments.paidBy', {
        name: data.members.find((member) => member.userId === record.payerId)?.displayName ?? t('common.unknown'),
      })}</ThemedText>
      {record.note && <ThemedText>{record.note}</ThemedText>}
      <ThemedText type="small">{t(record.transactionId ? 'payments.transactionLogged' : 'payments.historyOnly')}</ThemedText>
      {!record.scheduleId && <ThemedText type="small" themeColor="textSecondary">{t('payments.deletedSchedule')}</ThemedText>}
    </Card></SpaceContext>)}
    {history.hasNextPage && <Button variant="secondary" title={t('payments.loadMore')} loading={history.isFetchingNextPage}
      onPress={() => history.fetchNextPage()} />}
    <Button variant="ghost" title={t('payments.back')} onPress={() => router.replace('/payments')} />
  </Screen>;
}
