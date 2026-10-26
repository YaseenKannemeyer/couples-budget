/** Couple Goals finance system. Shared indigo / Private violet; semantic roles in both appearances. */
import '@/global.css';
import { Platform } from 'react-native';
export type Space = 'shared' | 'private';

const light = {
  text: '#191B24', textSecondary: '#636675', background: '#F6F7FA',
  backgroundElement: '#FFFFFF', backgroundSelected: '#EBEDF5', border: '#DCE0EA',
  accent: '#465CF4', accentSoft: '#E9ECFF', onAccent: '#FFFFFF',
  attention: '#9A542F', success: '#267654',
  hero: '#191B24', heroText: '#FFFFFF', heroSecondary: '#BCC0D2', heroTrack: '#373B4D',
  heroAccent: '#8291FF', heroAttention: '#F0BA94',
  categoryOrange: '#FFF0DC', categoryBlue: '#E2EEFF', categoryPink: '#FBE5F5', categoryGreen: '#E0F3E9',
  chartOrange: '#C47A24', chartBlue: '#4385E7', chartPink: '#CA5BAD', chartGreen: '#31906B',
  scrim: '#00000070',
};
const dark = {
  text: '#F2F3FA', textSecondary: '#ADB2C5', background: '#10121A',
  backgroundElement: '#1C1F2B', backgroundSelected: '#2C3041', border: '#363B4E',
  accent: '#9CA9FF', accentSoft: '#2A3156', onAccent: '#151D47',
  attention: '#F0BA94', success: '#85D8B2',
  hero: '#202538', heroText: '#FFFFFF', heroSecondary: '#BCC0D2', heroTrack: '#3B425A',
  heroAccent: '#A2AEFF', heroAttention: '#F0BA94',
  categoryOrange: '#453321', categoryBlue: '#253A5A', categoryPink: '#442B40', categoryGreen: '#233F35',
  chartOrange: '#EFB363', chartBlue: '#78AFFF', chartPink: '#EE91D6', chartGreen: '#79CFAD',
  scrim: '#00000090',
};
export const Palettes = {
  shared: { light, dark },
  private: {
    light: { ...light, background: '#F7F6FC', accent: '#7050D5', accentSoft: '#EFE8FF',
      hero: '#242035', heroAccent: '#B59AFF' },
    dark: { ...dark, background: '#14121E', accent: '#C5AEFF', onAccent: '#2A194C',
      accentSoft: '#382B50', hero: '#2C2440', heroAccent: '#C5AEFF' },
  },
} as const;
export type ThemeColor = keyof typeof light;
export type ThemeColors = Record<ThemeColor, string>;
export const Fonts = {
  sans: Platform.select({ ios: 'System', web: 'system-ui', default: 'sans-serif' }),
  display: 'Manrope',
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }),
  rounded: Platform.select({ ios: 'System', default: 'sans-serif' }),
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};
export const Type = {
  caption: { fontSize: 13, lineHeight: 19 },
  small: { fontSize: 14, lineHeight: 21 },
  body: { fontSize: 16, lineHeight: 24 },
  section: { fontSize: 20, lineHeight: 28 },
  title: { fontSize: 30, lineHeight: 38 },
  display: { fontSize: 38, lineHeight: 48 },
} as const;
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { small: 12, medium: 18, large: 28, pill: 999 } as const;
export const Motion = { feedback: 120, change: 220, chart: 480 } as const;
export const Elevation = { card: { boxShadow: '0px 4px 16px #141B3810' } } as const;
export const BottomTabInset = Platform.select({ ios: 50, android: 80, web: 80 }) ?? 0;
export const MaxContentWidth = 760;

/** Stable across order changes; category hue is decorative, never a privacy signal. */
export function categoryTone(id: string, theme: ThemeColors) {
  const index = Array.from(id).reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4;
  return [
    { background: theme.categoryOrange, ink: theme.chartOrange },
    { background: theme.categoryBlue, ink: theme.chartBlue },
    { background: theme.categoryPink, ink: theme.chartPink },
    { background: theme.categoryGreen, ink: theme.chartGreen },
  ][index];
}
