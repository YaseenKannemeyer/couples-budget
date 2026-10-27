import { useContext, useEffect, useRef, type ComponentRef } from 'react';
import { AccessibilityInfo, Keyboard, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { RevealInScreen } from '@/components/ui/screen';
import { Radius, Spacing } from '@/constants/theme';
import { useGuides } from './context';
import { findGuide } from './registry';

/** An in-flow instruction sheet anchored immediately before the real control.
 * No scrim, blocked taps, coordinates or overlay can hide the task underneath it. */
export function GuideSlot({ target, offer }: { target: string; offer?: string }) {
  const context = useGuides();
  const { t } = useTranslation();
  const view = useRef<ComponentRef<typeof View>>(null);
  const entry = useRef<ComponentRef<typeof View>>(null);
  const heading = useRef<ComponentRef<typeof View>>(null);
  const reveal = useContext(RevealInScreen);
  const { width, height, fontScale } = useWindowDimensions();
  const activeGuide = context?.active ? findGuide(context.active) : undefined;
  const index = activeGuide?.steps.findIndex(step => step.id === context?.rows[activeGuide.id]?.step_id) ?? -1;
  const step = activeGuide?.steps[index];
  const preparing = step?.preparation?.target === target;
  const content = preparing ? step!.preparation! : step;
  const visible = !!context && (step?.target === target || preparing) && !!step?.paths.includes(context.path);
  const register = context?.register;
  useEffect(() => register?.(target), [register, target]);
  const instruction = visible ? `${t('guides.progress', { step: index + 1, total: activeGuide!.steps.length })}. ${t(content!.title)}. ${t(content!.body)}` : '';
  useEffect(() => {
    if (!visible) return;
    const show = () => { if (view.current) reveal(view.current); };
    const frame = requestAnimationFrame(show);
    const keyboard = Keyboard.addListener('keyboardDidShow', show);
    if (Platform.OS !== 'web') AccessibilityInfo.announceForAccessibility(instruction);
    return () => { cancelAnimationFrame(frame); keyboard.remove(); };
  }, [visible, instruction, reveal, width, height, fontScale]);
  useEffect(() => {
    if (!visible) return;
    const frame = requestAnimationFrame(() => { if (Platform.OS === 'web') heading.current?.focus(); });
    return () => cancelAnimationFrame(frame);
  }, [visible, instruction]);
  if (!context) return null;
  function returnToTask(change: () => void) {
    let next: HTMLElement | null = null;
    if (Platform.OS === 'web') {
      const node = (view.current ?? entry.current) as unknown as HTMLElement | null;
      let sibling = node?.nextElementSibling;
      const controls = 'button, input, select, textarea, [role="button"], [tabindex="0"]';
      while (sibling && !next) {
        next = (sibling.matches(controls) ? sibling : sibling.querySelector(controls)) as HTMLElement | null;
        sibling = sibling.nextElementSibling;
      }
    }
    change();
    if (Platform.OS === 'web') requestAnimationFrame(() => next?.focus({ preventScroll: true }));
    else AccessibilityInfo.announceForAccessibility(t('guides.closed'));
  }
  const notice = <>
    {context.localError && <ThemedText type="small" themeColor="attention" accessibilityRole="alert">{t('guides.localError')}</ThemedText>}
    {context.syncError && <ThemedText type="small" themeColor="textSecondary">{t('guides.syncError')}</ThemedText>}
  </>;
  if (visible) return <View ref={view} onAccessibilityEscape={() => returnToTask(() => context.close())}
    onLayout={() => { if (view.current) reveal(view.current); }}>
    <ThemedView type="backgroundElement" style={styles.sheet}>
      <View ref={heading} tabIndex={-1} accessibilityLabel={instruction} accessibilityLiveRegion="polite">
        <ThemedText type="small" themeColor="accent">{t('guides.progress', { step: index + 1, total: activeGuide!.steps.length })}</ThemedText>
        <ThemedText type="smallBold" accessibilityRole="header">{t(content!.title)}</ThemedText>
      </View>
      <ThemedText type="small" themeColor="textSecondary">{t(content!.body)}</ThemedText>
      <View style={styles.actions}>
        {index > 0 && <Button style={styles.control} title={t('guides.back')} variant="secondary" onPress={() => context.move(-1)} />}
        {!step!.action && <Button style={styles.control} title={t(index === activeGuide!.steps.length - 1 ? 'guides.finish' : 'guides.next')} onPress={() => context.move(1)} />}
        <Button style={styles.control} title={t('guides.skip')} variant="ghost" onPress={() => returnToTask(() => context.close('dismissed'))} />
        <Button style={styles.control} title={t('guides.close')} variant="ghost" onPress={() => returnToTask(() => context.close())} />
      </View>
      {notice}
    </ThemedView>
  </View>;
  const guide = offer ? findGuide(offer) : undefined;
  if (!guide || !context.ready || context.active || ['completed', 'dismissed'].includes(context.rows[guide.id]?.status)) return null;
  return <View ref={entry} style={styles.offer}>
    <View style={styles.actions}>
      <Button style={styles.control} title={t(context.rows[guide.id] ? 'phase18.resumeGuide' : 'phase18.screenGuide')} accessibilityLabel={t(context.rows[guide.id] ? 'guides.resume' : 'guides.show', { name: t(guide.title) })} variant="ghost" onPress={() => context.start(guide.id)} />
      <Button style={styles.control} title={t('guides.noThanks')} variant="ghost" onPress={() => returnToTask(() => context.dismiss(guide.id))} />
    </View>
    {notice}
  </View>;
}
const styles = StyleSheet.create({
  sheet: { padding: Spacing.three, borderRadius: Radius.medium, gap: Spacing.two },
  offer: { gap: Spacing.two },
  control: { minWidth: 48, minHeight: 48, paddingHorizontal: Spacing.two },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
