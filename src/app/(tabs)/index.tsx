import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { useMyHousehold, useRegenerateInviteCode } from '@/features/household/api';
import { formatInviteCode, type Household } from '@/features/household/schema';
import { errorTranslationKey } from '@/i18n/errors';
import { useCashflow } from '@/features/cashflow/api';
import { useHouseholdToday } from '@/features/payments/dates';
import { useHomeActivity } from '@/features/dashboard/api';
import { Dashboard } from '@/features/dashboard/dashboard';

export default function HomeScreen() {
  const household = useMyHousehold();
  const today = useHouseholdToday(household.data?.household.timezone ?? 'UTC');
  const cashflow = useCashflow(household.data?.household.id, today);
  const activity = useHomeActivity(household.data?.household.id, today);
  if (!household.data) return null;
  return <Dashboard household={household.data} workspace={cashflow.data} activity={activity.data}
    flowError={cashflow.isError} activityError={activity.isError}
    onRetryFlow={() => cashflow.refetch()} onRetryActivity={() => activity.refetch()}
    refreshing={cashflow.isFetching || activity.isFetching || household.isFetching}
    onRefresh={() => Promise.all([cashflow.refetch(), activity.refetch(), household.refetch()])}
    invite={<InviteCard household={household.data.household} />} />;
}

function InviteCard({ household }: { household: Household }) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const regenerate = useRegenerateInviteCode();
  const code = formatInviteCode(household.inviteCode);
  const message = t('invite.message', { appName: APP_NAME, code });

  async function share() {
    setActionFailed(false);
    try {
      if (Platform.OS === 'web' && !navigator.share) {
        await copy();
        return;
      }
      await Share.share({ message });
    } catch (error) {
      // Dismissing the web share dialog is an expected action.
      if (!(error instanceof Error && error.name === 'AbortError')) setActionFailed(true);
    }
  }

  async function copy() {
    setActionFailed(false);
    try {
      const didCopy = await Clipboard.setStringAsync(household.inviteCode);
      if (!didCopy) {
        setActionFailed(true);
        return;
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionFailed(true);
    }
  }

  return (
    <Card>
      <ThemedText type="smallBold">{t('invite.title')}</ThemedText>
      <ThemedText themeColor="textSecondary">
        {t('invite.description')}
      </ThemedText>
      <ThemedText type="subtitle" selectable style={styles.code}>
        {code}
      </ThemedText>
      <View style={styles.row}>
        <Button title={t('invite.share')} onPress={share} style={styles.flex} />
        <Button variant="secondary" title={t(copied ? 'invite.copied' : 'invite.copy')} onPress={copy} style={styles.flex} />
      </View>
      {actionFailed && <ThemedText themeColor="attention">{t('errors.generic')}</ThemedText>}
      {regenerate.error && (
        <ThemedText themeColor="attention">{t(errorTranslationKey(regenerate.error))}</ThemedText>
      )}
      <Button
        variant="ghost"
        title={t('invite.regenerate')}
        loading={regenerate.isPending}
        onPress={() => regenerate.mutate(household.id)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  code: {
    textAlign: 'center',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
