import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';

export function Choice({ label, selected, disabled = false, onPress }: {
  label: string; selected: boolean; disabled?: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: selected, disabled }}
    disabled={disabled} onPress={onPress}>
    <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={styles.choice}>
      <ThemedText type="smallBold" themeColor={selected ? 'accent' : 'text'}>{label}</ThemedText>
    </ThemedView>
  </Pressable>;
}

export function Choices({ label, children }: { label: string; children: React.ReactNode }) {
  return <View style={styles.group}>
    <ThemedText type="smallBold">{label}</ThemedText>
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={styles.options}>{children}</View>
  </View>;
}

const styles = StyleSheet.create({
  group: { gap: Spacing.two },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { minHeight: 50, justifyContent: 'center', padding: Spacing.three, borderRadius: Radius.small },
});
