import { StyleSheet } from 'react-native';
import { Trans, useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';

/** Shown to developers until the Supabase keys are in `.env.local`. */
export default function SetupScreen() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ThemedText type="subtitle">{t('setup.title', { appName: APP_NAME })}</ThemedText>
      <ThemedText themeColor="textSecondary">
        {t('setup.description')}
      </ThemedText>
      <Card>
        <Step n={1}>{t('setup.createProject')}</Step>
        <Step n={2}>
          <Trans i18nKey="setup.environment" components={{ code: <ThemedText type="code" /> }} />
        </Step>
        <Step n={3}>
          <Trans i18nKey="setup.migration" components={{ code: <ThemedText type="code" /> }} />
        </Step>
        <Step n={4}>{t('setup.restart')}</Step>
      </Card>
    </Screen>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  const { t } = useTranslation();
  return (
    <ThemedText style={styles.step}>
      <ThemedText type="smallBold" themeColor="accent">
        {t('setup.step', { number: n })}
      </ThemedText>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  step: {
    marginBottom: Spacing.one,
  },
});
