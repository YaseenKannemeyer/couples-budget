import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { accentColor, Motion, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { SummaryRow } from './summary-row';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
function AnimatedBar({ y, height, ...props }: React.ComponentProps<typeof Rect> & { y: number; height: number }) {
  const position = useSharedValue(y); const length = useSharedValue(height);
  useEffect(() => {
    const config = { duration: Motion.chart, easing: Easing.out(Easing.exp), reduceMotion: ReduceMotion.System };
    position.value = withTiming(y, config); length.value = withTiming(height, config);
  }, [y, height, position, length]);
  const animated = useAnimatedProps(() => ({ y: position.value, height: length.value }));
  return <AnimatedRect {...props} animatedProps={animated} />;
}
export type PeriodBar = { id: string; label: string; amount: number; value: string };
/** Signed values share a zero baseline; labels remain real text so they scale. */
export function PeriodBarChart({ items, summary, reference, referenceLabel, activeId }: {
  items: PeriodBar[]; summary: string; reference?: number; referenceLabel?: string; activeId?: string;
}) {
  const theme = useTheme();
  const { width, fontScale } = useWindowDimensions();
  const stackedLabels = width < 600 || fontScale > 1.2;
  const finite = items.filter(item => Number.isFinite(item.amount));
  const max = Math.max(1, ...finite.map(item => item.amount), reference ?? 0);
  const min = Math.min(0, ...finite.map(item => item.amount), reference ?? 0);
  const range = max - min; const y = (amount: number) => 12 + (max - amount) / range * 136;
  const barWidth = finite.length ? 280 / finite.length : 280;
  return <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.bars}>
    {referenceLabel && <ThemedText type="small" themeColor="textSecondary">{referenceLabel}</ThemedText>}
    <Svg width="100%" height={170} viewBox="0 0 320 170" aria-hidden>
      <Line x1={12} x2={308} y1={y(0)} y2={y(0)} stroke={theme.border} />
      {reference != null && Number.isFinite(reference) && <Line x1={12} x2={308} y1={y(reference)} y2={y(reference)} stroke={theme.textSecondary} strokeDasharray="4 5" />}
      {finite.map((item, i) => <AnimatedBar key={item.id} x={20 + i * barWidth + barWidth * 0.15}
        y={Math.min(y(0), y(item.amount))} height={Math.max(1, Math.abs(y(0) - y(item.amount)))}
        width={barWidth * 0.7} rx={Math.min(12, Math.max(1, Math.abs(y(0) - y(item.amount)) / 2))}
        fill={accentColor('periwinkle')} opacity={!activeId || item.id === activeId ? 1 : 0.45} />)}
    </Svg>
    {stackedLabels ? <View style={styles.legend}>{finite.map(item => <SummaryRow key={item.id} label={item.label} value={item.value} />)}</View> :
    <View style={styles.labels}>{finite.map(item => <View key={item.id} style={styles.barLabel}>
      <ThemedText type="smallBold" style={styles.centered}>{item.value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>{item.label}</ThemedText>
    </View>)}</View>}
  </View>;
}
const styles = StyleSheet.create({
  centered: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  legend: { width: '100%', gap: Spacing.two, paddingTop: Spacing.three },
  bars: { gap: Spacing.two }, labels: { flexDirection: 'row' },
  barLabel: { flex: 1, minWidth: 0, paddingHorizontal: Spacing.one, gap: Spacing.one },
});
