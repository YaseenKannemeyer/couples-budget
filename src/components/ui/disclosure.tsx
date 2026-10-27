import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Optional detail stays in the normal flow; collapsing never clears its state. */
export function Disclosure({ title, hint, initiallyOpen = false, children }: {
  title: string; hint?: string; initiallyOpen?: boolean; children: ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const theme = useTheme();
  return <View style={styles.group}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(value => !value)} style={({ pressed }) => [styles.trigger, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}>
      <ThemedText type="smallBold" themeColor="accent">{title}</ThemedText>
      {hint && <ThemedText type="small" themeColor="textSecondary">{hint}</ThemedText>}
    </Pressable>
    <View style={!open && styles.hidden} accessibilityElementsHidden={!open} importantForAccessibility={open ? 'auto' : 'no-hide-descendants'}>
      <View style={styles.content}>{children}</View>
    </View>
  </View>;
}
const styles = StyleSheet.create({ group: { gap: Spacing.two }, trigger: { minHeight: 48, justifyContent: 'center',
  gap: Spacing.one, paddingVertical: Spacing.two, borderTopWidth: StyleSheet.hairlineWidth },
  content: { gap: Spacing.three }, hidden: { display: 'none' } });
