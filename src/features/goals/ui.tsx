import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useMyHousehold } from '@/features/household/api';
import { useGoals, type useGoalAction } from './api';
import type { GoalAction } from './schema';
export function useGoalData() {
  const household = useMyHousehold();
  const query = useGoals(household.data?.household.id);
  return { household, query, error: household.isError || query.isError,
    refresh: async () => { await household.refetch(); await query.refetch(); } };
}
export function GoalLoading({ error, retry, unavailable }: { error?: boolean; retry: () => unknown; unavailable?: boolean }) {
  const { t } = useTranslation();
  return <Screen><ThemedText type="subtitle" accessibilityRole="header">{t('goals.title')}</ThemedText>
    <ThemedText accessibilityRole={error ? 'alert' : undefined}>{t(unavailable ? 'goals.unavailable' : error ? 'goals.loadError' : 'dashboard.loading')}</ThemedText>
    {error && <Button title={t('common.tryAgain')} onPress={retry} />}
    <Button title={t('payments.home')} variant="ghost" onPress={() => router.replace('/')} />
  </Screen>;
}
export type GoalMutation = ReturnType<typeof useGoalAction>;
export type GoalReview = { action: GoalAction; revision: number; label: string; details: { label: string; value: string }[] };
