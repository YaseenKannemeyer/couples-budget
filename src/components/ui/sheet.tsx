import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { Button } from './button';
import { Screen } from './screen';
/** Route-owned sheet: Router supplies native presentation, back gestures and dismissal. */
export function Sheet({ title, cancel, save, children }: {
  title: string; cancel: { label: string; onPress: () => void; disabled?: boolean };
  save?: { label: string; onPress: () => void; loading?: boolean }; children: ReactNode;
}) {
  return <Screen>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel={cancel.label} accessibilityState={{ disabled: !!cancel.disabled }}
        disabled={cancel.disabled} onPress={cancel.onPress} hitSlop={6} style={({ pressed }) => [styles.side, { opacity: cancel.disabled ? 0.5 : pressed ? 0.6 : 1 }]}>
        <ThemedText themeColor="accent">{cancel.label}</ThemedText>
      </Pressable>
      <ThemedText type="smallBold" accessibilityRole="header" style={styles.title}>{title}</ThemedText>
      <View style={[styles.side, styles.end]}>{save && <Button title={save.label} loading={save.loading} onPress={save.onPress} />}</View>
    </View>
    {children}
  </Screen>;
}
const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: -Spacing.two },
  side: { minWidth: 72, minHeight: 48, justifyContent: 'center' },
  end: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: 17, lineHeight: 24 },
});
