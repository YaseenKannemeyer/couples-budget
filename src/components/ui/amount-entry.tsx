import { StyleSheet, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Fonts, Spacing } from '@/constants/theme';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { MAX_BUDGET_MINOR } from '@/features/budget/schema';
import { useTheme } from '@/hooks/use-theme';
/** One large typed amount. No steppers: people enter what was actually charged. */
export function AmountEntry({ label, currency, locale, value, onChange, disabled }: {
  label: string; currency: string; locale: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const { t } = useTranslation(); const theme = useTheme();
  const minor = parseBudgetAmount(value, currency, locale);
  const invalid = value.trim() !== '' && (minor === null || minor > MAX_BUDGET_MINOR);
  return <View style={[styles.group, { borderBottomColor: theme.border }]}>
    <ThemedText type="small" themeColor="textSecondary">{label}</ThemedText>
    <TextInput accessibilityLabel={label} accessibilityHint={invalid ? t('validation.amount') : undefined}
      value={value} onChangeText={onChange} editable={!disabled} keyboardType="decimal-pad" inputMode="decimal"
      placeholder={budgetAmountText(0, currency, locale)} placeholderTextColor={theme.textSecondary}
      selectionColor={theme.accent} cursorColor={theme.accent}
      style={[styles.input, { color: theme.heading, opacity: disabled ? 0.55 : 1 }]} />
    {invalid && <ThemedText type="small" themeColor="attention">{t('validation.amount')}</ThemedText>}
  </View>;
}
const styles = StyleSheet.create({
  group: { gap: Spacing.one, paddingBottom: Spacing.two, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { fontFamily: Fonts.sans, fontSize: 40, lineHeight: 48, fontWeight: '700', fontVariant: ['tabular-nums'], paddingVertical: Spacing.one, minHeight: 56 },
});
