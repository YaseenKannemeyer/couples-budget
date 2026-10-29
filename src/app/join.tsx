import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import SignInScreen from '@/features/auth/sign-in-screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useMyHousehold } from '@/features/household/api';
import { GuideSlot } from '@/features/guides/guide-slot';
import { JoinHouseholdForm } from '@/features/household/join-form';
import { useSession } from '@/hooks/use-session';
import { isSupabaseConfigured } from '@/lib/supabase';

/** Kept outside auth guards so the invite URL survives sign-in/sign-up. */
export default function JoinScreen() {
  const { code } = useLocalSearchParams<{ code?: string | string[] }>();
  const { session, accountId, isLoading, isOffline, refresh } = useSession();
  const household = useMyHousehold();
  const { t } = useTranslation();
  if (!isSupabaseConfigured) return <Screen><ThemedText>{t('invite.setupRequired')}</ThemedText>
    <Button title={t('common.back')} onPress={() => router.replace('/setup')} /></Screen>;
  if (isLoading || session && household.isPending) return <Screen><ThemedText>{t('common.loading')}</ThemedText></Screen>;
  if (isOffline) return <Screen><ThemedText>{t('invite.onlineRequired')}</ThemedText>
    <Button title={t('common.tryAgain')} onPress={refresh} /></Screen>;
  if (!session) return <SignInScreen invited />;
  if (household.isError && !household.data) return <Screen><ThemedText>{t('errors.householdUnavailable')}</ThemedText>
    <Button title={t('common.tryAgain')} onPress={() => household.refetch()} /></Screen>;
  if (household.data) return <Screen><ThemedText>{t('invite.alreadyJoined')}</ThemedText>
    <Button title={t('invite.openHome')} onPress={() => router.replace('/')} /></Screen>;
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('invite.joinTitle')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('invite.joinHint')}</ThemedText>
    <GuideSlot target="household-start" />
    <JoinHouseholdForm key={`${accountId}:${typeof code === 'string' ? code : ''}`} initialCode={typeof code === 'string' ? code : ''} />
    <Button variant="ghost" title={t('common.back')} onPress={() => router.replace('/household')} />
  </Screen>;
}
