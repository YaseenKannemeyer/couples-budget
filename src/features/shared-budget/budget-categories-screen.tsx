import { GuideSlot } from '@/features/guides/guide-slot';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { BudgetLink } from '@/features/cashflow/plan-screens';
import { FlowLoading, useFlowData } from '@/features/cashflow/ui';

export function BudgetCategoriesScreen() {
  const { t } = useTranslation();
  const { household, query } = useFlowData();
  const [generation, setGeneration] = useState(0);
  if (!household || !query.data) return <FlowLoading error={query.isError} retry={() => query.refetch()} />;
  const h = household.household;
  const back = () => router.replace('/shared-budget');
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('sharedBudget.assign')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('sharedBudget.assignHint')}</ThemedText>
    {!query.isError && <GuideSlot target="budget-categories-intro" offer="budget-categories" />}
    {query.isError && <>
      <ThemedText accessibilityRole="alert" themeColor="attention">{t('sharedBudget.allocationRefreshError')}</ThemedText>
      <Button variant="secondary" title={t('common.tryAgain')} onPress={() => { void query.refetch(); }} />
    </>}
    {!query.data.budgets.length && <ThemedText themeColor="textSecondary">{t('sharedBudget.noCosts')}</ThemedText>}
    {!query.isError && <GuideSlot target={query.data.budgets.length ? 'budget-categories' : 'budget-categories-empty'} />}
    {query.data.budgets.map(line => <BudgetLink key={`${line.id}:${generation}`} data={query.data!}
      budget={line} householdId={h.id} currency={h.baseCurrency} timezone={h.timezone} onSaved={back} unassignedLabel={t('sharedBudget.unassignedOption')}
      onReload={() => { void query.refetch().then(result => { if (!result.isError) setGeneration(value => value + 1); }); }} />)}
    <Button variant="secondary" title={t('budget.review')} onPress={() => router.push('/(onboarding)/budget')} />
    <Button variant="ghost" title={t('sharedBudget.back')} onPress={back} />
  </Screen>;
}
