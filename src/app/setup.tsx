import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';

/** Shown to developers until the Supabase keys are in `.env.local`. */
export default function SetupScreen() {
  return (
    <Screen>
      <ThemedText type="subtitle">Connect {APP_NAME} to Supabase</ThemedText>
      <ThemedText themeColor="textSecondary">
        The app needs a Supabase project to store your household. This screen disappears once
        it&apos;s connected.
      </ThemedText>
      <Card>
        <Step n={1}>Create a free project at supabase.com.</Step>
        <Step n={2}>
          Copy <ThemedText type="code">.env.example</ThemedText> to{' '}
          <ThemedText type="code">.env.local</ThemedText> and paste in your project URL and
          publishable key (Project Settings → API).
        </Step>
        <Step n={3}>
          Run the SQL in <ThemedText type="code">supabase/migrations</ThemedText> on your project.
        </Step>
        <Step n={4}>Restart the dev server.</Step>
      </Card>
    </Screen>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <ThemedText style={styles.step}>
      <ThemedText type="smallBold" themeColor="accent">
        {n}.{' '}
      </ThemedText>
      {children}
    </ThemedText>
  );
}

const styles = StyleSheet.create({
  step: {
    marginBottom: Spacing.one,
  },
});
