import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Motion, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
export function ProgressBar({ value, label, summary, inverse = false, warning = false }: {
  value: number; label: string; summary?: string; inverse?: boolean; warning?: boolean;
}) {
  const theme = useTheme();
  const bounded = Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
  const progress = useSharedValue(bounded);
  useEffect(() => { progress.value = withTiming(bounded, { duration: Motion.chart, easing: Easing.out(Easing.exp), reduceMotion: ReduceMotion.System }); }, [bounded, progress]);
  const animated = useAnimatedStyle(() => ({ width: `${progress.value}%` as `${number}%` }));
  return <View accessible accessibilityRole="progressbar" accessibilityLabel={label}
    accessibilityValue={{ min: 0, max: 100, now: Math.round(bounded), text: summary }}
    style={[styles.track, { backgroundColor: inverse ? theme.heroTrack : theme.backgroundSelected }]}>
    <Animated.View style={[styles.fill, { backgroundColor: warning ? inverse ? theme.heroAttention : theme.attention : inverse ? theme.heroAccent : theme.accent }, animated]} />
  </View>;
}
const styles = StyleSheet.create({ track: { height: 9, borderRadius: Radius.pill, overflow: 'hidden' }, fill: { height: '100%', borderRadius: Radius.pill } });
