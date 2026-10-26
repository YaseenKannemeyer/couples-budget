import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';

export function SummaryRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}>
    <ThemedText themeColor="textSecondary" style={styles.label}>{label}</ThemedText>
    <ThemedText type="smallBold" style={styles.value}>{value}</ThemedText>
  </View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: Spacing.two },
  label: { flexShrink: 1 },
  value: { fontVariant: ['tabular-nums'] },
});
