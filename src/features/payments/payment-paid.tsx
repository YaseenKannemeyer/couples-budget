import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard } from 'react-native';

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
import { PaymentReceipt, type PaidReceipt } from './payment-receipt';
import { Choice, Choices, dueLabel, PaymentError, PaymentLoading, usePaymentData } from './ui';

export function PaymentPaidScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { household, workspace } = usePaymentData();
  const { t } = useTranslation();
  const [generation, setGeneration] = useState(0);
  // A one-off schedule is archived by saving. Keep this session mounted while
  // mutation invalidation updates the workspace, including on refresh errors.
  const [recording, setRecording] = useState<{ id: string; schedule: Schedule; household: NonNullable<typeof household> } | null>(null);
  async function reload() {
    const result = await workspace.refetch();
    if (result.isSuccess) { setRecording(null); setGeneration((value) => value + 1); }
  }
  if (recording?.id === id) return <PaymentPaid key={`${id}:${generation}`} initial={recording.schedule}
    household={recording.household.household} members={recording.household.members} reload={reload} />;
  if (!household || !workspace.data || workspace.isError) return <PaymentLoading error={workspace.isError} onRetry={reload} />;
  const schedule = workspace.data.schedules.find((row) => row.id === id);
  if (!schedule || schedule.status !== 'active') return <Screen>
    <ThemedText>{t('payments.notFound')}</ThemedText>
    <Button title={t('payments.back')} onPress={() => router.replace('/payments')} />
  </Screen>;
  return <PaymentPaid key={`${id}:${generation}`} initial={schedule} household={household.household} members={household.members} reload={reload}
    onRecording={() => setRecording({ id, schedule, household })} />;
}

export function PaymentPaid({ initial, household, members, reload, onRecording }: {
  initial: Schedule; household: Household; members: Member[]; reload: () => Promise<void>; onRecording?: () => void;
}) {
  const { t } = useTranslation();
  const [locale] = useState(useLocales()[0]?.languageTag ?? 'en');
  const [baseline] = useState(initial);
  const [amount, setAmount] = useState(initial.estimateMinor === null ? '' : budgetAmountText(initial.estimateMinor, household.baseCurrency, locale));
  const [paidOn, setPaidOn] = useState(householdToday(household.timezone));
  const [paidBy, setPaidBy] = useState(initial.payerId);
  const [createTransaction, setCreateTransaction] = useState(true);
  const [attempted, setAttempted] = useState(false);
  const submitting = useRef(false);
  const [receipt, setReceipt] = useState<PaidReceipt | null>(null);
  const [recorded, setRecorded] = useState(false);
  const action = usePaymentAction(household.id);
  const value = { id: baseline.id, version: baseline.version, dueStart: baseline.dueStart,
    amountMinor: parseBudgetAmount(amount, household.baseCurrency, locale), paidOn, paidBy, createTransaction };
  const parsed = paidInput.safeParse(value);

  async function submit() {
    setAttempted(true);
    if (!parsed.success || action.isPending || submitting.current || recorded) return;
    submitting.current = true;
    Keyboard.dismiss();
    onRecording?.();
    setReceipt({ name: baseline.name, visibility: baseline.visibility, amountMinor: parsed.data.amountMinor,
      currency: household.baseCurrency, paidOn: parsed.data.paidOn, cycle: dueLabel(baseline, locale),
      payer: members.find(member => member.userId === parsed.data.paidBy)?.displayName ?? t('common.unknown'),
      createTransaction: parsed.data.createTransaction });
    try {
      await action.mutateAsync({ kind: 'paid', value: parsed.data });
      setRecorded(true);
    } catch { setReceipt(null); /* Keep the form values and translated error. */ }
    finally { submitting.current = false; }
  }

  if (receipt) return <SpaceContext value={baseline.visibility === 'private' ? 'private' : 'shared'}>
    <Screen key="receipt"><PaymentReceipt receipt={receipt} recorded={recorded} locale={locale}
      onDone={() => router.replace('/payments')}
      onHistory={() => router.replace({ pathname: '/payment-history', params: { id: baseline.id } })} /></Screen>
  </SpaceContext>;

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
