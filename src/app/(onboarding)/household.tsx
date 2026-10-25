import { getCalendars, getLocales } from 'expo-localization';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useCreateHousehold, useJoinHousehold } from '@/features/household/api';
import { createHouseholdInput, joinHouseholdInput } from '@/features/household/schema';
import { supabase } from '@/lib/supabase';

type Path = 'start' | 'join';

export default function HouseholdScreen() {
  const [path, setPath] = useState<Path>('start');

  return (
    <Screen>
      <View style={styles.hero}>
        <ThemedText type="subtitle">Let&apos;s set up our space</ThemedText>
        <ThemedText themeColor="textSecondary">
          One of us starts the household, then invites the other with a code.
        </ThemedText>
      </View>

      <ThemedView type="backgroundElement" style={styles.segmented}>
        <Segment label="Start our household" selected={path === 'start'} onPress={() => setPath('start')} />
        <Segment label="Join my partner" selected={path === 'join'} onPress={() => setPath('join')} />
      </ThemedView>

      {path === 'start' ? <StartForm /> : <JoinForm />}

      <Button variant="ghost" title="Sign out" onPress={() => supabase.auth.signOut()} />
    </Screen>
  );
}

function StartForm() {
  const locale = getLocales()[0];
  const [displayName, setDisplayName] = useState('');
  const [name, setName] = useState('Our home');
  const [baseCurrency, setBaseCurrency] = useState(locale?.currencyCode ?? 'USD');
  const timezone = getCalendars()[0]?.timeZone ?? 'UTC';
  const create = useCreateHousehold();

  const parsed = createHouseholdInput.safeParse({ displayName, name, baseCurrency, timezone });
  const errors = parsed.success ? {} : parsed.error.flatten().fieldErrors;

  return (
    <Card>
      <TextField label="Your first name" value={displayName} onChangeText={setDisplayName} autoComplete="given-name" />
      <TextField label="Household name" value={name} onChangeText={setName} />
      <TextField
        label="Our currency"
        value={baseCurrency}
        onChangeText={setBaseCurrency}
        autoCapitalize="characters"
        maxLength={3}
        error={baseCurrency.length === 3 ? errors.baseCurrency?.[0] : undefined}
        hint={`Everything is tracked in this currency. Timezone: ${timezone}`}
      />
      {create.error && <ThemedText themeColor="attention">{create.error.message}</ThemedText>}
      <Button
        title="Create our household"
        disabled={!parsed.success}
        loading={create.isPending}
        onPress={() => create.mutate({ displayName, name, baseCurrency, timezone })}
      />
    </Card>
  );
}

function JoinForm() {
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const join = useJoinHousehold();
  const isValid = joinHouseholdInput.safeParse({ displayName, inviteCode }).success;

  return (
    <Card>
      <TextField label="Your first name" value={displayName} onChangeText={setDisplayName} autoComplete="given-name" />
      <TextField
        label="Invite code"
        value={inviteCode}
        onChangeText={setInviteCode}
        autoCapitalize="characters"
        autoCorrect={false}
        placeholder="ABCD-EFGH"
        hint="Your partner can find this on their home screen."
      />
      {join.error && <ThemedText themeColor="attention">{join.error.message}</ThemedText>}
      <Button
        title="Join household"
        disabled={!isValid}
        loading={join.isPending}
        onPress={() => join.mutate({ displayName, inviteCode })}
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
