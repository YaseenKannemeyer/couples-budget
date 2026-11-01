import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type PressableProps } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useReducedMotionPreference } from '@/hooks/use-reduced-motion';
import { Icon, type IconName } from './icon';
export type ButtonProps = Omit<PressableProps, 'children'> & {
  title: string; variant?: 'primary' | 'secondary' | 'ghost'; loading?: boolean; icon?: IconName;
};
/** Primary is navy, secondary is outlined blue, ghost is a blue text action. */
export function Button({ title, variant = 'primary', loading, disabled, style, onPress, icon, ...rest }: ButtonProps) {
  const theme = useTheme(); const reduced = useReducedMotionPreference();
  const isDisabled = disabled || loading;
  const background = { primary: theme.primary, secondary: theme.background, ghost: 'transparent' }[variant];
  const color = variant === 'primary' ? theme.onPrimary : theme.accent;
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: !!isDisabled, busy: !!loading }} disabled={isDisabled}
    onPress={event => {
      if (Platform.OS !== 'web' && !reduced) void Haptics.selectionAsync().catch(() => undefined);
      onPress?.(event);
    }}
    style={state => [styles.button, { backgroundColor: background, opacity: isDisabled ? 0.5 : state.pressed ? 0.82 : 1 },
      variant === 'secondary' && { borderWidth: 1, borderColor: theme.accent },
      state.pressed && !reduced && { transform: [{ scale: 0.985 }] }, typeof style === 'function' ? style(state) : style]}
    {...rest}>
    {loading ? <ActivityIndicator color={color} /> : <View style={styles.content}>
      {icon && <Icon name={icon} color={color} size={18} />}
      <ThemedText type="smallBold" style={[styles.label, { color }]}>{title}</ThemedText>
    </View>}
  </Pressable>;
}
const styles = StyleSheet.create({
  button: { minHeight: 50, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, flexShrink: 1 },
  label: { fontSize: 16, lineHeight: 22, textAlign: 'center' },
});
