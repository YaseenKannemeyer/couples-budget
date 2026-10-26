import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { Icon, type IconName } from './icon';
export function PillActions({ actions }: { actions: { label: string; icon: IconName; onPress: () => void }[] }) {
  const theme = useTheme(); const { fontScale } = useWindowDimensions();
  return <View style={[styles.band, { backgroundColor: theme.hero }]}><ScrollView showsHorizontalScrollIndicator contentContainerStyle={[styles.actions, fontScale > 1.2 && { flexDirection: 'column', flexGrow: 1 }]} horizontal={fontScale <= 1.2}>
    {actions.map(action => <Pressable key={action.label} accessibilityRole="button" accessibilityLabel={action.label} onPress={action.onPress}
      style={({ pressed }) => [styles.pill, fontScale > 1.2 && { maxWidth: '100%' }, { backgroundColor: theme.heroTrack, opacity: pressed ? 0.7 : 1 }]}>
      <Icon name={action.icon} color={theme.heroText} size={18} /><ThemedText type="smallBold" themeColor="heroText">{action.label}</ThemedText>
    </Pressable>)}
  </ScrollView></View>;
}
const styles = StyleSheet.create({ band: { borderRadius: Radius.large, overflow: 'hidden' }, actions: { padding: Spacing.three, gap: Spacing.two },
  pill: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, minHeight: 48, paddingVertical: Spacing.two, paddingHorizontal: Spacing.three, borderRadius: Radius.pill } });
