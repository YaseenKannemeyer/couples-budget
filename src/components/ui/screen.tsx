import { createContext, useCallback, useRef, type ComponentRef, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ActionBarInset, BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export const RevealInScreen = createContext<(view: ComponentRef<typeof View>) => void>(() => {});

/**
 * Scrollable, keyboard-aware page with a comfortable reading width on desktop.
 * `withAction` reserves room for the floating + Add expense button; `onRefresh` adds pull-to-refresh.
 */
export function Screen({ children, withTabBar = false, withAction = false, refreshing = false, onRefresh }: {
  children: ReactNode; withTabBar?: boolean; withAction?: boolean; refreshing?: boolean; onRefresh?: () => unknown;
}) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const desktopTabs = withTabBar && Platform.OS === 'web' && width / fontScale >= 900;
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const viewport = useRef<ComponentRef<typeof View>>(null);
  const offset = useRef(0);
  const reveal = useCallback((view: ComponentRef<typeof View>) => {
    view.measureInWindow((_x, y) => viewport.current?.measureInWindow((_vx, top) => {
      const topInset = (desktopTabs ? 72 : insets.top) + Spacing.three;
      scroll.current?.scrollTo({ y: Math.max(0, offset.current + y - top - topInset), animated: false });
    }));
  }, [desktopTabs, insets.top]);
  return (
    <RevealInScreen value={reveal}><View ref={viewport} style={styles.container}><ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.container} edges={withTabBar ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}>
          <ScrollView
            ref={scroll}
            onScroll={event => { offset.current = event.nativeEvent.contentOffset.y; }}
            scrollEventThrottle={32}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            refreshControl={onRefresh && Platform.OS !== 'web' ? <RefreshControl refreshing={refreshing} onRefresh={() => { void onRefresh(); }}
              tintColor={theme.textSecondary} colors={[theme.accent]} /> : undefined}
            contentContainerStyle={[
              styles.content,
              { paddingHorizontal: width < 380 ? Spacing.three : 20 },
              withTabBar && { paddingBottom: desktopTabs ? Spacing.six + Spacing.four : BottomTabInset + Spacing.six },
              withAction && { paddingBottom: (withTabBar && !desktopTabs ? BottomTabInset : 0) + ActionBarInset + Spacing.five },
              desktopTabs && { paddingTop: 88 },
            ]}>
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView></View></RevealInScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    paddingBottom: Spacing.six + Spacing.five,
    gap: Spacing.four,
  },
});
