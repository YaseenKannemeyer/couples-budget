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
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: Spacing.three, rowGap: Spacing.one },
  label: { flexShrink: 1, flexBasis: '45%', flexGrow: 1 },
  value: { fontSize: 16, lineHeight: 24, flexShrink: 1, fontVariant: ['tabular-nums'] },
});
