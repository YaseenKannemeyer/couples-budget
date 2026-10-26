import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { errorTranslationKey } from '@/i18n/errors';

export function CategoryLoading({ error, retry }: { error?: boolean; retry: () => void }) {
  const { t } = useTranslation();
  return <Screen>
    <ThemedText type="subtitle">{t(error ? 'categories.loadError' : 'categories.loading')}</ThemedText>
    {error && <Button title={t('common.tryAgain')} onPress={retry} />}
    <Button title={t('payments.home')} variant="ghost" onPress={() => router.replace('/')} />
  </Screen>;
}

export function CategoryError({ error, reload }: { error: unknown; reload?: () => void }) {
  const { t } = useTranslation();
  if (!error) return null;
  return <View style={styles.group}>
    <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(error))}</ThemedText>
    {reload && <>
      <ThemedText type="small" themeColor="textSecondary">{t('categories.reloadHint')}</ThemedText>
      <Button title={t('categories.reload')} variant="secondary" onPress={reload} />
    </>}
  </View>;
}

export function goBack() {
  if (router.canGoBack()) router.back(); else router.replace('/');
}

const styles = StyleSheet.create({ group: { gap: Spacing.two } });
