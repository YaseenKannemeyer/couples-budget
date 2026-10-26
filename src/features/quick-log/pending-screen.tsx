import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { useMyHousehold } from '@/features/household/api';
import { useFormatters } from '@/hooks/use-formatters';
import { SpaceContext } from '@/hooks/use-theme';
import { errorTranslationKey } from '@/i18n/errors';
import { useQuickLogQueue } from './queue';
import { pickReceipt } from './receipt-picker';
import { saveReceipt } from './receipt-files';
import type { QueuedLog } from './schema';

export function PendingLogsScreen() {
  const household = useMyHousehold();
  if (!household.data) return null;
  return <PendingLogs householdId={household.data.household.id} currency={household.data.household.baseCurrency} />;
}
export function PendingLogs({ householdId, currency }: { householdId: string; currency: string }) {
  const { t } = useTranslation(); const queue = useQuickLogQueue(householdId); const format = useFormatters();
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>(null);
  const pending = queue.entries.filter(entry => entry.status !== 'synced');
  async function retry() {
    setBusy(true); setError(null);
    try { await queue.retry(); } catch (err) { setError(err); } finally { setBusy(false); }
  }
  async function replacePhoto(entry: QueuedLog) {
    setBusy(true); setError(null);
    try {
      const picked = await pickReceipt();
      if (picked) { await saveReceipt(entry.userId, householdId, entry.id, picked.uri); await queue.retry(); }
    } catch (err) { setError(err); } finally { setBusy(false); }
  }
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('quickLog.queue')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('quickLog.queueHint')}</ThemedText>
    {queue.error && <ThemedText accessibilityRole="alert" themeColor="attention">{t('quickLog.storageError')}</ThemedText>}
    {!queue.error && !pending.length && <ThemedText>{t('quickLog.queueEmpty')}</ThemedText>}
    {pending.map(entry => <SpaceContext key={entry.id} value={entry.values.visibility}><Card>
      <ThemedText type="smallBold">{entry.values.description}</ThemedText>
      <ThemedText>{format.money(entry.values.amountMinor, currency)} · {t(`payments.${entry.values.visibility}`)}</ThemedText>
      <ThemedText themeColor="textSecondary">{t(`quickLog.status.${entry.status}`)}</ThemedText>
      <ThemedText type="small">{t(entry.result ? 'quickLog.receiptPendingHint' : entry.status === 'blocked' ? 'quickLog.reviewHint' : 'quickLog.queuedHint')}</ThemedText>
      {entry.status === 'blocked' && !entry.result && <>
        <Button title={t('quickLog.editQueued')} variant="secondary" disabled={busy} onPress={() => router.push({ pathname: '/quick-log', params: { edit: entry.id } })} />
        <Button title={t('quickLog.discard')} variant="ghost" disabled={busy} onPress={async () => {
          try { await queue.discard(entry); } catch (err) { setError(err); }
        }} />
      </>}
      {entry.status === 'receipt_pending' && <Button title={t('quickLog.replacePhoto')} variant="secondary" disabled={busy} onPress={() => replacePhoto(entry)} />}
    </Card></SpaceContext>)}
    {error != null && <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(error))}</ThemedText>}
    <Button title={t('quickLog.retry')} accessibilityLabel={t('quickLog.retry')} loading={busy} onPress={retry} />
    <Button title={t('quickLog.launch')} variant="secondary" onPress={() => router.push('/quick-log')} />
    <Button title={t('quickLog.done')} variant="ghost" onPress={() => router.back()} />
  </Screen>;
}
