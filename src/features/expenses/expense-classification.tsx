import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Choice, Choices } from '@/components/ui/choices';
import { Screen } from '@/components/ui/screen';
import { useCategories } from '@/features/categories/api';
import { categoryLabel, eligibleCategories, type Category } from '@/features/categories/schema';
import { CategoryError, CategoryLoading, goBack } from '@/features/categories/ui';
import { useMyHousehold } from '@/features/household/api';
import { SpaceContext } from '@/hooks/use-theme';

import { useClassifyExpense, useExpense } from './api';
import type { Expense } from './schema';

export function ExpenseClassificationScreen() {
  const params = useLocalSearchParams<{ id: string; visibility: string }>();
  const space = params.visibility === 'private' ? 'private' : 'shared';
  const { data } = useMyHousehold();
  const categories = useCategories(data?.household.id);
  const expense = useExpense(data?.household.id, space, params.id);
  const [generation, setGeneration] = useState(0);
  const { t } = useTranslation();
  async function reload() {
    const results = await Promise.all([categories.refetch(), expense.refetch()]);
    if (results.every((result) => result.isSuccess)) setGeneration((value) => value + 1);
  }
  if (!data || !categories.data || expense.data === undefined || categories.isError || expense.isError) return <CategoryLoading
    error={categories.isError || expense.isError} retry={reload} />;
  if (!expense.data) return <Screen><ThemedText>{t('errors.expenseUnavailable')}</ThemedText>
    <Button title={t('categories.back')} onPress={goBack} /></Screen>;
  return <ExpenseClassification key={`${params.id}:${generation}`} initial={expense.data} householdId={data.household.id}
    userId={data.me.userId} space={space} categories={categories.data} reload={reload} />;
}

export function ExpenseClassification({ initial, householdId, userId, space, categories, reload }: {
  initial: Expense; householdId: string; userId: string; space: 'shared' | 'private'; categories: Category[]; reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [baseline] = useState(initial);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [frequency, setFrequency] = useState(initial.frequency);
  const mutation = useClassifyExpense(householdId);
  const eligible = eligibleCategories(categories, space, userId);
  async function save() {
    if (!eligible.some((category) => category.id === categoryId) || mutation.isPending) return;
    try {
      await mutation.mutateAsync({ id: baseline.id, version: baseline.version, visibility: space, categoryId, frequency });
      router.replace({ pathname: '/expenses', params: { visibility: space } });
    } catch { /* The mutation retains a translated error and explicit reload. */ }
  }
  return <SpaceContext value={space}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('expenses.edit')}</ThemedText>
    <ThemedText type="smallBold">{baseline.description || t('expenses.untitled')}</ThemedText>
    <Choices label={t('payments.category')}>
      {eligible.map((category) => <Choice key={category.id} label={categoryLabel(category)} selected={categoryId === category.id}
        disabled={mutation.isPending} onPress={() => setCategoryId(category.id)} />)}
    </Choices>
    <Choices label={t('expenses.frequency')}>
      {(['one_time', 'monthly'] as const).map((value) => <Choice key={value} label={t(`payments.${value}`)} selected={frequency === value}
        disabled={mutation.isPending || !!baseline.scheduledPaymentRef} onPress={() => setFrequency(value)} />)}
    </Choices>
    <ThemedText type="small" themeColor="textSecondary">{t(baseline.scheduledPaymentRef ? 'expenses.linkedHint' : 'expenses.frequencyHint')}</ThemedText>
    <Button title={t('quickLog.photo')} variant="secondary" onPress={() => router.push({ pathname: '/receipt', params: { transactionId: baseline.id, visibility: space } })} />
    {space === 'shared' && <Button title={t('conversation.open')} variant="secondary"
      onPress={() => router.push({ pathname: '/expense-thread', params: { id: baseline.id } })} />}
    <CategoryError error={mutation.error} reload={reload} />
    <Button title={t('expenses.save')} onPress={save} loading={mutation.isPending} disabled={!eligible.some((category) => category.id === categoryId)} />
    <Button title={t('categories.back')} variant="ghost" disabled={mutation.isPending} onPress={goBack} />
  </Screen></SpaceContext>;
}
