import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SummaryRow } from '@/components/ui/summary-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { useFormatters } from '@/hooks/use-formatters';
import { errorTranslationKey } from '@/i18n/errors';
import { useInvitePreview, useJoinHousehold } from './api';
import { joinHouseholdInput, type InvitePreview } from './schema';

/** Reviewing a code is read-only. Membership needs a separate explicit action. */
export function JoinHouseholdForm({ initialCode = '' }: { initialCode?: string }) {
  const { t } = useTranslation();
  const [displayName, setDisplayName] = useState('');
  const [inviteCode, setInviteCode] = useState(initialCode);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const preview = useInvitePreview(selectedCode, attempt);
  const join = useJoinHousehold();
  const parsed = joinHouseholdInput.safeParse({ displayName, inviteCode });

  if (selectedCode && preview.data) return <InviteReview key={selectedCode} data={preview.data}
    code={selectedCode} displayName={displayName} join={join} onBack={() => { join.reset(); setSelectedCode(null); }} />;

  return <Card>
    <TextField label={t('household.firstName')} value={displayName} onChangeText={setDisplayName}
      editable={!selectedCode} autoComplete="given-name" />
    <TextField label={t('household.inviteCode')} value={inviteCode} onChangeText={setInviteCode}
      editable={!selectedCode} autoCapitalize="characters" autoCorrect={false}
      placeholder={t('household.invitePlaceholder')} hint={t('household.inviteHint')} />
    {preview.error && <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(preview.error))}</ThemedText>}
    <Button title={t('invite.review')} disabled={!parsed.success} loading={!!selectedCode && preview.isFetching}
      onPress={() => {
        if (!parsed.success) return;
        if (selectedCode === parsed.data.inviteCode) void preview.refetch();
        else { setAttempt(value => value + 1); setSelectedCode(parsed.data.inviteCode); }
      }} />
    {selectedCode && <Button variant="ghost" title={t('invite.changeCode')} onPress={() => setSelectedCode(null)} />}
  </Card>;
}

export function InviteReview({ data, code, displayName, join, onBack }: {
  data: InvitePreview; code: string; displayName: string;
  join: ReturnType<typeof useJoinHousehold>; onBack: () => void;
}) {
  const { t } = useTranslation();
  // Freeze the facts actually reviewed. A refetch must not silently replace
  // consent or an edited amount; a stale save asks for an explicit new review.
  const [review] = useState(data);
  const [locale] = useState(useLocales()[0]?.languageTag ?? 'en');
  const format = useFormatters();
  const [amount, setAmount] = useState(() => budgetAmountText(review.allowance_minor ?? 0, review.base_currency, locale));
  const [submitted, setSubmitted] = useState<Parameters<typeof join.mutateAsync>[0] | null>(null);
  const minor = parseBudgetAmount(amount, review.base_currency, locale);
  const valid = minor !== null && minor <= 1_000_000_000_000;
  async function submit() {
    if (!valid || join.isPending) return;
    const input = submitted ?? { inviteCode: code, displayName, revision: review.revision, allowanceMinor: minor };
    setSubmitted(input);
    try {
      await join.mutateAsync(input);
      router.replace('/budget');
    } catch { /* An uncertain retry keeps the exact reviewed request. */ }
  }
  return <Card>
    <ThemedText type="section" accessibilityRole="header">{t('invite.reviewTitle', { name: review.inviter_name })}</ThemedText>
    <ThemedText themeColor="textSecondary">{review.name}</ThemedText>
    <SummaryRow label={t('budget.splitTitle')} value={t(`split.${review.split_mode}.label`)} />
    <View style={{ gap: Spacing.two }}>
      <ThemedText type="smallBold">{t('invite.sharedPlan')}</ThemedText>
      {review.costs.length ? review.costs.map((cost, index) => <SummaryRow key={index}
        label={cost.name} value={format.money(cost.amount_minor, review.base_currency)} />) :
        <ThemedText themeColor="textSecondary">{t('invite.noCosts')}</ThemedText>}
    </View>
    <ThemedText themeColor="textSecondary">{t(review.allowance_minor === null ? 'invite.noProposal' : 'invite.acceptHint')}</ThemedText>
    <TextField label={t('invite.yourAllowance', { currency: review.base_currency })} value={amount}
      onChangeText={setAmount} editable={!join.isPending && !submitted} keyboardType="decimal-pad"
      error={!valid ? t('budget.invalidAmount', { currency: review.base_currency }) : undefined} />
    <ThemedText type="small" themeColor="textSecondary">{t('invite.privacyReview')}</ThemedText>
    {join.error && <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(join.error))}</ThemedText>}
    <Button title={t('invite.confirmJoin')} loading={join.isPending} disabled={!valid || !!join.error} onPress={submit} />
    {join.error && errorTranslationKey(join.error) !== 'errors.budgetChanged' &&
      <Button variant="secondary" title={t('common.tryAgain')} loading={join.isPending} onPress={submit} />}
    <Button variant="ghost" title={t(join.error ? 'invite.reviewAgain' : 'common.back')} disabled={join.isPending} onPress={onBack} />
  </Card>;
}
