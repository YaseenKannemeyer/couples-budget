import { useGuideAction } from '@/features/guides/context';
import { router, usePathname } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Platform, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '@/components/ui/button';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { SpaceContext } from '@/hooks/use-theme';
import { useSession } from '@/hooks/use-session';
import { useQuickLogQueue } from './queue';

export function QuickLogLauncher({ householdId }: { householdId: string }) {
  const { t } = useTranslation(); const path = usePathname(); const insets = useSafeAreaInsets();
  const { isOffline } = useSession();
  const guideAction = useGuideAction();
  const queue = useQuickLogQueue(householdId);
  const { width, fontScale } = useWindowDimensions();
  if (path === '/quick-log' || path === '/pending-logs') return null;
  const count = queue.entries.filter(entry => entry.status !== 'synced').length;
  const tab = ['/', '/settings', '/shared-budget', '/private-space'].includes(path) && !(Platform.OS === 'web' && width / fontScale >= 900);
  return <SpaceContext value={path === '/private-space' ? 'private' : 'shared'}><View style={{ position: 'absolute', right: Spacing.three, maxWidth: '80%', bottom: insets.bottom + Spacing.three + (tab ? BottomTabInset : 0) }}>
    <Button title={t(count ? 'quickLog.launchPending' : isOffline ? 'quickLog.offlineLaunch' : 'quickLog.launch', { count })}
      onPress={() => { guideAction('log-opened'); router.push('/quick-log'); }} />
  </View></SpaceContext>;
}
