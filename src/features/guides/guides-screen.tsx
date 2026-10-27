import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useGuides } from './context';
import { guides } from './registry';

export function GuidesScreen() {
  const { t } = useTranslation(); const context = useGuides();
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('guides.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('guides.description')}</ThemedText>
    {context?.localError && <ThemedText accessibilityRole="alert" themeColor="attention">{t('guides.localError')}</ThemedText>}
    {context?.syncError && <ThemedText themeColor="textSecondary">{t('guides.syncError')}</ThemedText>}
    {(context?.localError || context?.syncError) && <Button title={t('common.tryAgain')} variant="secondary" onPress={() => context.retry()} />}
    {guides.filter(guide => !guide.entryOnly).map(guide => {
      const row = context?.rows[guide.id];
      const ended = row && ['completed', 'dismissed'].includes(row.status);
      return <View key={guide.id} style={{ gap: Spacing.two, paddingVertical: Spacing.three }}>
        <ThemedText type="section" accessibilityRole="header">{t(guide.title)}</ThemedText>
        <ThemedText themeColor="textSecondary">{t(guide.description)}</ThemedText>
        {row && <ThemedText type="small">{t(`guides.status.${row.status}`)}</ThemedText>}
        <Button title={t(ended ? 'guides.replay' : row ? 'guides.resume' : 'guides.show', { name: t(guide.title) })}
          variant="secondary" disabled={!context} onPress={() => context?.start(guide.id, !!ended)} />
      </View>;
    })}
    <Button title={t('guides.settings')} variant="ghost" onPress={() => router.replace('/settings')} />
  </Screen>;
}
