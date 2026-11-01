import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { ThemedText } from '@/components/themed-text';
import { accentColor, Spacing, type AccentFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { wheelArcs } from './wheel-geometry';

export type WheelSegment = { id: string; amount: number; family: AccentFamily };
const STROKE = 22;
/**
 * One readable donut for nonnegative category totals. Rows beside it are the accessible equivalent;
 * the wheel itself is a single image with a text summary. Empty data shows only the track.
 */
export function SpendingWheel({ segments, centreLabel, centreValue, summary, selectedId, onSelect }: {
  segments: WheelSegment[]; centreLabel: string; centreValue: string; summary: string;
  selectedId?: string | null; onSelect?: (id: string) => void;
}) {
  const theme = useTheme(); const { fontScale } = useWindowDimensions();
  const arcs = wheelArcs(segments, { stroke: STROKE }) ?? [];
  const family = new Map(segments.map(segment => [segment.id, segment.family]));
  const compact = fontScale > 1.3;
  return <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.wrap}>
    <View style={[styles.wheel, compact && styles.compact]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width="100%" height="100%" viewBox="0 0 260 260" aria-hidden>
        <Circle cx={130} cy={130} r={104} fill="none" stroke={theme.chartTrack} strokeWidth={STROKE} />
        {arcs.map(arc => {
          const color = accentColor(family.get(arc.id) ?? 'slate');
          const faded = !!selectedId && selectedId !== arc.id;
          const press = onSelect ? { onPress: () => onSelect(arc.id) } : {};
          return arc.dot
            ? <Circle key={arc.id} cx={arc.x} cy={arc.y} r={STROKE / 2} fill={color} opacity={faded ? 0.3 : 1} {...press} />
            : <Path key={arc.id} d={arc.path} fill="none" stroke={color} strokeWidth={selectedId === arc.id ? STROKE + 4 : STROKE}
              strokeLinecap="round" opacity={faded ? 0.3 : 1} {...press} />;
        })}
      </Svg>
      {!compact && <View style={styles.centre} pointerEvents="none">
        <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{centreLabel}</ThemedText>
        <ThemedText type="subtitle" adjustsFontSizeToFit numberOfLines={1} style={[styles.centred, styles.value]}>{centreValue}</ThemedText>
      </View>}
    </View>
    {compact && <View style={styles.below}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{centreLabel}</ThemedText>
      <ThemedText type="subtitle" style={[styles.centred, styles.value]}>{centreValue}</ThemedText>
    </View>}
  </View>;
}
const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: Spacing.two },
  wheel: { width: '78%', maxWidth: 280, aspectRatio: 1 },
  compact: { width: '50%', maxWidth: 180 },
  centre: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: '20%', gap: 2 },
  below: { gap: 2 },
  centred: { textAlign: 'center' },
  value: { fontVariant: ['tabular-nums'] },
});
