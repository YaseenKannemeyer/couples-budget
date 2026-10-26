import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export function Choice({ label, selected, disabled = false, onPress }: {
  label: string; selected: boolean; disabled?: boolean; onPress: () => void;
}) {
  const theme = useTheme();
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.choice,
      { backgroundColor: selected ? theme.backgroundElement : 'transparent', opacity: disabled ? 0.55 : pressed ? 0.72 : 1 },
      selected && { borderColor: theme.border, borderWidth: StyleSheet.hairlineWidth }]}>
    <ThemedText type="smallBold" style={{ color: selected ? theme.accent : theme.textSecondary, textAlign: 'center' }}>{label}</ThemedText>
  </Pressable>;
}
export function Choices({ label, children }: { label: string; children: React.ReactNode }) {
  const theme = useTheme();
  return <View style={styles.group}>
    <ThemedText type="smallBold">{label}</ThemedText>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.options, { backgroundColor: theme.backgroundSelected }]}>{children}</View>
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.one, padding: Spacing.one, borderRadius: Radius.medium },
  choice: { flexGrow: 1, flexBasis: 'auto', minHeight: 48, justifyContent: 'center', paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three, borderRadius: Radius.small },
});
