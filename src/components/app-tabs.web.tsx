import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';

import { APP_NAME } from '@/constants/app';
import { Icon, type IconName } from '@/components/ui/icon';
import { useTheme } from '@/hooks/use-theme';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

export default function AppTabs() {
  const { t } = useTranslation();
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="index" href="/" asChild>
            <TabButton icon="home">{t('navigation.home')}</TabButton>
          </TabTrigger>
          <TabTrigger name="shared-budget" href="/shared-budget" asChild>
            <TabButton icon="chart">{t('navigation.sharedBudget')}</TabButton>
          </TabTrigger>
          <TabTrigger name="private-space" href="/private-space" asChild>
            <TabButton icon="lock">{t('navigation.privateSpace')}</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton icon="settings">{t('navigation.settings')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// The slot's `ref` is typed as a component ref rather than a view ref, so it isn't
// forwarded; the button doesn't need one.
export function TabButton({ children, isFocused, icon, ref: _ref, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  const theme = useTheme();
  return (
    <Pressable {...props} accessibilityRole="tab" accessibilityState={{ selected: !!isFocused }}
      style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <Icon name={icon} size={21} color={isFocused ? theme.accent : theme.textSecondary} />
        <ThemedText type="smallBold" themeColor={isFocused ? 'accent' : 'textSecondary'} style={{ fontSize: 12, textAlign: 'center' }}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width, fontScale } = useWindowDimensions();
  const desktop = width / fontScale >= 900;
  return (
    <View {...props} style={[styles.tabListContainer, desktop && styles.desktop]}>
      <ThemedView type="backgroundElement" style={[styles.innerContainer, desktop && styles.desktopInner]}>
        {width / fontScale >= 600 && <ThemedText type="smallBold" themeColor="accent" style={styles.brandText}>
          {APP_NAME}
        </ThemedText>}

        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.medium,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.one,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  desktop: { top: 0, bottom: 'auto', minHeight: 72, padding: 0 },
  desktopInner: { maxWidth: '100%', borderRadius: 0, paddingHorizontal: Spacing.four, gap: Spacing.three },
  pressed: {
    opacity: 0.7,
  },
  tabButton: {
    minHeight: 48,
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  tabButtonView: {
    minHeight: 56,
    alignItems: 'center',
    gap: Spacing.one,
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
});
