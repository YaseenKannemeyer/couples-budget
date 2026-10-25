import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Palettes, Spacing } from '@/constants/theme';
import { useMyHousehold } from '@/features/household/api';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SessionProvider, useSession } from '@/hooks/use-session';
import { queryClient } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  const colors = Palettes.shared[scheme];
  const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navigationTheme: Theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.accent,
      background: colors.background,
      card: colors.background,
      text: colors.text,
      border: colors.border,
    },
  };

  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <ThemeProvider value={navigationTheme}>
          <RootNavigator />
        </ThemeProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

/**
 * Sends people to the right place: setup → sign in → create/join a household → the app.
 * Screens outside the current step can't be navigated to.
 */
function RootNavigator() {
  const { session, isLoading } = useSession();
  const household = useMyHousehold();

  const isSignedIn = !!session;
  const isReady = !isLoading && (!isSignedIn || !household.isPending);
  const hasHousehold = !!household.data;

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  if (isSignedIn && household.isError) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">We couldn&apos;t reach your household</ThemedText>
        <ThemedText themeColor="textSecondary">Check your connection and try again.</ThemedText>
        <Button title="Try again" onPress={() => household.refetch()} />
      </ThemedView>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isSupabaseConfigured}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={isSupabaseConfigured && !isSignedIn}>
        <Stack.Screen name="(auth)/sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !hasHousehold}>
        <Stack.Screen name="(onboarding)/household" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && hasHousehold}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
    gap: Spacing.three,
  },
});
