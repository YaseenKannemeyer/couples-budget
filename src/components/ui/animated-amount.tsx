import { useEffect, useRef } from 'react';
import Animated, { ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { ThemedText, type ThemedTextProps } from '@/components/themed-text';
import { Motion } from '@/constants/theme';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
/** Change feedback keeps the actual formatted amount visible; never counts through fictional values. */
export function AnimatedAmount({ children, ...props }: ThemedTextProps & { children: string }) {
  const previous = useRef(children); const opacity = useSharedValue(1); const reduced = useReducedMotionPreference();
  useEffect(() => {
    if (previous.current !== children) {
      previous.current = children;
      opacity.value = reduced ? 1 : 0.6;
      opacity.value = withTiming(1, { duration: Motion.change, reduceMotion: ReduceMotion.System });
    }
  }, [children, opacity, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={style}><ThemedText {...props}>{children}</ThemedText></Animated.View>;
}
