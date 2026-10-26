import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { categoryTone, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from './icon';
export function CategoryRow({ id, name, emoji, value, subtitle, children }: {
  id: string; name: string; emoji?: string | null; value?: string; subtitle?: string; children?: ReactNode;
}) {
  const theme = useTheme(); const tone = categoryTone(id, theme);
  return <View style={[styles.row, { borderBottomColor: theme.border }]}>
    <View style={styles.heading}>
      <View style={[styles.tile, { backgroundColor: tone.background }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {emoji ? <ThemedText style={{ fontSize: 21 }}>{emoji}</ThemedText> : <Icon name="chart" color={tone.ink} />}
      </View>
      <View style={styles.copy}><ThemedText type="smallBold" accessibilityRole="header">{name}</ThemedText>
        {subtitle && <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText>}</View>
      {value && <ThemedText type="smallBold" style={styles.value}>{value}</ThemedText>}
    </View>
    {children}
  </View>;
}
const styles = StyleSheet.create({ row: { gap: Spacing.two, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.three },
  tile: { width: 44, height: 44, borderRadius: Radius.small, alignItems: 'center', justifyContent: 'center' },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 100, gap: Spacing.one }, value: { fontVariant: ['tabular-nums'], flexShrink: 1 } });
