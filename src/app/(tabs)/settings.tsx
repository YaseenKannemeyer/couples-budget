import { Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SummaryRow } from '@/components/ui/summary-row';
import { Screen } from '@/components/ui/screen';
import { useMyHousehold } from '@/features/household/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { data } = useMyHousehold();
  if (!data) return null;
  const { household, me, partner } = data;
  const splitLabel = t(`split.${household.splitMode}.label`);

  return (
    <Screen withTabBar>
      {Platform.OS === 'web' && <View style={styles.webTabSpacer} />}
      <ThemedText type="subtitle">{t('navigation.settings')}</ThemedText>

      <Card>
        <ThemedText type="section" accessibilityRole="header">{t('settings.household')}</ThemedText>
        <Row label={t('settings.name')} value={household.name} />
        <Row label={t('settings.partners')} value={t('common.partners', {
          first: me.displayName,
          second: partner?.displayName ?? t('settings.invitePending'),
        })} />
        <Row label={t('settings.currency')} value={household.baseCurrency} />
        <Row label={t('settings.timezone')} value={household.timezone} />
        <Row label={t('settings.split')} value={splitLabel} />
        <Button title={t(me.budgetCompletedAt ? 'budget.review' : 'budget.resume')}
          variant="secondary" onPress={() => router.push('/budget')} />
        <Button title={t('categories.manage')} variant="secondary" onPress={() => router.push('/categories')} />
      </Card>

      <Card>
        <ThemedText type="section" accessibilityRole="header">{t('settings.account')}</ThemedText>
        <Row label={t('common.email')} value={session?.user.email ?? t('common.unknown')} />
        <Button variant="secondary" title={t('common.signOut')} onPress={() => supabase.auth.signOut()} />
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <SummaryRow label={label} value={value} />;
}

const styles = StyleSheet.create({
  webTabSpacer: {
    height: 0,
  },
});
