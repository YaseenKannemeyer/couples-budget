/** Couple Goals banking system: white/cool-grey surfaces, navy identity, one blue action accent. */
import '@/global.css';
import { Platform } from 'react-native';
/** Screen scope. Shared and Personal share one visual system; scope is always stated in words. */
export type Space = 'shared' | 'private';

/** Category/feature identity. Colour is identity only, never status. Glyph-on-tile contrast ≥ 3:1. */
export type AccentFamily = 'sky' | 'orange' | 'pink' | 'mint' | 'periwinkle' | 'slate';
export const AccentFamilies: AccentFamily[] = ['sky', 'orange', 'pink', 'mint', 'periwinkle', 'slate'];
const accents = {
  light: { sky: '#2B83D6', orange: '#D9730D', pink: '#D14FB1', mint: '#2E9A6E', periwinkle: '#5A68DC', slate: '#66778A' },
  dark: { sky: '#2B83D6', orange: '#D9730D', pink: '#D14FB1', mint: '#2E9A6E', periwinkle: '#5A68DC', slate: '#66778A' },
} as const;

const light = {
  text: '#243746', textSecondary: '#526574', heading: '#102A43', background: '#FFFFFF',
  backgroundElement: '#F4F6F8', backgroundSelected: '#E6EBF0', border: '#DCE3EA',
  accent: '#175CD3', accentSoft: '#EAF1FD', onAccent: '#FFFFFF',
  primary: '#102A43', onPrimary: '#FFFFFF',
  attention: '#B54708', success: '#067647',
  hero: '#102A43', heroText: '#FFFFFF', heroSecondary: '#C9D6E3', heroTrack: '#2A4663',
  heroAccent: '#8FC0FF', heroAttention: '#FFC48A',
  tileGlyph: '#FFFFFF', chartTrack: '#E6EBF0',
  categoryOrange: '#FDEBD8', categoryBlue: '#E2EEFB', categoryPink: '#FAE3F4', categoryGreen: '#DFF2E9',
  chartOrange: accents.light.orange, chartBlue: accents.light.sky, chartPink: accents.light.pink, chartGreen: accents.light.mint,
  scrim: '#00000070',
};
const dark: typeof light = {
  text: '#E8EEF4', textSecondary: '#A3B3C2', heading: '#F4F7FA', background: '#0B1622',
  backgroundElement: '#14212E', backgroundSelected: '#1C2E40', border: '#2A3D50',
  accent: '#7AB0FF', accentSoft: '#1B2F4A', onAccent: '#0B1622',
  primary: '#2E6AD1', onPrimary: '#FFFFFF',
  attention: '#F7B27A', success: '#75D6A6',
  hero: '#18324E', heroText: '#FFFFFF', heroSecondary: '#C9D6E3', heroTrack: '#2D4D6E',
  heroAccent: '#8FC0FF', heroAttention: '#FFC48A',
  tileGlyph: '#FFFFFF', chartTrack: '#1C2E40',
  categoryOrange: '#3A2A1A', categoryBlue: '#1A2E45', categoryPink: '#3A2034', categoryGreen: '#173528',
  chartOrange: accents.dark.orange, chartBlue: accents.dark.sky, chartPink: accents.dark.pink, chartGreen: accents.dark.mint,
  scrim: '#00000090',
};
/** `private` keeps its key for existing SpaceContext callers; the separate violet identity is retired. */
export const Palettes = {
  shared: { light, dark },
  private: { light, dark },
} as const;
export type ThemeColor = keyof typeof light;
export type ThemeColors = Record<ThemeColor, string>;
export function accentColor(family: AccentFamily, scheme: 'light' | 'dark' = 'light') {
  return accents[scheme][family];
}
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
  section: { fontSize: 18, lineHeight: 26 },
  title: { fontSize: 28, lineHeight: 36 },
  display: { fontSize: 40, lineHeight: 48 },
} as const;
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
export const Radius = { small: 10, medium: 12, large: 14, pill: 12, tile: 11 } as const;
export const Motion = { feedback: 120, change: 220, chart: 480 } as const;
export const Elevation = { card: { boxShadow: '0px 2px 8px #102A4314' } } as const;
export const BottomTabInset = Platform.select({ ios: 64, android: 80, web: 80 }) ?? 0;
/** Height reserved above the tab bar for the floating + Add expense button. */
export const ActionBarInset = 72;
export const TileSize = 38;
export const MaxContentWidth = 760;

/** Stable across reordering/renaming: derived from the category ID, never list position. */
export function familyForId(id: string): AccentFamily {
  const index = Array.from(id).reduce((sum, ch) => (sum * 31 + ch.charCodeAt(0)) % 9973, 7) % 5;
  return AccentFamilies[index];
}
/** Legacy helper retained for callers that still render pale tiles. */
export function categoryTone(id: string, theme: ThemeColors) {
  const family = familyForId(id);
  const background = { sky: theme.categoryBlue, orange: theme.categoryOrange, pink: theme.categoryPink,
    mint: theme.categoryGreen, periwinkle: theme.categoryBlue, slate: theme.backgroundSelected }[family];
  return { background, ink: accentColor(family) };
}
