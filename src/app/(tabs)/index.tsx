import * as Clipboard from 'expo-clipboard';
import { useState } from 'react';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { useMyHousehold, useRegenerateInviteCode } from '@/features/household/api';
import { formatInviteCode, type Household } from '@/features/household/schema';

export default function HomeScreen() {
  const { data } = useMyHousehold();
  if (!data) return null;
  const { household, me, partner } = data;

  return (
    <Screen withTabBar>
      {/* Leaves room for the floating web tab bar. */}
      {Platform.OS === 'web' && <View style={styles.webTabSpacer} />}

      <View style={styles.hero}>
        <ThemedText type="smallBold" themeColor="accent">
          {household.name}
        </ThemedText>
        <ThemedText type="subtitle">Hi {me.displayName} 👋</ThemedText>
      </View>

      {partner ? (
        <Card>
          <ThemedText type="smallBold">You&apos;re connected 💚</ThemedText>
          <ThemedText themeColor="textSecondary">
            You and {partner.displayName} now share this space. Anything either of you logs to the
            Shared Bucket shows up for both of you straight away.
          </ThemedText>
        </Card>
      ) : (
        <InviteCard household={household} />
      )}

      <Card>
        <ThemedText type="smallBold">Coming next</ThemedText>
        <ThemedText themeColor="textSecondary">
          Next we&apos;ll set our incomes, guilt-free allowances and the shared costs we cover
          together.
        </ThemedText>
      </Card>
    </Screen>
  );
}

function InviteCard({ household }: { household: Household }) {
  const [copied, setCopied] = useState(false);
  const regenerate = useRegenerateInviteCode();
  const code = formatInviteCode(household.inviteCode);
  const message = `Join our household on ${APP_NAME} with this code: ${code}`;

  async function share() {
    if (Platform.OS === 'web' && !navigator.share) {
      await copy();
      return;
    }
    await Share.share({ message });
  }

  async function copy() {
    await Clipboard.setStringAsync(household.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <ThemedText type="smallBold">Invite your partner</ThemedText>
      <ThemedText themeColor="textSecondary">
        They create an account, choose &quot;Join my partner&quot;, and type in this code.
      </ThemedText>
      <ThemedText type="subtitle" selectable style={styles.code}>
        {code}
      </ThemedText>
      <View style={styles.row}>
        <Button title="Share code" onPress={share} style={styles.flex} />
        <Button variant="secondary" title={copied ? 'Copied!' : 'Copy'} onPress={copy} style={styles.flex} />
      </View>
      <Button
        variant="ghost"
        title="Get a new code"
        loading={regenerate.isPending}
        onPress={() => regenerate.mutate(household.id)}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  webTabSpacer: {
    height: Spacing.six,
  },
  hero: {
    gap: Spacing.one,
    paddingTop: Spacing.four,
  },
  code: {
    textAlign: 'center',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
