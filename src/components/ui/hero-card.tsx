import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { AnimatedAmount } from './animated-amount';
import { Icon, type IconName } from './icon';
import { ProgressBar } from './progress-bar';
/** The one navy financial summary per screen. Labels state what the number is; never a bank balance. */
export function HeroCard({ title, value, subtitle, progress, progressLabel, progressSummary, warning, icon, link, children }: {
  title: string; value: string; subtitle?: string; progress?: number | null; progressLabel?: string;
  progressSummary?: string; warning?: string; icon?: IconName; link?: { label: string; onPress: () => void }; children?: ReactNode;
}) {
  const theme = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.hero }]}>
    <View style={styles.heading}>{icon && <Icon name={icon} color={theme.heroText} size={18} />}
      <ThemedText accessibilityRole="header" themeColor="heroText" style={styles.title}>{title}</ThemedText></View>
    <AnimatedAmount type="amount" themeColor="heroText">{value}</AnimatedAmount>
    {(subtitle || link) && <View style={styles.footer}>
      {subtitle && <ThemedText type="small" themeColor="heroText" style={styles.subtitle}>{subtitle}</ThemedText>}
      {link && <Pressable accessibilityRole="link" accessibilityLabel={link.label} onPress={link.onPress} hitSlop={6}
        style={({ pressed }) => [styles.link, { opacity: pressed ? 0.7 : 1 }]}>
        <ThemedText type="smallBold" themeColor="heroText">{link.label}</ThemedText>
        <Icon name="chevronRight" color={theme.heroText} size={14} />
      </Pressable>}
    </View>}
    {progress != null && <ProgressBar inverse value={progress} label={progressLabel ?? title} summary={progressSummary} warning={!!warning} />}
    {children}
    {warning && <ThemedText accessibilityRole="alert" type="smallBold" themeColor="heroAttention">{warning}</ThemedText>}
  </View>;
}
export function HeroRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><ThemedText type="small" themeColor="heroSecondary" style={{ flexGrow: 1, flexBasis: '45%' }}>{label}</ThemedText>
    <ThemedText type="smallBold" themeColor="heroText" style={{ fontVariant: ['tabular-nums'] }}>{value}</ThemedText></View>;
}
const styles = StyleSheet.create({
  card: { paddingVertical: 20, paddingHorizontal: Spacing.four - 4, gap: Spacing.two, borderRadius: Radius.large },
  heading: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  footer: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  subtitle: { flexShrink: 1, fontVariant: ['tabular-nums'] },
  link: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, minHeight: 48 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: Spacing.two },
});
