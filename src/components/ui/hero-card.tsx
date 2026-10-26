import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AnimatedAmount } from './animated-amount';
import { Icon, type IconName } from './icon';
import { ProgressBar } from './progress-bar';
/** A financial summary; the future spending-limit slot is deliberately not rendered. */
export function HeroCard({ title, value, subtitle, progress, progressLabel, progressSummary, warning, icon = 'wallet', children }: {
  title: string; value: string; subtitle?: string; progress?: number | null; progressLabel?: string;
  progressSummary?: string; warning?: string; icon?: IconName; children?: ReactNode;
}) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.hero }]}>
    <View style={styles.heading}><View style={[styles.icon, { backgroundColor: theme.heroTrack }]}><Icon name={icon} color={theme.heroText} size={20} /></View>
      <ThemedText type="smallBold" accessibilityRole="header" themeColor="heroText" style={{ flex: 1 }}>{title}</ThemedText></View>
    <AnimatedAmount type="amount" themeColor="heroText">{value}</AnimatedAmount>
    {subtitle && <ThemedText type="small" themeColor="heroSecondary">{subtitle}</ThemedText>}
    {progress != null && <ProgressBar inverse value={progress} label={progressLabel ?? title} summary={progressSummary} warning={!!warning} />}
    {children}
    {warning && <ThemedText accessibilityRole="alert" type="small" themeColor="heroAttention">{warning}</ThemedText>}
  </View>;
}
export function HeroRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><ThemedText type="small" themeColor="heroSecondary" style={{ flexGrow: 1, flexBasis: '45%' }}>{label}</ThemedText>
    <ThemedText type="smallBold" themeColor="heroText" style={{ fontVariant: ['tabular-nums'] }}>{value}</ThemedText></View>;
}
const styles = StyleSheet.create({
  card: { padding: Spacing.four, gap: Spacing.three, borderRadius: Radius.large },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  icon: { width: 38, height: 38, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: Spacing.two },
});
