import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing, TileSize } from '@/constants/theme';
import type { TileVisual } from '@/features/categories/visual';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from './icon';
import { IconTile } from './icon-tile';

export type ListRowProps = {
  title: string; subtitle?: string; value?: string; valueHint?: string; visual?: TileVisual;
  onPress?: () => void; accessibilityLabel?: string; accessibilityHint?: string; selected?: boolean; dimmed?: boolean; last?: boolean;
  tone?: 'default' | 'attention'; chevron?: boolean; children?: ReactNode;
};
/** Compact banking row: tile, title/subtitle, tabular amount and a chevron when it opens something. */
export function ListRow({ title, subtitle, value, valueHint, visual, onPress, accessibilityLabel, accessibilityHint, selected, dimmed, last, tone = 'default', chevron = true, children }: ListRowProps) {
  const theme = useTheme();
  // Large system text stacks the amount under the title instead of shrinking either.
  const stacked = useWindowDimensions().fontScale >= 1.4;
  const label = accessibilityLabel ?? [title, subtitle, value, valueHint].filter(Boolean).join(', ');
  const amounts = (!!value || !!valueHint) && <View style={stacked ? styles.stackedValue : styles.value}>
    {!!value && <ThemedText style={[styles.amount, stacked && styles.left]}>{value}</ThemedText>}
    {!!valueHint && <ThemedText type="small" themeColor="textSecondary" style={stacked ? styles.left : styles.right}>{valueHint}</ThemedText>}
  </View>;
  const body = <>
    {visual && <IconTile visual={visual} dimmed={dimmed} />}
    <View style={styles.copy}>
      <ThemedText style={styles.title}>{title}</ThemedText>
      {!!subtitle && <ThemedText type="small" themeColor={tone === 'attention' ? 'attention' : 'textSecondary'}>{subtitle}</ThemedText>}
      {children}
      {stacked && amounts}
    </View>
    {!stacked && amounts}
    {onPress && chevron && <Icon name="chevronRight" size={16} color={theme.textSecondary} />}
  </>;
  const style = [styles.row, { borderBottomColor: theme.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth },
    selected && { backgroundColor: theme.accentSoft }];
  if (!onPress) return <View accessible accessibilityLabel={label} style={style}>{body}</View>;
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint} accessibilityState={selected === undefined ? undefined : { selected }}
    onPress={onPress} style={({ pressed }) => [...style, pressed && { backgroundColor: theme.backgroundElement }]}>{body}</Pressable>;
}

/** Section title with an optional "See all" link; rows below share one divider rhythm. */
export function ListSection({ title, action, children, flush = false }: {
  title?: string; action?: { label: string; onPress: () => void; accessibilityLabel?: string }; children: ReactNode; flush?: boolean;
}) {
  const theme = useTheme();
  return <View style={styles.section}>
    {(title || action) && <View style={[styles.header, { borderBottomColor: theme.border }, flush && { borderBottomWidth: 0 }]}>
      {title && <ThemedText type="section" accessibilityRole="header" style={{ flex: 1 }}>{title}</ThemedText>}
      {action && <Pressable accessibilityRole="link" accessibilityLabel={action.accessibilityLabel ?? action.label} onPress={action.onPress}
        hitSlop={8} style={({ pressed }) => [styles.link, { opacity: pressed ? 0.6 : 1 }]}>
        <ThemedText type="smallBold" themeColor="accent">{action.label}</ThemedText>
      </Pressable>}
    </View>}
    {children}
  </View>;
}

/** Light grey band separating groups of rows, as in the approved Plan concept. */
export function GroupGap() {
  const theme = useTheme();
  return <View style={[styles.gap, { backgroundColor: theme.backgroundElement }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}

const styles = StyleSheet.create({
  section: { gap: 0 },
  header: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  link: { minHeight: 48, minWidth: 48, justifyContent: 'center', alignItems: 'flex-end' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: TileSize + 28, paddingVertical: 12, paddingHorizontal: Spacing.one },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  value: { alignItems: 'flex-end', flexShrink: 1, maxWidth: '45%' },
  amount: { fontSize: 16, lineHeight: 22, fontWeight: '500', fontVariant: ['tabular-nums'], textAlign: 'right' },
  right: { textAlign: 'right' }, left: { textAlign: 'left' }, stackedValue: { alignItems: 'flex-start' },
  gap: { height: 12, marginHorizontal: -20, marginVertical: -Spacing.two },
});
