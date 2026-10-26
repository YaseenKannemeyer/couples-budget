import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useMyHousehold } from '@/features/household/api';
import { useSession } from '@/hooks/use-session';
export default function OfflineScreen() {
  const { t } = useTranslation(); const household = useMyHousehold(); const { refresh } = useSession();
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('quickLog.offlineTitle')}</ThemedText>
    <ThemedText>{t('quickLog.offlineHint')}</ThemedText>
    {household.data ? <>
      <Button title={t('quickLog.launch')} onPress={() => router.push('/quick-log')} />
      <Button title={t('quickLog.queue')} variant="secondary" onPress={() => router.push('/pending-logs')} />
    </> : <ThemedText themeColor="attention">{t('quickLog.noOfflineCatalogue')}</ThemedText>}
    <Button title={t('quickLog.reconnect')} variant="secondary" onPress={refresh} />
  </Screen>;
}
