import { StyleSheet, View } from 'react-native';
import { accentColor, Radius, TileSize } from '@/constants/theme';
import type { TileVisual } from '@/features/categories/visual';
import { useTheme } from '@/hooks/use-theme';
import { Icon } from './icon';

/** Decorative rounded-square tile; its row always carries the readable label. */
export function IconTile({ visual, size = TileSize, dimmed = false }: { visual: TileVisual; size?: number; dimmed?: boolean }) {
  const theme = useTheme();
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
    style={[styles.tile, { width: size, height: size, borderRadius: Math.round(size * 0.29) || Radius.tile,
      backgroundColor: accentColor(visual.family), opacity: dimmed ? 0.4 : 1 }]}>
    <View style={[StyleSheet.absoluteFill, styles.highlight, { borderRadius: Math.round(size * 0.29) }]} />
    <Icon name={visual.glyph} color={theme.tileGlyph} size={Math.round(size * 0.55)} />
  </View>;
}
const styles = StyleSheet.create({
  tile: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  highlight: { backgroundColor: '#FFFFFF', opacity: 0.08, bottom: '50%' },
});
