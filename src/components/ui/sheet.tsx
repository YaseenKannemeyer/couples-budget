import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Button } from './button';
import { Screen } from './screen';
/** Route-owned sheet: Router supplies native presentation, back gestures and dismissal. */
export function Sheet({ title, cancel, save, children }: {
  title: string; cancel: { label: string; onPress: () => void; disabled?: boolean };
  save?: { label: string; onPress: () => void; loading?: boolean }; children: ReactNode;
}) {
  const theme = useTheme();
  return <Screen>
    <View style={[styles.handle, { backgroundColor: theme.border }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    <View style={styles.header}>
      <Button title={cancel.label} variant="secondary" disabled={cancel.disabled} onPress={cancel.onPress} />
      {save && <Button title={save.label} loading={save.loading} onPress={save.onPress} />}
    </View>
    <ThemedText type="section" accessibilityRole="header">{title}</ThemedText>
    {children}
  </Screen>;
}
const styles = StyleSheet.create({ handle: { width: 40, height: 5, alignSelf: 'center', borderRadius: Radius.pill },
  header: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.two } });
