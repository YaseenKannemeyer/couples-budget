import { useState } from 'react';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { useBudgetSetup } from '@/features/budget/api';
import { BudgetWizard } from '@/features/budget/budget-wizard';
import { useMyHousehold } from '@/features/household/api';

export default function BudgetScreen() {
  const { t } = useTranslation();
  const household = useMyHousehold();
  const budget = useBudgetSetup(household.data?.household.id);
  const [generation, setGeneration] = useState(0);
  const [reloading, setReloading] = useState(false);

  async function reload() {
    setReloading(true);
    try {
      const result = await budget.refetch();
      if (result.isSuccess) setGeneration((value) => value + 1);
    } finally {
      setReloading(false);
    }
  }

  if (budget.isError) {
    return (
      <Screen>
        <ThemedText type="subtitle">{t('budget.loadError')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('errors.connectionHint')}</ThemedText>
        <Button title={t('common.tryAgain')} loading={reloading} onPress={reload} />
        <Button title={t('budget.later')} variant="ghost" onPress={() => router.replace('/')} />
      </Screen>
    );
  }
  if (!budget.data) return <Screen><ThemedText>{t('budget.loading')}</ThemedText></Screen>;

  return <BudgetWizard key={`${budget.data.me.userId}:${generation}`} data={budget.data} onReload={reload} reloading={reloading} />;
}
