import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { CategoryRow } from '@/components/ui/category-row';
import { Choice, Choices } from '@/components/ui/choices';
import { Screen } from '@/components/ui/screen';
import { useCategories } from '@/features/categories/api';
import { categoryLabel } from '@/features/categories/schema';
import { CategoryLoading, goBack } from '@/features/categories/ui';
import { useMyHousehold } from '@/features/household/api';
import { formatCalendarDate } from '@/features/payments/dates';
import { useFormatters } from '@/hooks/use-formatters';
import { SpaceContext } from '@/hooks/use-theme';

import { useExpenses } from './api';

export function ExpensesScreen() {
  const { visibility } = useLocalSearchParams<{ visibility?: string }>();
  const { t } = useTranslation();
  const [space, setSpace] = useState<'shared' | 'private'>(visibility === 'private' ? 'private' : 'shared');
  const { data } = useMyHousehold();
  const categories = useCategories(data?.household.id);
  const expenses = useExpenses(data?.household.id, space);
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const format = useFormatters(data?.household.timezone);
  if (!data || !categories.data || !expenses.data || categories.isError || expenses.isError) return <CategoryLoading
    error={categories.isError || expenses.isError} retry={() => { void categories.refetch(); void expenses.refetch(); }} />;
  const rows = [...new Map(expenses.data.pages.flat().map((expense) => [expense.id, expense])).values()];
  return <SpaceContext value={space}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('expenses.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('expenses.description')}</ThemedText>
    <Choices label={t('payments.visibility')}>
      {(['shared', 'private'] as const).map((value) => <Choice key={value} label={t(`payments.${value}`)} selected={space === value}
        onPress={() => setSpace(value)} />)}
    </Choices>
    {!rows.length && <ThemedText themeColor="textSecondary">{t('expenses.empty')}</ThemedText>}
    {rows.map((expense) => {
      const category = categories.data.find((value) => value.id === expense.categoryId);
      return <CategoryRow key={expense.id} id={expense.categoryId ?? expense.id} name={expense.description || t('expenses.untitled')}
        emoji={category?.emoji} value={format.money(expense.amountMinor, data.household.baseCurrency)}>
        <ThemedText themeColor="textSecondary">{formatCalendarDate(expense.occurredOn, locale)}</ThemedText>
        <ThemedText>{category ? categoryLabel(category) : t('common.unknown')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{t(`payments.${expense.frequency}`)}</ThemedText>
        {expense.scheduledPaymentRef && <ThemedText type="small" themeColor="textSecondary">{t('expenses.linked')}</ThemedText>}
        {space === 'shared' && <Button title={t('conversation.open')} variant="ghost"
          onPress={() => router.push({ pathname: '/expense-thread', params: { id: expense.id } })} />}
        <Button title={t('expenses.edit')} variant="secondary"
          onPress={() => router.push({ pathname: '/expense-category', params: { id: expense.id, visibility: space } })} />
      </CategoryRow>;
    })}
    {expenses.hasNextPage && <Button title={t('expenses.loadMore')} variant="secondary" loading={expenses.isFetchingNextPage}
      onPress={() => expenses.fetchNextPage()} />}
    <Button title={t('categories.manage')} variant="secondary" onPress={() => router.push('/categories')} />
    <Button title={t('categories.back')} variant="ghost" onPress={goBack} />
  </Screen></SpaceContext>;
}
