import { useFonts } from 'expo-font';
import { DisplayFontContext } from '@/components/ui/font-context';
import { QueryClientProvider } from '@tanstack/react-query';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, type Theme } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Palettes, Spacing } from '@/constants/theme';
import { useMyHousehold } from '@/features/household/api';
import { QuickLogLauncher } from '@/features/quick-log/launcher';
import { useQuickLogSync } from '@/features/quick-log/queue';
import { usePaymentReminderSync } from '@/features/payments/reminders';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { SessionProvider, useSession } from '@/hooks/use-session';
import { LocalizationProvider } from '@/i18n/provider';
import { queryClient } from '@/lib/query-client';
import { isSupabaseConfigured } from '@/lib/supabase';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({ Manrope: require('../../assets/fonts/Manrope.ttf') });
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

  if (!fontsLoaded && !fontError) return null;

  return (
    <DisplayFontContext value={fontsLoaded}>
    <LocalizationProvider>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <ThemeProvider value={navigationTheme}>
            <RootNavigator />
          </ThemeProvider>
        </SessionProvider>
      </QueryClientProvider>
    </LocalizationProvider>
    </DisplayFontContext>
  );
}

/**
 * Sends people to the right place: setup → sign in → create/join a household → the app.
 * Screens outside the current step can't be navigated to.
 */
function RootNavigator() {
  const { t } = useTranslation();
  const { session, isLoading, isOffline } = useSession();
  const household = useMyHousehold();
  usePaymentReminderSync(household.data?.household);
  useQuickLogSync(household.data?.household.id);

  const isSignedIn = !!session;
  const isReady = !isLoading && (!isSignedIn || !household.isPending);
  const hasHousehold = !!household.data;

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  if (isSignedIn && household.isError && !household.data) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="subtitle">{t('errors.householdUnavailable')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('errors.connectionHint')}</ThemedText>
        <Button title={t('common.tryAgain')} onPress={() => household.refetch()} />
      </ThemedView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!isSupabaseConfigured}>
        <Stack.Screen name="setup" />
      </Stack.Protected>
      <Stack.Protected guard={isSupabaseConfigured && !isSignedIn && !isOffline}>
        <Stack.Screen name="(auth)/sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && !hasHousehold}>
        <Stack.Screen name="(onboarding)/household" />
      </Stack.Protected>
      <Stack.Protected guard={isSignedIn && hasHousehold}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(onboarding)/budget" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="payment" />
        <Stack.Screen name="payment-detail" />
        <Stack.Screen name="payment-paid" />
        <Stack.Screen name="payment-history" />
        <Stack.Screen name="categories" />
        <Stack.Screen name="category" />
        <Stack.Screen name="cash-flow" />
        <Stack.Screen name="cash-flow-setup" />
        <Stack.Screen name="budget-categories" />
        <Stack.Screen name="forecast-goal" />
        <Stack.Screen name="forecast-edit" />
        <Stack.Screen name="income" />
        <Stack.Screen name="income-entry" />
        <Stack.Screen name="receipt" />
        <Stack.Screen name="expenses" />
        <Stack.Screen name="expense-category" />
        <Stack.Screen name="expense-thread" />
      </Stack.Protected>
      <Stack.Protected guard={isOffline}>
        <Stack.Screen name="offline" />
      </Stack.Protected>
      <Stack.Protected guard={(isSignedIn || isOffline) && hasHousehold}>
        <Stack.Screen name="quick-log" options={{ presentation: 'formSheet', sheetAllowedDetents: [1], sheetGrabberVisible: false }} />
        <Stack.Screen name="pending-logs" options={{ presentation: 'formSheet', sheetAllowedDetents: [1], sheetGrabberVisible: false }} />
      </Stack.Protected>
    </Stack>
    {(isSignedIn || isOffline) && household.data && <QuickLogLauncher householdId={household.data.household.id} />}
    </View>
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
