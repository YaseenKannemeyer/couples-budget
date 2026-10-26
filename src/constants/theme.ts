/**
 * Design tokens. The app has two "spaces" that should feel different on purpose:
 *  - shared:  the household living room — soft sage, warm cream, forest green.
 *  - private: "my personal desk" — warmer paper tones and a clay accent.
 * There is deliberately no harsh red: overspending is flagged with a soft terracotta.
 */

import '@/global.css';

import { Platform } from 'react-native';

export type Space = 'shared' | 'private';

export const Palettes = {
  shared: {
    light: {
      text: '#2B2A26',
      textSecondary: '#6B665C',
      background: '#F7F3EC',
      backgroundElement: '#EFE8DC',
      backgroundSelected: '#E4DACA',
      border: '#E2D9C9',
      accent: '#2F5D50',
      accentSoft: '#C9D6C4',
      onAccent: '#FFFFFF',
      attention: '#98472C', // Warm clay with body-text contrast on the light surfaces.
      success: '#3C6247',
    },
    dark: {
      text: '#F2EDE3',
      textSecondary: '#B4AEA2',
      background: '#1C1F1C',
      backgroundElement: '#262A26',
      backgroundSelected: '#323732',
      border: '#343934',
      accent: '#8DB59F',
      accentSoft: '#3D5247',
      onAccent: '#14201B',
      attention: '#E0956F',
      success: '#8DB59F',
    },
  },
  private: {
    light: {
      text: '#2E2620',
      textSecondary: '#615448',
      background: '#F5EBDD',
      backgroundElement: '#ECDFCC',
      backgroundSelected: '#E0CFB6',
      border: '#E2D3BE',
      accent: '#87432B',
      accentSoft: '#EBCBB8',
      onAccent: '#FFFFFF',
      attention: '#7A4D20',
      success: '#3C6247',
    },
    dark: {
      text: '#F3E9DC',
      textSecondary: '#BBAA97',
      background: '#211B17',
      backgroundElement: '#2C241E',
      backgroundSelected: '#3A3028',
      border: '#3D332B',
      accent: '#E39B78',
      accentSoft: '#5A3A2C',
      onAccent: '#241610',
      attention: '#D9A55B',
      success: '#9CBF8E',
    },
  },
} as const;

export type ThemeColor = keyof typeof Palettes.shared.light;
export type ThemeColors = Record<ThemeColor, string>;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = {
  small: 10,
  medium: 16,
  large: 24,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
