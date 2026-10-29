import { useContext, useEffect, useRef, type ComponentRef, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Card } from './card';
import { RevealInScreen } from './screen';

/** Reveal deliberate financial reviews without hiding the surrounding task. */
export function ActionReview({ title, children }: { title: string; children: ReactNode }) {
  const reveal = useContext(RevealInScreen);
  const panel = useRef<ComponentRef<typeof View>>(null);
  const heading = useRef<ComponentRef<typeof View>>(null);
  useEffect(() => {
    let focusFrame = 0;
    const frame = requestAnimationFrame(() => {
      if (Platform.OS === 'web') {
        (panel.current as unknown as HTMLElement | null)?.scrollIntoView({ block: 'start', behavior: 'auto' });
        (heading.current as unknown as HTMLElement | null)?.focus({ preventScroll: true });
      } else {
        if (panel.current) reveal(panel.current);
        focusFrame = requestAnimationFrame(() => { if (heading.current) AccessibilityInfo.sendAccessibilityEvent(heading.current, 'focus'); });
      }
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); };
  }, [reveal]);
  return <View ref={panel} onLayout={() => { if (Platform.OS !== 'web' && panel.current) reveal(panel.current); }}><Card>
    <View ref={heading} accessible accessibilityRole="header" accessibilityLabel={title} tabIndex={-1}>
      <ThemedText type="section">{title}</ThemedText>
    </View>
    {children}
  </Card></View>;
}
