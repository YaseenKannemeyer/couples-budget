import { useCalendars, useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { GuideSlot } from '@/features/guides/guide-slot';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useCreateHousehold } from '@/features/household/api';
import { createHouseholdInput } from '@/features/household/schema';
import { errorTranslationKey } from '@/i18n/errors';
import { JoinHouseholdForm } from '@/features/household/join-form';
import { supabase } from '@/lib/supabase';

type Path = 'start' | 'join';

export default function HouseholdScreen() {
  const { t } = useTranslation();
  const [path, setPath] = useState<Path>('start');

  return (
    <Screen>
      <View style={styles.hero}>
        <ThemedText type="subtitle">{t('household.title')}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {t('household.description')}
        </ThemedText>
      </View>

      <GuideSlot target="household-start" />
      <ThemedView type="backgroundElement" style={styles.segmented}>
        <Segment label={t('household.start')} selected={path === 'start'} onPress={() => setPath('start')} />
        <Segment label={t('household.joinPartner')} selected={path === 'join'} onPress={() => setPath('join')} />
      </ThemedView>

      {path === 'start' ? <StartForm /> : <JoinHouseholdForm />}

      <Button variant="ghost" title={t('common.signOut')} onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

function StartForm() {
  const { t } = useTranslation();
  const locale = useLocales()[0];
  const [displayName, setDisplayName] = useState('');
  const [name, setName] = useState(() => t('household.defaultName'));
  const [baseCurrency, setBaseCurrency] = useState(locale?.currencyCode ?? 'USD');
  const timezone = useCalendars()[0]?.timeZone ?? 'UTC';
  const create = useCreateHousehold();

  const parsed = createHouseholdInput.safeParse({ displayName, name, baseCurrency, timezone });
  const errors = parsed.success ? {} : parsed.error.flatten().fieldErrors;

  return (
    <Card>
      <TextField label={t('household.firstName')} value={displayName} onChangeText={setDisplayName} autoComplete="given-name" />
      <TextField label={t('household.name')} value={name} onChangeText={setName} />
      <TextField
        label={t('household.currency')}
        value={baseCurrency}
        onChangeText={setBaseCurrency}
        autoCapitalize="characters"
        maxLength={3}
        error={baseCurrency.length === 3 && errors.baseCurrency ? t('validation.currency') : undefined}
        hint={t('household.currencyHint', { timezone })}
      />
      {create.error && <ThemedText themeColor="attention">{t(errorTranslationKey(create.error))}</ThemedText>}
      <Button
        title={t('household.create')}
        disabled={!parsed.success}
        loading={create.isPending}
        onPress={async () => {
          try {
            // Awaiting the mutation survives this form unmounting when the
            // household query refreshes and the protected route changes.
            await create.mutateAsync({ displayName, name, baseCurrency, timezone });
            router.replace('/budget');
          } catch {
            // The mutation exposes the translated error above.
          }
        }}
      />
    </Card>
  );
}

function Segment({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.segmentPressable}>
      <ThemedView type={selected ? 'background' : 'backgroundElement'} style={styles.segment}>
        <ThemedText type="smallBold" themeColor={selected ? 'text' : 'textSecondary'}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
  segmented: {
    flexDirection: 'row',
    padding: Spacing.one,
    borderRadius: Radius.medium,
  },
  segmentPressable: {
    flex: 1,
  },
  segment: {
    paddingVertical: Spacing.two,
    borderRadius: Radius.small,
    alignItems: 'center',
  },
});
