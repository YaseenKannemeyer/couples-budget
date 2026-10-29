import { Platform, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SummaryRow } from '@/components/ui/summary-row';
import { Screen } from '@/components/ui/screen';
import { unregisterReminderDevice } from '@/features/nudges/api';
import { useMonthSplit } from '@/features/money-date/api';
import { useMyHousehold } from '@/features/household/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { data } = useMyHousehold();
  const monthSplit = useMonthSplit(data?.household.id);
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
        <Row label={t('moneyDate.defaultSplit')} value={splitLabel} />
        {monthSplit.data?.temporary && <Row label={t('moneyDate.currentSplit')} value={t(`split.${monthSplit.data.mode}.label`)} />}
        {monthSplit.isError && <ThemedText themeColor="attention">{t('moneyDate.loadError')}</ThemedText>}
        <Button title={t(me.budgetCompletedAt ? 'budget.review' : 'budget.resume')}
          variant="secondary" onPress={() => router.push('/budget')} />
        <Button title={t('categories.manage')} variant="secondary" onPress={() => router.push('/categories')} />
        <Button title={t('nudges.title')} variant="secondary" onPress={() => router.push('/reminders')} />
        <Button title={t('guides.title')} variant="secondary" onPress={() => router.push('/guides')} />
      </Card>

      <Card>
        <ThemedText type="section" accessibilityRole="header">{t('settings.account')}</ThemedText>
        <Row label={t('common.email')} value={session?.user.email ?? t('common.unknown')} />
        <Button variant="secondary" title={t('common.signOut')} onPress={async () => { try { await unregisterReminderDevice(me.userId); } catch { /* Offline revocation retries when the installation is rebound. Push copy stays generic. */ } finally { await supabase.auth.signOut(); } }} />
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
