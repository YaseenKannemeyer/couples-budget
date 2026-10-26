import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryPickerProps } from './category-picker';
export function CategoryPicker({ label, value, options, disabled, onChange }: CategoryPickerProps) {
  const theme = useTheme();
  return <View style={{ gap: Spacing.two }}>
    <ThemedText type="smallBold">{label}</ThemedText>
    <select aria-label={label} value={value} disabled={disabled} onChange={event => onChange(event.target.value)}
      style={{ minHeight: 50, width: '100%', maxWidth: '100%', padding: 12, borderRadius: Radius.medium,
        backgroundColor: theme.backgroundElement, color: theme.text, border: `1px solid ${theme.border}`,
        fontSize: 16, fontFamily: Fonts.sans, opacity: disabled ? 0.55 : 1 }}>
      {options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  </View>;
}
