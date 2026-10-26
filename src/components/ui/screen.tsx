import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

/** Scrollable, keyboard-aware page with a comfortable reading width on desktop. */
export function Screen({ children, withTabBar = false }: { children: ReactNode; withTabBar?: boolean }) {
  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.container} edges={withTabBar ? ['top', 'left', 'right'] : ['top', 'left', 'right', 'bottom']}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              withTabBar && { paddingBottom: BottomTabInset + Spacing.six },
            ]}>
            {children}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.four,
    paddingBottom: Spacing.six + Spacing.five,
    gap: Spacing.four,
  },
});
