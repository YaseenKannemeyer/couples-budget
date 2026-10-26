import { Host, Picker } from '@expo/ui';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { CategoryPickerProps } from './category-picker';
export function CategoryPicker({ label, value, options, disabled, onChange }: CategoryPickerProps) {
  const theme = useTheme();
  return <View style={{ gap: Spacing.two }}>
    <ThemedText type="smallBold">{label}</ThemedText>
    <View accessibilityLabel={label} style={{ minHeight: 48, padding: Spacing.two, borderRadius: Radius.medium, backgroundColor: theme.accentSoft }}>
      <Host seedColor={theme.accent} matchContents={{ vertical: true }} style={{ width: '100%', minHeight: 48 }}>
        <Picker testID="category-picker" selectedValue={value} onValueChange={onChange} enabled={!disabled}>
          {options.map(option => <Picker.Item key={option.id} label={option.label} value={option.id} />)}
        </Picker>
      </Host>
    </View>
  </View>;
}
