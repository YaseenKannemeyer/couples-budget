import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { TextField } from './text-field';

export function CategoryFilter({ options, value, disabled, children }: {
  options: { id: string; label: string }[]; value: string; disabled?: boolean;
  children: (options: { id: string; label: string }[]) => ReactNode;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const matches = useMemo(() => options.filter(option => option.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())), [options, search]);
  const selected = options.find(option => option.id === value);
  // Searching never silently changes the saved selection or its visibility.
  const visible = selected && !matches.some(option => option.id === value) ? [selected, ...matches] : matches;
  return <>
    {options.length > 8 && <TextField label={t('phase18.categorySearch')} value={search} onChangeText={setSearch} editable={!disabled} autoCorrect={false} />}
    {children(options.length > 8 ? visible : options)}
    {options.length > 8 && search.trim() && matches.length === 0 && <ThemedText type="small" themeColor="textSecondary">{t('phase18.noCategories')}</ThemedText>}
  </>;
}
