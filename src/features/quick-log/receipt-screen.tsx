import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, router, useLocalSearchParams, type Href } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useMyHousehold } from '@/features/household/api';
import { useSession } from '@/hooks/use-session';
import { SpaceContext } from '@/hooks/use-theme';
import { errorTranslationKey } from '@/i18n/errors';
import { supabase } from '@/lib/supabase';
import { removeReceipt } from './queue';

const receiptRow = z.object({ id: z.uuid(), owner_id: z.uuid(), object_path: z.string(), ready: z.boolean() });
export function ReceiptScreen() {
  const { transactionId, visibility } = useLocalSearchParams<{ transactionId?: string; visibility?: string }>();
  const space = visibility === 'private' ? 'private' : 'shared'; const household = useMyHousehold();
  const { session } = useSession(); const userId = session?.user.id; const householdId = household.data?.household.id;
  const client = useQueryClient(); const { t } = useTranslation();
  const query = useQuery({ queryKey: ['receipt', householdId, userId, space, transactionId], enabled: !!householdId && !!userId && !!transactionId,
    refetchInterval: 45_000,
    queryFn: async () => {
      const { data, error } = await supabase.from('expense_receipts').select('id,owner_id,object_path,ready')
        .eq('household_id', householdId!).eq('visibility', space)
        .eq(space === 'shared' ? 'shared_transaction_id' : 'private_transaction_id', transactionId!).maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = receiptRow.parse(data);
      if (!row.ready) return { ...row, url: null };
      const signed = await supabase.storage.from('expense-receipts').createSignedUrl(row.object_path, 60);
      if (signed.error) throw signed.error;
      return { ...row, url: signed.data.signedUrl };
    },
  });
  const remove = useMutation({ mutationFn: async () => {
    if (!query.data || query.data.owner_id !== userId) return;
    await removeReceipt(userId!, householdId!, query.data.id, query.data.object_path);
  }, onSuccess: () => client.invalidateQueries({ queryKey: ['receipt', householdId, userId] }) });
  return <SpaceContext value={space}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('quickLog.photo')}</ThemedText>
    {query.isPending && <ThemedText>{t('payments.loading')}</ThemedText>}
    {query.isError && <><ThemedText themeColor="attention">{t('quickLog.receiptError')}</ThemedText><Button title={t('common.tryAgain')} onPress={() => query.refetch()} /></>}
    {query.data === null && <ThemedText>{t('quickLog.noReceipt')}</ThemedText>}
    {query.data && !query.data.ready && <><ThemedText>{t('quickLog.receiptPendingHint')}</ThemedText>
      <Button title={t('quickLog.queue')} onPress={() => router.push('/pending-logs')} /></>}
    {query.data?.url && <>
      <Image source={{ uri: query.data.url }} cachePolicy="none" contentFit="contain" style={{ width: '100%', height: 480 }} accessibilityLabel={t('quickLog.photo')} />
      <Link href={query.data.url as Href} target="_blank" rel="noopener noreferrer" asChild><Button title={t('quickLog.openPhoto')} variant="secondary" /></Link>
    </>}
    {query.data?.owner_id === userId && <Button title={t('quickLog.removePhoto')} accessibilityLabel={t('quickLog.removePhoto')} variant="secondary" loading={remove.isPending} onPress={() => remove.mutate()} />}
    {remove.error && <ThemedText themeColor="attention">{t(errorTranslationKey(remove.error))}</ThemedText>}
    <Button title={t('quickLog.done')} variant="ghost" onPress={() => router.back()} />
  </Screen></SpaceContext>;
}
