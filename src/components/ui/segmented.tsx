import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Two or three mutually exclusive scopes; the selected one is filled blue and announced as checked. */
export function Segmented<T extends string>({ label, value, options, disabled, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; disabled?: boolean; onChange: (value: T) => void;
}) {
  const theme = useTheme();
  return <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.track, { backgroundColor: theme.backgroundElement }]}>
    {options.map(option => {
      const selected = option.value === value;
      return <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} aria-checked={selected}
        accessibilityState={{ checked: selected, disabled: !!disabled }} disabled={disabled} onPress={() => onChange(option.value)}
        style={({ pressed }) => [styles.option, { backgroundColor: selected ? theme.accent : 'transparent', opacity: disabled ? 0.55 : pressed ? 0.8 : 1 }]}>
        <ThemedText type="smallBold" style={{ color: selected ? theme.onAccent : theme.text, textAlign: 'center', fontSize: 16 }}>{option.label}</ThemedText>
      </Pressable>;
    })}
  </View>;
}
const styles = StyleSheet.create({
  track: { flexDirection: 'row', flexWrap: 'wrap', padding: 3, borderRadius: Radius.medium, gap: 3 },
  option: { flexGrow: 1, flexBasis: 120, minHeight: 46, justifyContent: 'center', paddingHorizontal: Spacing.three, borderRadius: Radius.small },
});
