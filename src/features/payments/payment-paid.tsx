import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import type { Household, Member } from '@/features/household/schema';
import { SpaceContext } from '@/hooks/use-theme';

import { usePaymentAction } from './api';
import { householdToday } from './dates';
import { paidInput, type Schedule } from './schema';
import { Choice, Choices, dueLabel, PaymentError, PaymentLoading, usePaymentData } from './ui';

export function PaymentPaidScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, workspace } = usePaymentData();
  const { t } = useTranslation();
  const [generation, setGeneration] = useState(0);
  async function reload() {
    const result = await workspace.refetch();
    if (result.isSuccess) setGeneration((value) => value + 1);
  }
  if (!household || !workspace.data || workspace.isError) return <PaymentLoading error={workspace.isError} onRetry={reload} />;
  const schedule = workspace.data.schedules.find((row) => row.id === id);
  if (!schedule || schedule.status !== 'active') return <Screen>
    <ThemedText>{t('payments.notFound')}</ThemedText>
    <Button title={t('payments.back')} onPress={() => router.replace('/payments')} />
  </Screen>;
  return <PaymentPaid key={`${id}:${generation}`} initial={schedule} household={household.household} members={household.members} reload={reload} />;
}

export function PaymentPaid({ initial, household, members, reload }: {
  initial: Schedule; household: Household; members: Member[]; reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [locale] = useState(useLocales()[0]?.languageTag ?? 'en');
  const [baseline] = useState(initial);
  const [amount, setAmount] = useState(initial.estimateMinor === null ? '' : budgetAmountText(initial.estimateMinor, household.baseCurrency, locale));
  const [paidOn, setPaidOn] = useState(householdToday(household.timezone));
  const [paidBy, setPaidBy] = useState(initial.payerId);
  const [createTransaction, setCreateTransaction] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const action = usePaymentAction(household.id);
  const value = { id: baseline.id, version: baseline.version, dueStart: baseline.dueStart,
    amountMinor: parseBudgetAmount(amount, household.baseCurrency, locale), paidOn, paidBy, createTransaction };
  const parsed = paidInput.safeParse(value);

  async function submit() {
    setAttempted(true);
    if (!parsed.success || action.isPending) return;
    try {
      await action.mutateAsync({ kind: 'paid', value: parsed.data });
      router.replace({ pathname: '/payment-history', params: { id: baseline.id } });
    } catch { /* The mutation retains the translated error. */ }
  }

  return <SpaceContext value={baseline.visibility === 'private' ? 'private' : 'shared'}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('payments.paidTitle')}</ThemedText>
    <ThemedText type="smallBold">{baseline.name}</ThemedText>
    <ThemedText themeColor="textSecondary">{t('payments.paidCycle', { date: dueLabel(baseline, locale) })}</ThemedText>
    <TextField label={t('payments.paidAmount', { currency: household.baseCurrency })} value={amount} onChangeText={setAmount}
      keyboardType="decimal-pad" editable={!action.isPending} error={attempted && (!value.amountMinor || value.amountMinor <= 0)
        ? t('payments.invalidAmount', { currency: household.baseCurrency }) : undefined} />
    <TextField label={t('payments.paidOn')} value={paidOn} onChangeText={setPaidOn} maxLength={10} autoCorrect={false}
      autoCapitalize="none" editable={!action.isPending}
      error={attempted && !parsed.success && parsed.error.flatten().fieldErrors.paidOn ? t('budget.invalidDate') : undefined} />
    {baseline.visibility === 'shared' && <Choices label={t('payments.actualPayer')}>
      {members.map((member) => <Choice key={member.userId} label={member.displayName} selected={paidBy === member.userId}
        disabled={action.isPending} onPress={() => setPaidBy(member.userId)} />)}
    </Choices>}
    <Choices label={t('payments.transactionHint')}>
      <Choice label={t('payments.createTransaction')} selected={createTransaction} disabled={action.isPending} onPress={() => setCreateTransaction(true)} />
      <Choice label={t('payments.recordOnly')} selected={!createTransaction} disabled={action.isPending} onPress={() => setCreateTransaction(false)} />
    </Choices>
    {attempted && !parsed.success && <ThemedText themeColor="attention" accessibilityRole="alert">{t('payments.checkFields')}</ThemedText>}
    <PaymentError error={action.error} reload={reload} />
    <Button title={t('payments.confirmPaid')} loading={action.isPending} onPress={submit} />
    <Button variant="ghost" title={t('payments.cancel')} disabled={action.isPending} onPress={() => router.replace('/payments')} />
  </Screen></SpaceContext>;
}
