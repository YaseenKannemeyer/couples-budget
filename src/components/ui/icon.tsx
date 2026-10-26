import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/hooks/use-theme';
/** Consistent, local vector fallback; iOS uses SF Symbols through expo-symbols. */
const paths = {
  wallet: 'M3 6h16v14H3V6Zm0 0V4h13v2m-2 6h7v5h-7v-5Zm3 2.5h.01',
  bill: 'M6 3h12v18l-3-2-3 2-3-2-3 2V3Zm3 5h6m-6 4h6',
  income: 'M18 6 6 18m0-9v9h9',
  chart: 'M12 3v9h9M9 4a9 9 0 1 0 11 11M15 3a9 9 0 0 1 6 6h-6V3Z',
  lock: 'M5 11h14v10H5V11Zm3 0V7a4 4 0 0 1 8 0v4m-4 4v2',
  plus: 'M12 5v14M5 12h14', minus: 'M5 12h14',
  home: 'm3 10 9-7 9 7m-16-1v12h5v-7h4v7h5V9',
  settings: 'm9 3-1 3-3 1-2 4 2 2 1 3 3 1 2 4 3-1 2-3 3-1 2-4-2-2-1-3-3-1-2-4-3 1Zm3 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z',
  arrow: 'M6 18 18 6M6 6h12v12',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name, color, size = 22 }: { name: IconName; color?: string; size?: number }) {
  const theme = useTheme();
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color ?? theme.text} strokeWidth={1.7}
    strokeLinecap="round" strokeLinejoin="round" aria-hidden {...(Platform.OS === 'web' ? {} : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}>
    <Path d={paths[name]} />
  </Svg>;
}
