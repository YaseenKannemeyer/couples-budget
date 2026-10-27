import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from './icon';
export function PillActions({ actions }: { actions: { label: string; icon: IconName; onPress: () => void }[] }) {
  const theme = useTheme();
  return <View style={styles.actions}>
    {actions.map(action => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress}
      style={({ pressed }) => [styles.pill, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={action.icon} color={theme.accent} size={18} /><ThemedText type="smallBold" themeColor="accent">{action.label}</ThemedText>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({ actions: { gap: Spacing.two, flexDirection: 'row', flexWrap: 'wrap' },
  pill: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, minHeight: 48,
    paddingVertical: Spacing.two, paddingHorizontal: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth } });
