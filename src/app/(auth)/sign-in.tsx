import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(error.message);
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setError(error.message);
        else if (!data.session) setNotice('Check your inbox to confirm your email, then sign in.');
      }
    } finally {
      setLoading(false);
    }
  }

  const isSignUp = mode === 'signUp';

  return (
    <Screen>
      <View style={styles.hero}>
        <ThemedText type="smallBold" themeColor="accent">
          {APP_NAME}
        </ThemedText>
        <ThemedText type="subtitle">Money, together.</ThemedText>
        <ThemedText themeColor="textSecondary">
          One shared view of our life and goals, with room for each of us to breathe.
        </ThemedText>
      </View>

      <Card>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          textContentType={isSignUp ? 'newPassword' : 'password'}
          hint={isSignUp ? 'At least 8 characters' : undefined}
          onSubmitEditing={submit}
        />
        {error && <ThemedText themeColor="attention">{error}</ThemedText>}
        {notice && <ThemedText themeColor="success">{notice}</ThemedText>}
        <Button
          title={isSignUp ? 'Create account' : 'Sign in'}
          onPress={submit}
          loading={loading}
          disabled={!email || password.length < (isSignUp ? 8 : 1)}
        />
        <Button
          variant="ghost"
          title={isSignUp ? 'Already have an account? Sign in' : 'New here? Create an account'}
          onPress={() => {
            setMode(isSignUp ? 'signIn' : 'signUp');
            setError(null);
            setNotice(null);
          }}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: Spacing.two,
    paddingTop: Spacing.five,
  },
});
