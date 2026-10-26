import { StyleSheet, View, type ViewStyle } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AnimatedAmount } from './animated-amount';
import { Icon, type IconName } from './icon';
import { ProgressBar } from './progress-bar';
export function StatTile({ label, value, hint, icon, progress, style }: {
  label: string; value: string; hint?: string; icon: IconName; progress?: number; style?: ViewStyle;
}) {
  const theme = useTheme();
  return <View style={[styles.tile, { backgroundColor: theme.backgroundElement }, style]}>
    <View style={[styles.icon, { backgroundColor: theme.accentSoft }]}><Icon name={icon} color={theme.accent} size={20} /></View>
    <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    <AnimatedAmount type="amount" style={Type.section}>{value}</AnimatedAmount>
    {progress != null && <ProgressBar value={progress} label={label} />}
    {hint && <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText>}
  </View>;
}
const styles = StyleSheet.create({ tile: { flexGrow: 1, flexBasis: 145, minWidth: 0, borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  icon: { width: 36, height: 36, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' } });
