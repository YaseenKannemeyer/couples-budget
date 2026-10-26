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
import { MaxContentWidth, Spacing } from '@/constants/theme';

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
            <TabButton>{t('navigation.home')}</TabButton>
          </TabTrigger>
          <TabTrigger name="shared-budget" href="/shared-budget" asChild>
            <TabButton>{t('navigation.sharedBudget')}</TabButton>
          </TabTrigger>
          <TabTrigger name="private-space" href="/private-space" asChild>
            <TabButton>{t('navigation.privateSpace')}</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton>{t('navigation.settings')}</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

// The slot's `ref` is typed as a component ref rather than a view ref, so it isn't
// forwarded; the button doesn't need one.
export function TabButton({ children, isFocused, ref: _ref, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.tabButton, pressed && styles.pressed]}>
      <ThemedView
        type={isFocused ? 'backgroundSelected' : 'backgroundElement'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { width, fontScale } = useWindowDimensions();
  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="backgroundElement" style={styles.innerContainer}>
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
    width: '100%',
    padding: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
  },
  innerContainer: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.five,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
  },
  brandText: {
    marginRight: 'auto',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButton: {
    minHeight: 48,
    flexShrink: 1,
    justifyContent: 'center',
  },
  tabButtonView: {
    minHeight: 48,
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Spacing.three,
  },
});
