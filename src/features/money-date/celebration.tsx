import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
import { useTheme } from '@/hooks/use-theme';
/** One finite celebration after a successful close; history never replays it. */
export function MoneyDateCelebration() {
  const { t } = useTranslation();const reduced = useReducedMotionPreference();
  return <View style={styles.success} accessibilityLiveRegion="polite">
    {!reduced && <View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.confetti}>
      {[0, 1, 2, 3, 4, 5, 6, 7].map(index => <Piece key={index} index={index} />)}
    </View>}
    <ThemedText type="section" themeColor="success">{t('moneyDate.highFive')}</ThemedText>
    <ThemedText>{t('moneyDate.celebrate')}</ThemedText>
  </View>;
}
function Piece({ index }: { index: number }) {
  const theme = useTheme();const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withTiming(1, { duration: 850, easing: Easing.out(Easing.exp), reduceMotion: ReduceMotion.System });
    return () => cancelAnimation(progress);
  }, [progress]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - progress.value,
    transform: [{ translateX: (index - 3.5) * 23 * progress.value }, { translateY: -28 + 70 * progress.value }, { rotate: `${index * 41 + 120 * progress.value}deg` }] }));
  return <Animated.View style={[styles.piece, { backgroundColor: index % 2 ? theme.accent : theme.success }, style]} />;
}
const styles = StyleSheet.create({ success: { gap: Spacing.two, paddingVertical: Spacing.three }, confetti: { height: 42, alignItems: 'center', overflow: 'hidden' },
  piece: { position: 'absolute', top: 24, width: 5, height: 10, borderRadius: 1 } });
