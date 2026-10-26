import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleSheet, type PressableProps } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string; variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean;
};
export function Button({ title, variant = 'primary', loading, disabled, style, onPress, ...rest }: ButtonProps) {
  const theme = useTheme(); const reduced = useReducedMotionPreference();
  const isDisabled = disabled || loading;
  const background = { primary: theme.accent, secondary: theme.accentSoft, ghost: 'transparent' }[variant];
  const color = variant === 'primary' ? theme.onAccent : variant === 'secondary' ? theme.accent : theme.textSecondary;
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: !!isDisabled, busy: !!loading }} disabled={isDisabled}
    onPress={event => {
      if (Platform.OS !== 'web' && !reduced) void Haptics.selectionAsync().catch(() => undefined);
      onPress?.(event);
    }}
    style={state => [styles.button, { backgroundColor: background, opacity: isDisabled ? 0.55 : state.pressed ? 0.78 : 1 },
      state.pressed && !reduced && { transform: [{ scale: 0.985 }] }, typeof style === 'function' ? style(state) : style]}
    {...rest}>
    {loading ? <ActivityIndicator color={color} /> : <ThemedText type="smallBold" style={[styles.label, { color }]}>{title}</ThemedText>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 50, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, textAlign: 'center' },
});
