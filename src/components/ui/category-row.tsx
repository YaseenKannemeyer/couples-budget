import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { categoryVisual } from '@/features/categories/visual';
import { useTheme } from '@/hooks/use-theme';
import { IconTile } from './icon-tile';
/** Row with interactive children (edit/review actions); simple navigation rows use ListRow instead. */
export function CategoryRow({ id, name, emoji, starterKey = null, value, subtitle, children }: {
  id: string; name: string; emoji?: string | null; starterKey?: string | null; value?: string; subtitle?: string; children?: ReactNode;
}) {
  const theme = useTheme();
  return <View style={[styles.row, { borderBottomColor: theme.border }]}>
    <View style={styles.heading}>
      <IconTile visual={categoryVisual({ id, name, emoji: emoji ?? null, starterKey })} />
      <View style={styles.copy}><ThemedText type="smallBold" accessibilityRole="header" style={styles.name}>{name}</ThemedText>
        {subtitle && <ThemedText type="small" themeColor="textSecondary">{subtitle}</ThemedText>}</View>
      {value && <ThemedText style={styles.value}>{value}</ThemedText>}
    </View>
    {children}
  </View>;
}
const styles = StyleSheet.create({ row: { gap: Spacing.two, paddingVertical: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14 },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 100, gap: 2 }, name: { fontSize: 16, lineHeight: 22 },
  value: { fontSize: 16, lineHeight: 22, fontWeight: '500', fontVariant: ['tabular-nums'], flexShrink: 1 } });
