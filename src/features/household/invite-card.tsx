import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import { useLocales } from 'expo-localization';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import { APP_NAME } from '@/constants/app';
import { Spacing } from '@/constants/theme';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { useFormatters } from '@/hooks/use-formatters';
import { errorTranslationKey } from '@/i18n/errors';
import { useMyHousehold, useRegenerateInviteCode, useSaveInviteAllowance } from './api';
import { formatInviteCode, type Household } from './schema';

export function InviteCard({ household }: { household: Household }) {
  const { t } = useTranslation();
  const format = useFormatters(household.timezone);
  const [copied, setCopied] = useState(false);
  const [actionFailed, setActionFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const regenerate = useRegenerateInviteCode();
  const code = formatInviteCode(household.inviteCode);
  const proposal = household.inviteAllowanceMinor;
  const message = t(proposal == null ? 'invite.linkMessage' : 'invite.giftMessage', {
    appName: APP_NAME, code, url: Linking.createURL('/join', { queryParams: { code: household.inviteCode } }),
  });

  async function share() {
    setActionFailed(false);
    setCopied(false);
    try {
      if (Platform.OS === 'web') {
        if (!navigator.share) {
          if (!await Clipboard.setStringAsync(message)) throw new Error('Clipboard unavailable');
          setCopied(true);
        } else await navigator.share({ text: message });
      } else await Share.share({ message });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) setActionFailed(true);
    }
  }

  async function copy() {
    setActionFailed(false);
    setCopied(false);
    try {
      if (!await Clipboard.setStringAsync(household.inviteCode)) throw new Error('Clipboard unavailable');
      setCopied(true);
    } catch { setActionFailed(true); }
  }

  return <Card>
    <ThemedText type="smallBold">{t('invite.title')}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('invite.soloHint')}</ThemedText>
    {proposal != null && <ThemedText>{t('invite.prepared', { amount: format.money(proposal, household.baseCurrency) })}</ThemedText>}
    <ThemedText type="small" themeColor="textSecondary">{t('invite.proposalHint')}</ThemedText>
    {editing ? <AllowanceProposal household={household} onDone={() => setEditing(false)} /> :
      <Button variant="secondary" title={t(proposal == null ? 'invite.prepare' : 'invite.editProposal')}
        disabled={regenerate.isPending} onPress={() => { setCopied(false); setEditing(true); }} />}
    <ThemedText type="subtitle" selectable style={styles.code}>{code}</ThemedText>
    <View style={styles.row}>
      <Button title={t('invite.share')} onPress={share} disabled={editing || regenerate.isPending} style={styles.flex} />
      <Button variant="secondary" title={t('invite.copy')} onPress={copy} disabled={editing || regenerate.isPending} style={styles.flex} />
    </View>
    {copied && <ThemedText accessibilityLiveRegion="polite" themeColor="success">{t('invite.copied')}</ThemedText>}
    {actionFailed && <ThemedText accessibilityRole="alert" themeColor="attention">{t('errors.generic')}</ThemedText>}
    {regenerate.error && <ThemedText themeColor="attention">{t(errorTranslationKey(regenerate.error))}</ThemedText>}
    <Button variant="ghost" title={t('invite.regenerate')} loading={regenerate.isPending} disabled={editing}
      onPress={() => { setCopied(false); regenerate.mutate(household.id); }} />
  </Card>;
}

function AllowanceProposal({ household, onDone }: { household: Household; onDone: () => void }) {
  const { t } = useTranslation();
  const [locale] = useState(useLocales()[0]?.languageTag ?? 'en');
  const [revision, setRevision] = useState(household.budgetRevision);
  const [amount, setAmount] = useState(household.inviteAllowanceMinor == null ? '' :
    budgetAmountText(household.inviteAllowanceMinor, household.baseCurrency, locale));
  const save = useSaveInviteAllowance();
  const latest = useMyHousehold();
  const parsed = amount.trim() === '' ? null : parseBudgetAmount(amount, household.baseCurrency, locale);
  const valid = amount.trim() === '' || parsed !== null && parsed <= 1_000_000_000_000;
  return <View style={styles.form}>
    <TextField label={t('invite.proposedAllowance', { currency: household.baseCurrency })} value={amount}
      onChangeText={setAmount} keyboardType="decimal-pad" editable={!save.isPending} hint={t('invite.optionalProposal')}
      error={!valid ? t('budget.invalidAmount', { currency: household.baseCurrency }) : undefined} />
    {save.error && <>
      <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(save.error))}</ThemedText>
      <Button variant="secondary" title={t('budget.reload')} disabled={save.isPending} onPress={async () => {
        const result = await latest.refetch();
        if (!result.isError && result.data) {
          const h = result.data.household;
          setRevision(h.budgetRevision);
          setAmount(h.inviteAllowanceMinor == null ? '' : budgetAmountText(h.inviteAllowanceMinor, h.baseCurrency, locale));
          save.reset();
        }
      }} />
    </>}
    <Button title={t('invite.saveProposal')} loading={save.isPending} disabled={!valid} onPress={async () => {
      try { await save.mutateAsync({ householdId: household.id, revision, amountMinor: parsed }); onDone(); }
      catch { /* Keep the draft and show the translated service error. */ }
    }} />
    <Button variant="ghost" title={t('common.cancel')} disabled={save.isPending} onPress={onDone} />
  </View>;
}

const styles = StyleSheet.create({
  code: { textAlign: 'center', letterSpacing: 4, fontVariant: ['tabular-nums'] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  flex: { flexGrow: 1, flexBasis: 140 },
  form: { gap: Spacing.two },
});
