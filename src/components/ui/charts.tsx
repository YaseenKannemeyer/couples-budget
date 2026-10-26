import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import Animated, { Easing, ReduceMotion, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { categoryTone, Motion, Spacing, Type } from '@/constants/theme';
import { useFormatters } from '@/hooks/use-formatters';
import { useTheme } from '@/hooks/use-theme';
import { SummaryRow } from './summary-row';
import { Icon } from './icon';

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export type SpendSegment = { id: string; label: string; amount: number; emoji?: string | null };
function Arc({ radius, value, color, rotation = -90, width = 15 }: { radius: number; value: number; color: string; rotation?: number; width?: number }) {
  const length = 2 * Math.PI * radius;
  const target = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = withTiming(target, { duration: Motion.chart, easing: Easing.out(Easing.exp), reduceMotion: ReduceMotion.System }); }, [target, progress]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: length * (1 - progress.value) }));
  return <AnimatedCircle cx={130} cy={130} r={radius} fill="none" stroke={color} strokeWidth={width}
    strokeLinecap="round" strokeDasharray={`${length} ${length}`} animatedProps={props} rotation={rotation} origin="130,130" />;
}
/** Arcs show positive net category spending. Signed totals and refunds stay in the supplied summary/legend. */
export function SpendDonut({ segments, value, label, summary }: { segments: SpendSegment[]; value: string; label: string; summary: string }) {
  const format = useFormatters();
  const theme = useTheme(); const { fontScale } = useWindowDimensions();
  const positive = segments.filter(s => Number.isFinite(s.amount) && s.amount > 0);
  const total = positive.reduce((sum, s) => sum + s.amount, 0);
  return <View style={styles.donutWrap}>
    <View accessible accessibilityRole="image" accessibilityLabel={summary} style={{ width: '100%', alignItems: 'center' }}>
    <View style={[styles.donut, fontScale > 1.3 && styles.scaledDonut]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {fontScale <= 1.3 && <Svg width="100%" height="100%" viewBox="0 0 260 260" aria-hidden>
        <Circle cx={130} cy={130} r={108} fill="none" stroke={theme.backgroundSelected} strokeWidth={18} />
        {positive.map((segment, index) => {
          const share = segment.amount / total;
          const offset = positive.slice(0, index).reduce((sum, item) => sum + item.amount, 0) / total;
          const rotation = -90 + offset * 360;
          const angle = (offset + share / 2) * 2 * Math.PI - Math.PI / 2;
          return <ViewlessArc key={segment.id} marker={format.number(index + 1)} markerX={130 + Math.cos(angle) * 108} markerY={130 + Math.sin(angle) * 108} themeBackground={theme.backgroundElement} themeText={theme.text} radius={108} value={Math.max(0, share - (positive.length > 1 ? Math.min(0.018, share * 0.3) : 0))}
            rotation={rotation} color={categoryTone(segment.id, theme).ink} width={18} />;
        })}
        {Array.from({ length: 24 }, (_, index) => {
          const angle = index * Math.PI / 12;
          return <Line key={index} x1={130 + Math.sin(angle) * 86} y1={130 - Math.cos(angle) * 86}
            x2={130 + Math.sin(angle) * (index % 6 === 0 ? 92 : 89)} y2={130 - Math.cos(angle) * (index % 6 === 0 ? 92 : 89)}
            stroke={index % 6 === 0 ? theme.textSecondary : theme.border} strokeWidth={2} strokeLinecap="round" />;
        })}
      </Svg>}
      <View style={fontScale <= 1.3 ? styles.donutCenter : styles.largeCenter}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>{label}</ThemedText>
        <ThemedText type="amount" style={[Type.title, styles.centered]}>{value}</ThemedText>
      </View>
    </View></View>
    <View style={styles.legend}>{segments.map(segment => {
      const index = positive.findIndex(item => item.id === segment.id);
      return <View key={segment.id} style={styles.legendRow}>
        <ThemedText type="smallBold" style={{ minWidth: 24 }}>{index >= 0 ? format.number(index + 1) : '–'}</ThemedText>
        <ThemedText type="small" style={{ flex: 1 }}>{segment.label}</ThemedText>
      </View>;
    })}</View>
  </View>;
}
function ViewlessArc({ marker, markerX, markerY, themeBackground, themeText, ...arc }: Parameters<typeof Arc>[0] & {
  marker: string; markerX: number; markerY: number; themeBackground: string; themeText: string;
}) {
  return <><Arc {...arc} /><Circle cx={markerX} cy={markerY} r={9} fill={themeBackground} />
    <SvgText x={markerX} y={markerY + 4} textAnchor="middle" fontSize={11} fontWeight="600" fill={themeText}>{marker}</SvgText></>;
}
export function MiniGauge({ label, value, ratio, summary }: { label: string; value: string; ratio?: number | null; summary: string }) {
  const theme = useTheme();
  return <View accessible accessibilityRole="image" accessibilityLabel={summary} style={styles.gauge}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.gaugeIcon}>
      <Svg width={62} height={62} viewBox="0 0 260 260" aria-hidden>
        <Circle cx={130} cy={130} r={106} fill="none" stroke={theme.backgroundSelected} strokeWidth={26} />
        {ratio != null && <Arc radius={106} value={ratio} color={theme.accent} width={26} />}
      </Svg>
      <View style={styles.gaugeCenter}><Icon name="wallet" color={theme.accent} size={20} /></View>
    </View>
    <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>{label}</ThemedText>
    <ThemedText type="smallBold" style={styles.centered}>{value}</ThemedText>
  </View>;
}
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
        fill={item.id === activeId ? theme.accent : theme.accentSoft} />)}
    </Svg>
    {stackedLabels ? <View style={styles.legend}>{finite.map(item => <SummaryRow key={item.id} label={item.label} value={item.value} />)}</View> :
    <View style={styles.labels}>{finite.map(item => <View key={item.id} style={styles.barLabel}>
      <ThemedText type="smallBold" style={styles.centered}>{item.value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>{item.label}</ThemedText>
    </View>)}</View>}
  </View>;
}
const styles = StyleSheet.create({
  donutWrap: { alignItems: 'center', paddingVertical: Spacing.two }, donut: { width: '100%', maxWidth: 260, aspectRatio: 1 },
  scaledDonut: { width: '100%', height: 'auto', aspectRatio: undefined }, donutCenter: { position: 'absolute', top: '32%', left: '17%', right: '17%', gap: Spacing.one },
  largeCenter: { gap: Spacing.two, padding: Spacing.three }, centered: { textAlign: 'center', fontVariant: ['tabular-nums'] },
  gauge: { flex: 1, minWidth: 90, alignItems: 'center', gap: Spacing.two }, gaugeIcon: { width: 62, height: 62 },
  gaugeCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  legend: { width: '100%', gap: Spacing.two, paddingTop: Spacing.three },
  legendRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.two },
  bars: { gap: Spacing.two }, labels: { flexDirection: 'row' },
  barLabel: { flex: 1, minWidth: 0, paddingHorizontal: Spacing.one, gap: Spacing.one },
});
