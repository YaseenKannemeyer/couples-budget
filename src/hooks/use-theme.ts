/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { createContext, useContext } from 'react';

import { Palettes, type Space, type ThemeColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

/** Which space the current screen belongs to. Wrap private screens in `SpaceContext value="private"`. */
export const SpaceContext = createContext<Space>('shared');

export function useSpace() {
  return useContext(SpaceContext);
}

export function useTheme(): ThemeColors {
  const space = useSpace();
  const scheme = useColorScheme();
  return Palettes[space][scheme === 'dark' ? 'dark' : 'light'];
}
