import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Choice, Choices } from '@/components/ui/choices';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useMyHousehold } from '@/features/household/api';
import { SpaceContext } from '@/hooks/use-theme';

import { useCategories, useCategoryAction } from './api';
import { categoryInput, categoryLabel, replacementCategories, type Category } from './schema';
import { CategoryError, CategoryLoading, goBack } from './ui';

export function CategoryEditorScreen() {
  const { id, visibility } = useLocalSearchParams<{ id?: string; visibility?: string }>();
  const { data } = useMyHousehold();
  const categories = useCategories(data?.household.id);
  const [generation, setGeneration] = useState(0);
  const { t } = useTranslation();
  async function reload() {
    const result = await categories.refetch();
    if (result.isSuccess) setGeneration((value) => value + 1);
  }
  if (!data || !categories.data || categories.isError) return <CategoryLoading error={categories.isError} retry={reload} />;
  const initial = categories.data.find((category) => category.id === id);
  if (id && !initial) return <Screen><ThemedText>{t('errors.categoryUnavailable')}</ThemedText>
    <Button title={t('categories.back')} onPress={goBack} /></Screen>;
  return <CategoryEditor key={`${id ?? 'new'}:${generation}`} householdId={data.household.id} userId={data.me.userId}
    categories={categories.data} initial={initial} initialVisibility={visibility === 'private' ? 'private' : 'shared'} reload={reload} />;
}

export function CategoryEditor({ householdId, userId, categories, initial, initialVisibility = 'shared', reload }: {
  householdId: string; userId: string; categories: Category[]; initial?: Category;
  initialVisibility?: 'shared' | 'private'; reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [baseline] = useState(initial);
  const [name, setName] = useState(initial?.name ?? '');
  const [emoji, setEmoji] = useState(initial?.emoji ?? '');
  const [bucket, setBucket] = useState<Category['bucket']>(initial?.bucket ?? 'needs');
  const [space, setSpace] = useState(initial?.visibility ?? initialVisibility);
  const [attempted, setAttempted] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [replacementId, setReplacementId] = useState('');
  const action = useCategoryAction(householdId);
  const parsed = categoryInput.safeParse({ name, emoji: emoji.trim() || null, bucket, visibility: space });
  const replacements = baseline ? replacementCategories(categories, baseline, userId) : [];

  async function save() {
    setAttempted(true);
    if (!parsed.success || action.isPending) return;
    try {
      await action.mutateAsync({ kind: 'save', id: baseline?.id ?? null, version: baseline?.version ?? null, value: parsed.data });
      router.replace({ pathname: '/categories', params: { visibility: space } });
    } catch { /* The translated mutation error stays on screen. */ }
  }
  async function archive() {
    if (!baseline || !replacementId || action.isPending) return;
    try {
      await action.mutateAsync({ kind: 'archive', id: baseline.id, version: baseline.version, replacementId });
      router.replace({ pathname: '/categories', params: { visibility: space } });
    } catch { /* Reload is explicit, so unsaved choices aren't silently replaced. */ }
  }
  async function restore() {
    if (!baseline) return;
    try { await action.mutateAsync({ kind: 'restore', id: baseline.id, version: baseline.version });
      router.replace({ pathname: '/categories', params: { visibility: space } }); }
    catch { /* The translated mutation error stays on screen. */ }
  }

  return <SpaceContext value={space}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t(baseline ? 'categories.edit' : 'categories.add')}</ThemedText>
    <Choices label={t('payments.visibility')}>
      {(['shared', 'private'] as const).map((value) => <Choice key={value} label={t(`payments.${value}`)} selected={space === value}
        disabled={action.isPending || !!baseline} onPress={() => setSpace(value)} />)}
    </Choices>
    <ThemedText type="small" themeColor="textSecondary">{t(space === 'private' ? 'categories.privateHint' : 'categories.sharedHint')}</ThemedText>
    {baseline && <ThemedText type="small" themeColor="textSecondary">{t('categories.fixedVisibility')}</ThemedText>}
    <TextField label={t('categories.name')} value={name} onChangeText={setName} maxLength={40} editable={!action.isPending}
      error={attempted && (!name.trim() || name.trim().length > 40) ? t('categories.invalidName') : undefined} />
    <TextField label={t('categories.emoji')} value={emoji} onChangeText={setEmoji} editable={!action.isPending} autoCorrect={false}
      error={attempted && [...emoji].length > 16 ? t('categories.invalidEmoji') : undefined} hint={t('categories.emojiHint')} />
    <Choices label={t('categories.bucket')}>
      {(['needs', 'wants', 'savings'] as const).map((value) => <Choice key={value} label={t(`categories.buckets.${value}`)}
        selected={bucket === value} disabled={action.isPending} onPress={() => setBucket(value)} />)}
    </Choices>
    <ThemedText type="small" themeColor="textSecondary">{t('categories.bucketHint')}</ThemedText>
    {attempted && !parsed.success && <ThemedText accessibilityRole="alert" themeColor="attention">{t('categories.checkFields')}</ThemedText>}
    <CategoryError error={action.error} reload={reload} />
    <Button title={t('categories.save')} onPress={save} loading={action.isPending} />
    {baseline && !baseline.archived && !archiving && <Button title={t('categories.archive')} variant="secondary" disabled={action.isPending}
      onPress={() => setArchiving(true)} />}
    {baseline?.archived && <Button title={t('categories.restore')} variant="secondary" onPress={restore} disabled={action.isPending} />}
    {archiving && <Card>
      <ThemedText type="smallBold">{t('categories.archiveTitle')}</ThemedText>
      <ThemedText themeColor="textSecondary">{t('categories.archiveHint')}</ThemedText>
      {replacements.length > 0 ? <Choices label={t('categories.replacement')}>
        {replacements.map((category) => <Choice key={category.id} label={categoryLabel(category)} selected={replacementId === category.id}
          disabled={action.isPending} onPress={() => setReplacementId(category.id)} />)}
      </Choices> : <ThemedText>{t('categories.noReplacement')}</ThemedText>}
      <Button title={t('categories.confirmArchive')} disabled={!replacementId || action.isPending} onPress={archive} />
      <Button title={t('payments.cancel')} variant="ghost" disabled={action.isPending} onPress={() => setArchiving(false)} />
    </Card>}
    <Button title={t('categories.back')} variant="ghost" disabled={action.isPending} onPress={goBack} />
  </Screen></SpaceContext>;
}
