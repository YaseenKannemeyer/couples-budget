import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { GroupGap, ListRow, ListSection } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { DetailHeader } from '@/components/ui/screen-header';
import { Spacing } from '@/constants/theme';
import { featureVisual } from '@/features/categories/visual';
import { unregisterReminderDevice } from '@/features/nudges/api';
import { useMonthSplit } from '@/features/money-date/api';
import { useMyHousehold } from '@/features/household/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { InviteCard } from './invite-card';

/** Opened from the profile button. Household facts, setup shortcuts, help and account. */
export function SettingsScreen() {
  const { t } = useTranslation();
  const { session } = useSession();
  const { data } = useMyHousehold();
  const monthSplit = useMonthSplit(data?.household.id);
  if (!data) return null;
  const { household, me, partner } = data;

  return (
    <Screen>
      <DetailHeader title={t('banking.settings.title')} backLabel={t('banking.back')} />
      {!partner && <InviteCard household={household} />}

      <ListSection title={t('settings.household')}>
        <ListRow title={t('settings.name')} value={household.name} />
        <ListRow title={t('settings.partners')} value={t('common.partners', {
          first: me.displayName, second: partner?.displayName ?? t('settings.invitePending'),
        })} />
        <ListRow title={t('settings.currency')} value={household.baseCurrency} />
        <ListRow title={t('settings.timezone')} value={household.timezone} />
        <ListRow title={t('moneyDate.defaultSplit')} value={t(`split.${household.splitMode}.label`)} last={!monthSplit.data?.temporary} />
        {monthSplit.data?.temporary && <ListRow title={t('moneyDate.currentSplit')} value={t(`split.${monthSplit.data.mode}.label`)} last />}
        {monthSplit.isError && <ThemedText themeColor="attention" style={styles.note}>{t('moneyDate.loadError')}</ThemedText>}
      </ListSection>

      <GroupGap />
      <View>
        <ListRow title={t('banking.settings.budget')} subtitle={t(me.budgetCompletedAt ? 'budget.review' : 'budget.resume')}
          visual={featureVisual.budget} onPress={() => router.push('/budget')} />
        <ListRow title={t('banking.settings.categories')} visual={featureVisual.categories} onPress={() => router.push('/categories')} />
        <ListRow title={t('banking.settings.reminders')} visual={featureVisual.reminders} onPress={() => router.push('/reminders')} />
        <ListRow title={t('banking.settings.guides')} visual={featureVisual.guides} last onPress={() => router.push('/guides')} />
      </View>
      <ThemedText type="small" themeColor="textSecondary">{t('banking.settings.appearance')}</ThemedText>

      <ListSection title={t('settings.account')}>
        <ListRow title={t('common.email')} value={session?.user.email ?? t('common.unknown')} last />
      </ListSection>
      <Button variant="secondary" icon="signOut" title={t('common.signOut')} onPress={async () => { try { await unregisterReminderDevice(me.userId); } catch { /* Offline revocation retries when the installation is rebound. Push copy stays generic. */ } finally { await supabase.auth.signOut(); } }} />
    </Screen>
  );
}

const styles = StyleSheet.create({ note: { paddingTop: Spacing.two } });
