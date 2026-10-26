import { useState } from 'react';
import type { ParseKeys } from 'i18next';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { errorTranslationKey } from '@/i18n/errors';
import { supabase } from '@/lib/supabase';

type Mode = 'signIn' | 'signUp';

export default function SignInScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<ParseKeys | null>(null);
  const [notice, setNotice] = useState<ParseKeys | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (loading) return;
    setError(null);
    setNotice(null);
    setLoading(true);
    try {
      if (mode === 'signIn') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) setError(errorTranslationKey(error));
      } else {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) setError(errorTranslationKey(error));
        else if (!data.session) setNotice('auth.confirmEmail');
      }
    } catch (error) {
      setError(errorTranslationKey(error));
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
        <ThemedText type="subtitle">{t('auth.title')}</ThemedText>
        <ThemedText themeColor="textSecondary">
          {t('auth.description')}
        </ThemedText>
      </View>

      <Card>
        <TextField
          label={t('common.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          label={t('auth.password')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete={isSignUp ? 'new-password' : 'current-password'}
          textContentType={isSignUp ? 'newPassword' : 'password'}
          hint={isSignUp ? t('auth.passwordHint') : undefined}
          onSubmitEditing={submit}
        />
        {error && <ThemedText themeColor="attention">{t(error)}</ThemedText>}
        {notice && <ThemedText themeColor="success">{t(notice)}</ThemedText>}
        <Button
          title={t(isSignUp ? 'auth.createAccount' : 'auth.signIn')}
          onPress={submit}
          loading={loading}
          disabled={!email || password.length < (isSignUp ? 8 : 1)}
        />
        <Button
          variant="ghost"
          title={t(isSignUp ? 'auth.switchToSignIn' : 'auth.switchToSignUp')}
          disabled={loading}
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
