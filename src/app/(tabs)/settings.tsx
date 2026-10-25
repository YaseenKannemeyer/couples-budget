import { Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useMyHousehold } from '@/features/household/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { SPLIT_MODES } from '@/lib/split';

export default function SettingsScreen() {
  const { session } = useSession();
  const { data } = useMyHousehold();
  if (!data) return null;
  const { household, me, partner } = data;
  const splitLabel = SPLIT_MODES.find((s) => s.mode === household.splitMode)?.label;

  return (
    <Screen withTabBar>
      {Platform.OS === 'web' && <View style={styles.webTabSpacer} />}
      <ThemedText type="subtitle">Settings</ThemedText>

      <Card>
        <ThemedText type="smallBold">Household</ThemedText>
        <Row label="Name" value={household.name} />
        <Row label="Partners" value={[me.displayName, partner?.displayName ?? 'Invite pending'].join(' & ')} />
        <Row label="Currency" value={household.baseCurrency} />
        <Row label="Timezone" value={household.timezone} />
        <Row label="How we split" value={splitLabel ?? household.splitMode} />
      </Card>

      <Card>
        <ThemedText type="smallBold">Account</ThemedText>
        <Row label="Email" value={session?.user.email ?? '—'} />
        <Button variant="secondary" title="Sign out" onPress={() => supabase.auth.signOut()} />
      </Card>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText themeColor="textSecondary">{label}</ThemedText>
      <ThemedText style={styles.value}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  webTabSpacer: {
    height: Spacing.six,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  value: {
    flexShrink: 1,
    textAlign: 'right',
  },
});
