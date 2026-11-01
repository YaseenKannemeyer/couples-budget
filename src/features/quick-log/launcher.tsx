import { useGuideAction } from '@/features/guides/context';
import { router, usePathname, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/themed-text';
import { Icon, type IconName } from '@/components/ui/icon';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { useSession } from '@/hooks/use-session';
import { useTheme } from '@/hooks/use-theme';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
import { useQuickLogQueue } from './queue';

const tabPaths = ['/', '/plan', '/private-space'];
const Fab = 56;
const spring = { damping: 16, stiffness: 220, reduceMotion: ReduceMotion.System };

type Option = { key: string; label: string; icon: IconName; href: Href };

/** A round + button that expands into the ways to log an expense. */
export function QuickLogLauncher({ householdId }: { householdId: string }) {
  const { t } = useTranslation(); const path = usePathname(); const insets = useSafeAreaInsets();
  const { isOffline } = useSession();
  const guideAction = useGuideAction();
  const queue = useQuickLogQueue(householdId);
  const theme = useTheme(); const reduced = useReducedMotionPreference();
  const { width, fontScale } = useWindowDimensions();
  // Remembering where the menu opened closes it automatically after navigating away.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === path;
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = withSpring(open ? 1 : 0, spring); }, [open, progress]);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${progress.value * 135}deg` }] }));
  const scrimStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  if (path === '/quick-log' || path === '/pending-logs') return null;
  const count = queue.entries.filter(entry => entry.status !== 'synced').length;
  const desktop = Platform.OS === 'web' && width / fontScale >= 900;
  const tab = tabPaths.includes(path) && !desktop;
  const personal = path === '/private-space';
  const shared: Option = { key: 'shared', icon: 'people', href: '/quick-log',
    label: isOffline ? t('quickLog.offlineLaunch') : t('banking.addSharedExpense') };
  const own: Option = { key: 'personal', icon: 'person', href: { pathname: '/quick-log', params: { space: 'private' } },
    label: t('banking.addPersonalExpense') };
  // The option nearest the button matches the space being viewed.
  const options = [...(count ? [{ key: 'pending', icon: 'clock', href: '/pending-logs', label: t('banking.pendingLogs', { count }) } as Option] : []),
    ...(personal ? [shared, own] : [own, shared])];
  const toggle = () => {
    if (Platform.OS !== 'web' && !reduced) void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setOpenOn(open ? null : path);
  };
  const choose = (option: Option) => {
    setOpenOn(null);
    if (option.key !== 'pending') guideAction('log-opened');
    router.push(option.href);
  };
  const bottom = insets.bottom + Spacing.three + (tab ? BottomTabInset : 0);
  return <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
    <Animated.View pointerEvents={open ? 'auto' : 'none'} style={[StyleSheet.absoluteFill, { backgroundColor: theme.scrim }, scrimStyle]}>
      <Pressable accessibilityLabel={t('banking.closeAddMenu')} style={StyleSheet.absoluteFill} onPress={() => setOpenOn(null)} />
    </Animated.View>
    <View pointerEvents="box-none" style={[styles.stack, { bottom, right: Spacing.three + insets.right }]}>
      <View pointerEvents={open ? 'box-none' : 'none'} accessibilityElementsHidden={!open}
        importantForAccessibility={open ? 'auto' : 'no-hide-descendants'} style={styles.options}>
        {options.map((option, index) => <OptionRow key={option.key} option={option} progress={progress}
          order={options.length - index} onPress={() => choose(option)} />)}
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
        accessibilityLabel={open ? t('banking.closeAddMenu') : count ? t('banking.addExpensePending', { count }) : t('banking.addMenu')}
        onPress={toggle} style={({ pressed }) => [styles.fab, { backgroundColor: theme.primary },
          pressed && !reduced && { transform: [{ scale: 0.94 }] }]}>
        <Animated.View style={fabStyle}><Icon name="plus" color={theme.onPrimary} size={26} /></Animated.View>
        {!!count && !open && <View style={[styles.badge, { backgroundColor: theme.attention, borderColor: theme.background }]}>
          <ThemedText type="smallBold" style={[styles.badgeText, { color: theme.onPrimary }]}>{count}</ThemedText>
        </View>}
      </Pressable>
    </View>
  </View>;
}

/** Options fan upwards in turn; `order` 1 is nearest the button. */
function OptionRow({ option, progress, order, onPress }: { option: Option; progress: SharedValue<number>; order: number; onPress: () => void }) {
  const theme = useTheme();
  const style = useAnimatedStyle(() => {
    const local = Math.min(1, Math.max(0, progress.value * 1.4 - (order - 1) * 0.15));
    return { opacity: local, transform: [{ translateY: (1 - local) * (16 + order * 10) }, { scale: 0.9 + 0.1 * local }] };
  });
  return <Animated.View style={style}>
    <Pressable accessibilityRole="button" accessibilityLabel={option.label} onPress={onPress}
      style={({ pressed }) => [styles.option, { backgroundColor: theme.background, opacity: pressed ? 0.8 : 1 }]}>
      <ThemedText type="smallBold" style={{ color: theme.heading }}>{option.label}</ThemedText>
      <View style={[styles.optionIcon, { backgroundColor: theme.accentSoft }]}><Icon name={option.icon} color={theme.accent} size={20} /></View>
    </Pressable>
  </Animated.View>;
}

const styles = StyleSheet.create({
  stack: { position: 'absolute', alignItems: 'flex-end', gap: Spacing.three },
  options: { alignItems: 'flex-end', gap: Spacing.two },
  option: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingLeft: Spacing.three, paddingRight: Spacing.one + Spacing.half,
    paddingVertical: Spacing.one + Spacing.half, borderRadius: 26, boxShadow: '0px 4px 14px #102A4326' },
  optionIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fab: { width: Fab, height: Fab, borderRadius: Fab / 2, alignItems: 'center', justifyContent: 'center', boxShadow: '0px 6px 16px #102A4340' },
  badge: { position: 'absolute', top: -2, right: -2, minWidth: 22, height: 22, borderRadius: 11, paddingHorizontal: 5, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 11, lineHeight: 14 },
});
