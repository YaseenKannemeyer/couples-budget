import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from './icon';

type Trailing = { kind: 'profile'; initial: string; label: string; onPress: () => void }
  | { kind: 'icon'; icon: IconName; label: string; onPress: () => void };

/** Large tab title with one quiet trailing control (profile initial or Settings gear). */
export function TabHeader({ title, subtitle, trailing }: { title: string; subtitle?: string; trailing?: Trailing }) {
  const theme = useTheme();
  return <View style={styles.tab}>
    <View style={styles.titleRow}>
      <ThemedText type="subtitle" accessibilityRole="header" style={{ flex: 1 }}>{title}</ThemedText>
      {trailing && <Pressable accessibilityRole="button" accessibilityLabel={trailing.label} onPress={trailing.onPress} hitSlop={4}
        style={({ pressed }) => [styles.trailing, { opacity: pressed ? 0.6 : 1 }]}>
        {trailing.kind === 'profile'
          ? <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText type="smallBold" style={{ fontSize: 17, color: theme.heading }}>{trailing.initial}</ThemedText>
          </View>
          : <Icon name={trailing.icon} color={theme.heading} size={24} />}
      </Pressable>}
    </View>
    {!!subtitle && <ThemedText themeColor="textSecondary">{subtitle}</ThemedText>}
  </View>;
}

/** Detail header: Back (system history), centred title and optional Close. */
export function DetailHeader({ title, subtitle, backLabel, onBack, close, children }: {
  title: string; subtitle?: string; backLabel: string; onBack?: () => void;
  close?: { label: string; onPress: () => void }; children?: ReactNode;
}) {
  const theme = useTheme();
  const back = onBack ?? (() => router.canGoBack() ? router.back() : router.replace('/'));
  return <View style={styles.detail}>
    <View style={styles.bar}>
      <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={back} hitSlop={4}
        style={({ pressed }) => [styles.trailing, styles.start, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon name="back" color={theme.heading} size={24} />
      </Pressable>
      {close && <Pressable accessibilityRole="button" accessibilityLabel={close.label} onPress={close.onPress} hitSlop={4}
        style={({ pressed }) => [styles.trailing, { opacity: pressed ? 0.6 : 1 }]}>
        <Icon name="close" color={theme.accent} size={22} />
      </Pressable>}
    </View>
    <ThemedText type="subtitle" accessibilityRole="header" style={styles.centered}>{title}</ThemedText>
    {!!subtitle && <ThemedText themeColor="textSecondary" style={styles.centered}>{subtitle}</ThemedText>}
    {children}
  </View>;
}

const styles = StyleSheet.create({
  tab: { gap: Spacing.one },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  trailing: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  start: { alignItems: 'flex-start' },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  detail: { gap: Spacing.one },
  bar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginHorizontal: -Spacing.one },
  centered: { textAlign: 'center' },
});
