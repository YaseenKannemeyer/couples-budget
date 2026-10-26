import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { SpaceContext } from '@/hooks/use-theme';
import { useSession } from '@/hooks/use-session';
import { useQuickLogQueue } from './queue';

export function QuickLogLauncher({ householdId }: { householdId: string }) {
  const { t } = useTranslation(); const path = usePathname(); const insets = useSafeAreaInsets();
  const { isOffline } = useSession();
  const queue = useQuickLogQueue(householdId);
  if (path === '/quick-log' || path === '/pending-logs') return null;
  const count = queue.entries.filter(entry => entry.status !== 'synced').length;
  const tab = ['/', '/settings', '/shared-budget', '/private-space'].includes(path);
  return <SpaceContext value={path === '/private-space' ? 'private' : 'shared'}><View style={{ position: 'absolute', right: Spacing.three, bottom: insets.bottom + Spacing.three + (tab ? BottomTabInset : 0) }}>
    <Button title={t(count ? 'quickLog.launchPending' : isOffline ? 'quickLog.offlineLaunch' : 'quickLog.launch', { count })}
      onPress={() => router.push('/quick-log')} />
  </View></SpaceContext>;
}
