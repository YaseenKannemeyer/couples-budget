import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { MAX_BUDGET_MINOR } from '@/features/budget/schema';
import { useTheme } from '@/hooks/use-theme';
import { useFormatters } from '@/hooks/use-formatters';
import { minorUnitDigits } from '@/lib/money';
import { Icon } from './icon';
import { TextField } from './text-field';
export function AmountEntry({ label, currency, locale, value, onChange, disabled }: {
  label: string; currency: string; locale: string; value: string; onChange: (value: string) => void; disabled?: boolean;
}) {
  const { t } = useTranslation(); const theme = useTheme(); const format = useFormatters();
  const minor = parseBudgetAmount(value, currency, locale);
  const step = 10 ** minorUnitDigits(currency);
  const invalid = value.trim() !== '' && minor === null;
  const canDecrease = !disabled && !invalid && (minor ?? 0) >= step;
  const canIncrease = !disabled && !invalid && (minor ?? 0) <= MAX_BUDGET_MINOR - step;
  function adjust(direction: number) {
    if (invalid || disabled) return;
    const next = (minor ?? 0) + direction * step;
    if (Number.isSafeInteger(next) && next >= 0 && next <= MAX_BUDGET_MINOR) onChange(budgetAmountText(next, currency, locale));
  }
  return <View style={styles.group}>
    <ThemedText type="smallBold">{label}</ThemedText>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('design.decreaseAmount', { amount: format.money(step, currency) })}
        disabled={!canDecrease} accessibilityState={{ disabled: !canDecrease }}
        onPress={() => adjust(-1)} style={({ pressed }) => [styles.step, { backgroundColor: theme.backgroundSelected, opacity: !canDecrease ? 0.4 : pressed ? 0.7 : 1 }]}>
        <Icon name="minus" />
      </Pressable>
      <View style={styles.field}><TextField label={label} hideLabel accessibilityLabel={label} value={value} onChangeText={onChange}
        keyboardType="decimal-pad" editable={!disabled} placeholder={budgetAmountText(0, currency, locale)}
        style={{ ...Type.title, fontWeight: '700', textAlign: 'center', backgroundColor: theme.background, borderWidth: 0, paddingHorizontal: 0 }} />
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={t('design.increaseAmount', { amount: format.money(step, currency) })}
        disabled={!canIncrease} accessibilityState={{ disabled: !canIncrease }} onPress={() => adjust(1)}
        style={({ pressed }) => [styles.step, { backgroundColor: theme.accent, opacity: !canIncrease ? 0.4 : pressed ? 0.7 : 1 }]}>
        <Icon name="plus" color={theme.onAccent} />
      </Pressable>
    </View>
  </View>;
}
const styles = StyleSheet.create({ group: { gap: Spacing.two }, row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  step: { width: 48, height: 48, borderRadius: Radius.pill, alignItems: 'center', justifyContent: 'center' }, field: { flex: 1, minWidth: 0 } });
