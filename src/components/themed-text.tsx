import { useContext } from 'react';
import { DisplayFontContext } from '@/components/ui/font-context';
import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, Type, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code' | 'amount' | 'section';
  themeColor?: ThemeColor;
};

const headings = new Set(['title', 'subtitle', 'section', 'amount']);

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  const displayLoaded = useContext(DisplayFontContext);

  const color = theme[themeColor ?? (type === 'linkPrimary' ? 'accent' : headings.has(type) ? 'heading' : 'text')];

  // Headings use the readable system face; the bundled display face is kept for large amounts only.
  return <Text style={[{ color, fontFamily: Fonts.sans, flexShrink: 1 }, styles[type],
    displayLoaded && type === 'amount' && { fontFamily: Fonts.display }, style]} {...rest} />;
}

const styles = StyleSheet.create({
  small: { ...Type.small, fontWeight: '400' },
  smallBold: { ...Type.small, fontWeight: '600' },
  default: { ...Type.body, fontWeight: '400' },
  title: { ...Type.display, fontWeight: '700', letterSpacing: -0.8 },
  subtitle: { ...Type.title, fontWeight: '700', letterSpacing: -0.5 },
  amount: { ...Type.display, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  section: { ...Type.section, fontWeight: '700', letterSpacing: -0.2 },
  link: { ...Type.small, lineHeight: 28 },
  linkPrimary: { ...Type.small, lineHeight: 28, fontWeight: '600' },
  code: { fontFamily: Fonts.mono, fontWeight: Platform.select({ android: '700' }) ?? '500', ...Type.caption },
});
