import { Children, useEffect, useState } from 'react';
import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { usePathname } from 'expo-router';
import { Platform, Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, { interpolateColor, ReduceMotion, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';

import { APP_NAME } from '@/constants/app';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { Fonts, MaxContentWidth, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { tabRoutes, useTabSwipe } from './tab-swipe';

/** Mobile tabs float in a pill; a highlight glides behind the active tab. */
const PillHeight = 64;
const PillPadding = 6;
const PillMaxWidth = 340;
const spring = { damping: 20, stiffness: 220, mass: 0.8, reduceMotion: ReduceMotion.System };

/** Shared icons, tab selection and swipe order on every platform. */
export default function AppTabs() {
  const { t } = useTranslation();
  const swipeHandlers = useTabSwipe();
  return (
    <Tabs style={styles.fill}>
      <View {...swipeHandlers} style={[styles.fill, Platform.OS === 'web' && styles.touchSurface]}>
        <TabSlot style={styles.fill} />
      </View>
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="home">{t('navigation.overview')}</TabButton>
          </TabTrigger>
          <TabTrigger name="plan" href="/plan" asChild>
            <TabButton icon="plan">{t('navigation.plan')}</TabButton>
          </TabTrigger>
          <TabTrigger name="private-space" href="/private-space" asChild>
            <TabButton icon="person">{t('navigation.personal')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function useDesktop() {
  const { width, fontScale } = useWindowDimensions();
  return Platform.OS === 'web' && width / fontScale >= 900;
}

// The slot's `ref` is typed as a component ref rather than a view ref, so it isn't
// forwarded; the button doesn't need one.
export function TabButton({ children, isFocused, icon, ref: _ref, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  const desktop = useDesktop();
  const focus = useSharedValue(isFocused ? 1 : 0);
  useEffect(() => { focus.value = withSpring(isFocused ? 1 : 0, spring); }, [focus, isFocused]);
  const resting = useAnimatedStyle(() => ({ opacity: 1 - focus.value }));
  const active = useAnimatedStyle(() => ({ opacity: focus.value }));
  const label = useAnimatedStyle(() => ({ color: interpolateColor(focus.value, [0, 1], [theme.textSecondary, theme.accent]) }));
  const color = isFocused ? theme.accent : theme.textSecondary;
  if (desktop) {
    return (
      <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }}
        style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
        <Icon name={icon} size={24} color={color} />
        <ThemedText type="small" style={{ fontSize: 12, lineHeight: 16, textAlign: 'center', color, fontWeight: isFocused ? '600' : '400' }}>
          {children}
        </ThemedText>
      </Pressable>
    );
  }
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }}
      style={({ pressed }) => [styles.mobileTab, pressed && !isFocused && styles.pressed]}>
      <View style={styles.iconStack}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.centered, resting]}>
          <Icon name={icon} size={22} color={theme.textSecondary} />
        </Animated.View>
        <Animated.View style={[StyleSheet.absoluteFill, styles.centered, active]}>
          <Icon name={icon} size={22} color={theme.accent} />
        </Animated.View>
      </View>
      <Animated.Text numberOfLines={1} maxFontSizeMultiplier={1.3}
        style={[styles.mobileLabel, { fontWeight: isFocused ? '600' : '500' }, label]}>
        {children}
      </Animated.Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const desktop = useDesktop();
  if (desktop) {
    return (
      <View {...props} style={[styles.tabListContainer, styles.desktop, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <View style={[styles.innerContainer, styles.desktopInner]}>
          <ThemedText type="section" style={styles.brandText}>{APP_NAME}</ThemedText>
          {props.children}
        </View>
      </View>
    );
  }
  return <MobileTabList {...props} bottom={insets.bottom || Spacing.three} />;
}

function MobileTabList({ children, style: _style, bottom, ...props }: TabListProps & { bottom: number }) {
  const theme = useTheme();
  const path = usePathname();
  const [rowWidth, setRowWidth] = useState(0);
  const count = Math.max(Children.count(children), 1);
  const found = tabRoutes.findIndex(route => route === path);
  const [index, setIndex] = useState(Math.max(found, 0));
  if (found >= 0 && found !== index) setIndex(found);
  const tabWidth = rowWidth / count;
  const offset = useSharedValue(index * tabWidth);
  const placed = useSharedValue(false);
  useEffect(() => {
    if (!rowWidth) return;
    // Jump into place on first layout, then glide between tabs.
    offset.value = placed.value ? withSpring(index * tabWidth, spring) : index * tabWidth;
    placed.value = true;
  }, [index, offset, placed, rowWidth, tabWidth]);
  const highlight = useAnimatedStyle(() => ({ opacity: placed.value ? 1 : 0, transform: [{ translateX: offset.value }] }));
  return (
    <View {...props} pointerEvents="box-none" style={[styles.tabListContainer, { bottom, paddingHorizontal: Spacing.four }]}>
      <View style={[styles.pill, { backgroundColor: theme.background, borderColor: theme.border }]}>
        <Animated.View pointerEvents="none"
          style={[styles.highlight, { width: tabWidth, backgroundColor: theme.accentSoft }, highlight]} />
        <View style={styles.pillRow} onLayout={event => setRowWidth(event.nativeEvent.layout.width)}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  touchSurface: { touchAction: 'pan-y pinch-zoom' },
  tabListContainer: { position: 'absolute', width: '100%', alignItems: 'center' },
  desktop: { top: 0, minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, justifyContent: 'center' },
  innerContainer: { flexDirection: 'row', alignItems: 'center', width: '100%', maxWidth: MaxContentWidth },
  desktopInner: { maxWidth: 1100, paddingHorizontal: Spacing.four, gap: Spacing.three },
  brandText: { marginRight: 'auto' },
  pressed: { opacity: 0.7 },
  tabButton: { minHeight: 56, flex: 1, minWidth: 0, maxWidth: 200, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: Spacing.one },
  pill: { width: '100%', maxWidth: PillMaxWidth, height: PillHeight, borderRadius: PillHeight / 2, padding: PillPadding,
    borderWidth: StyleSheet.hairlineWidth, boxShadow: '0px 8px 24px #102A4322' },
  pillRow: { flex: 1, flexDirection: 'row' },
  highlight: { position: 'absolute', top: PillPadding, left: PillPadding, bottom: PillPadding, borderRadius: (PillHeight - PillPadding * 2) / 2 },
  mobileTab: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', gap: 2 },
  iconStack: { width: 22, height: 22 },
  centered: { alignItems: 'center', justifyContent: 'center' },
  mobileLabel: { fontFamily: Fonts.sans, fontSize: 11, lineHeight: 14, textAlign: 'center' },
});
