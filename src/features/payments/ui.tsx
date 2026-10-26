import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useMyHousehold } from '@/features/household/api';
import { errorTranslationKey } from '@/i18n/errors';

import { usePaymentWorkspace } from './api';
import { formatCalendarDate } from './dates';
import type { Schedule } from './schema';

export { Choice, Choices } from '@/components/ui/choices';

export function usePaymentData() {
  const household = useMyHousehold();
  const workspace = usePaymentWorkspace(household.data?.household.id);
  return { household: household.data, workspace };
}

export function PaymentLoading({ error, onRetry }: { error?: boolean; onRetry?: () => void }) {
  const { t } = useTranslation();
  return <Screen>
    <ThemedText type="subtitle">{t(error ? 'payments.loadError' : 'payments.loading')}</ThemedText>
    {error && <Button title={t('common.tryAgain')} onPress={onRetry} />}
    <Button variant="ghost" title={t('payments.home')} onPress={() => router.replace('/')} />
  </Screen>;
}

export function PaymentError({ error, reload, loading = false }: { error: unknown; reload?: () => void; loading?: boolean }) {
  const { t } = useTranslation();
  if (!error) return null;
  return <View style={styles.group}>
    <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(error))}</ThemedText>
    {reload && <>
      <ThemedText type="small" themeColor="textSecondary">{t('payments.reloadWarning')}</ThemedText>
      <Button variant="secondary" title={t('payments.retry')} onPress={reload} loading={loading} />
    </>}
  </View>;
}

export function dueLabel(schedule: Pick<Schedule, 'dueStart' | 'dueEnd'>, locale: string) {
  const start = formatCalendarDate(schedule.dueStart, locale);
  return schedule.dueStart === schedule.dueEnd ? start : `${start} – ${formatCalendarDate(schedule.dueEnd, locale)}`;
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
});
