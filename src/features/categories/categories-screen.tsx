import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Choice, Choices } from '@/components/ui/choices';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useMyHousehold } from '@/features/household/api';
import { SpaceContext } from '@/hooks/use-theme';

import { useCategories, useCategoryAction } from './api';
import { categoryLabel, type Category } from './schema';
import { CategoryError, CategoryLoading, goBack } from './ui';

export function CategoriesScreen() {
  const { visibility } = useLocalSearchParams<{ visibility?: string }>();
  const { data } = useMyHousehold();
  const categories = useCategories(data?.household.id);
  if (!data || !categories.data || categories.isError) return <CategoryLoading error={categories.isError} retry={() => categories.refetch()} />;
  return <CategoriesView householdId={data.household.id} categories={categories.data} reload={() => categories.refetch()}
    initialVisibility={visibility === 'private' ? 'private' : 'shared'} />;
}

export function CategoriesView({ householdId, categories, reload, initialVisibility = 'shared' }: {
  householdId: string; categories: Category[]; reload: () => void; initialVisibility?: 'shared' | 'private';
}) {
  const { t } = useTranslation();
  const [space, setSpace] = useState<'shared' | 'private'>(initialVisibility);
  const [archived, setArchived] = useState(false);
  const action = useCategoryAction(householdId);
  const rows = categories.filter((category) => category.visibility === space && category.archived === archived);

  return <SpaceContext value={space}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('categories.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('categories.description')}</ThemedText>
    <Choices label={t('payments.visibility')}>
      {(['shared', 'private'] as const).map((value) => <Choice key={value} label={t(`payments.${value}`)} selected={space === value}
        disabled={action.isPending} onPress={() => setSpace(value)} />)}
    </Choices>
    {space === 'private' && <ThemedText type="small" themeColor="textSecondary">{t('categories.privateHint')}</ThemedText>}
    <Button title={t('categories.add')} disabled={action.isPending} onPress={() => router.push({ pathname: '/category', params: { visibility: space } })} />
    <Choices label={t('categories.show')}>
      <Choice label={t('categories.active')} selected={!archived} onPress={() => setArchived(false)} disabled={action.isPending} />
      <Choice label={t('payments.archived')} selected={archived} onPress={() => setArchived(true)} disabled={action.isPending} />
    </Choices>
    {!rows.length && <ThemedText themeColor="textSecondary">{t('categories.empty')}</ThemedText>}
    {rows.map((category, index) => <Card key={category.id}>
      <ThemedText type="smallBold">{categoryLabel(category)}</ThemedText>
      <ThemedText themeColor="textSecondary">{t(`categories.buckets.${category.bucket}`)}</ThemedText>
      <Button title={t('categories.edit')} variant="secondary" disabled={action.isPending}
        accessibilityLabel={t('categories.editName', { name: category.name })}
        onPress={() => router.push({ pathname: '/category', params: { id: category.id } })} />
      {!archived && <View style={styles.row}>
        <Button title={t('categories.moveUp')} variant="ghost" disabled={action.isPending || index === 0}
          accessibilityLabel={t('categories.moveUpName', { name: category.name })}
          onPress={() => action.mutate({ kind: 'move', id: category.id, version: category.version, direction: -1 })} />
        <Button title={t('categories.moveDown')} variant="ghost" disabled={action.isPending || index === rows.length - 1}
          accessibilityLabel={t('categories.moveDownName', { name: category.name })}
          onPress={() => action.mutate({ kind: 'move', id: category.id, version: category.version, direction: 1 })} />
      </View>}
    </Card>)}
    <CategoryError error={action.error} reload={() => { reload(); action.reset(); }} />
    <Button title={t('categories.back')} variant="ghost" disabled={action.isPending} onPress={goBack} />
  </Screen></SpaceContext>;
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two } });
