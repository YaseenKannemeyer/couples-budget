import { SymbolView } from 'expo-symbols';
import { useTheme } from '@/hooks/use-theme';
const symbols = {
  wallet: { ios: 'wallet.bifold', android: 'account_balance_wallet', web: 'account_balance_wallet' },
  bill: { ios: 'doc.text', android: 'receipt_long', web: 'receipt_long' },
  income: { ios: 'arrow.down.left', android: 'south_west', web: 'south_west' },
  chart: { ios: 'chart.pie', android: 'pie_chart', web: 'pie_chart' },
  lock: { ios: 'lock', android: 'lock', web: 'lock' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  minus: { ios: 'minus', android: 'remove', web: 'remove' },
  home: { ios: 'house', android: 'home', web: 'home' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  arrow: { ios: 'arrow.up.right', android: 'north_east', web: 'north_east' },
} as const;
export type IconName = keyof typeof symbols;
export function Icon({ name, color, size = 22 }: { name: IconName; color?: string; size?: number }) {
  const theme = useTheme();
  return <SymbolView name={symbols[name]} tintColor={color ?? theme.text} size={size} weight="medium" accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />;
}
