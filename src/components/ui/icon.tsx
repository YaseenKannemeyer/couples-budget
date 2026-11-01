import { Platform } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/hooks/use-theme';
import { iconLayers, type IconName } from './icon-paths';
export type { IconName } from './icon-paths';
/** One rounded solid vector set on iOS, Android and web. Always decorative. */
export function Icon({ name, color, size = 22 }: { name: IconName; color?: string; size?: number }) {
  const theme = useTheme();
  const tint = color ?? theme.text;
  return <Svg width={size} height={size} viewBox="0 0 24 24" aria-hidden
    {...(Platform.OS === 'web' ? {} : { accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' as const })}>
    {iconLayers[name].map((layer, index) => layer.stroke
      ? <Path key={index} d={layer.d} fill="none" stroke={tint} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
      : <Path key={index} d={layer.d} fill={tint} fillRule={layer.rule ?? 'nonzero'} />)}
  </Svg>;
}
