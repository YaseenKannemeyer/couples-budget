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
import { eligibleCategories, categoryLabel } from '@/features/categories/schema';
import { SpaceContext } from '@/hooks/use-theme';

import { usePaymentAction, type PaymentWorkspace } from './api';
import { householdToday } from './dates';
import { monthDate, nextMonth } from '@/features/cashflow/model';
import { useScheduleSource } from '@/features/quick-log/schedule-source';
import { paymentInput, type Schedule } from './schema';
import { Choice, Choices, PaymentError, PaymentLoading, usePaymentData } from './ui';

export function PaymentEditorScreen() {
  const { id, fromExpense, visibility: sourceVisibility } = useLocalSearchParams<{ id?: string; fromExpense?: string; visibility?: string }>();
  const { household, workspace } = usePaymentData();
  const source = useScheduleSource(household?.household.id, fromExpense, sourceVisibility);
  const { t } = useTranslation();
  const [generation, setGeneration] = useState(0);
  async function reload() {
    const result = await workspace.refetch();
    if (result.isSuccess) setGeneration((value) => value + 1);
  }
  if (!household || !workspace.data || workspace.isError) return <PaymentLoading error={workspace.isError} onRetry={reload} />;
  if (fromExpense && (!source.data || source.isError)) return <PaymentLoading error={source.isError} onRetry={() => source.refetch()} />;
  const initial = workspace.data.schedules.find((schedule) => schedule.id === id);
  if (id && (!initial || initial.status === 'completed')) return <Screen>
    <ThemedText>{t('payments.notFound')}</ThemedText>
    <Button title={t('payments.back')} onPress={() => router.replace('/payments')} />
  </Screen>;
  return <PaymentEditor key={`${id ?? 'new'}:${generation}`} initial={initial} household={household.household}
    me={household.me} members={household.members} workspace={workspace.data} reload={reload} defaultVisibility={sourceVisibility === 'private' ? 'private' : 'shared'}
    prefill={source.data ? { name: source.data.description.slice(0, 80), amount: source.data.amount_minor,
      category: source.data.category_id, note: source.data.note, payer: source.data.paid_by ?? household.me.userId,
      visibility: sourceVisibility === 'private' ? 'private' : 'shared',
      date: monthDate(nextMonth(householdToday(household.household.timezone).slice(0, 7)), Number(source.data.occurred_on.slice(8))) } : undefined} />;
}

export function PaymentEditor({ initial, household, me, members, workspace, reload, prefill, defaultVisibility = 'shared' }: {
  defaultVisibility?: 'shared' | 'private';
  prefill?: { name: string; amount: number; category: string; note: string | null; payer: string; visibility: 'shared' | 'private'; date: string };
  initial?: Schedule; household: Household; me: Member; members: Member[]; workspace: PaymentWorkspace; reload: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const deviceLocale = useLocales()[0]?.languageTag ?? 'en';
  const [locale] = useState(deviceLocale);
  const [baseline] = useState(initial);
  const [name, setName] = useState(initial?.name ?? prefill?.name ?? '');
  const [amount, setAmount] = useState(initial?.expectedAmountMinor != null
    ? budgetAmountText(initial.expectedAmountMinor, household.baseCurrency, locale) : prefill ? budgetAmountText(prefill.amount, household.baseCurrency, locale) : '');
  const [payerId, setPayerId] = useState(initial?.payerId ?? prefill?.payer ?? me.userId);
  const [visibility, setVisibility] = useState(initial?.visibility ?? prefill?.visibility ?? defaultVisibility);
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? prefill?.category ?? eligibleCategories(workspace.categories, initial?.visibility ?? prefill?.visibility ?? defaultVisibility, me.userId)[0]?.id ?? '');
  const [note, setNote] = useState(initial?.note ?? prefill?.note ?? '');
  const [recurrence, setRecurrence] = useState(initial?.recurrence ?? 'monthly');
  const [start, setStart] = useState(initial?.dueStart ?? prefill?.date ?? householdToday(household.timezone));
  const [end, setEnd] = useState(initial?.dueEnd ?? start);
  const [window, setWindow] = useState(initial?.dateMode === 'window');
  const [reminder, setReminder] = useState<number | null>(initial ? initial.reminderDaysBefore : 1);
  const [attempted, setAttempted] = useState(false);
  const action = usePaymentAction(household.id);
  const value = { name, expectedAmountMinor: amount.trim() ? parseBudgetAmount(amount, household.baseCurrency, locale) ?? Number.NaN : null,
    payerId: visibility === 'private' ? me.userId : payerId, visibility, categoryId, note: note.trim() || null,
    recurrence, dateMode: window ? 'window' : 'exact', dueStart: start, dueEnd: window ? end : start, reminderDaysBefore: reminder };
  const parsed = paymentInput.safeParse(value);
  const errors = parsed.success ? {} : parsed.error.flatten().fieldErrors;
  const categories = eligibleCategories(workspace.categories, visibility, me.userId);

  async function submit() {
    setAttempted(true);
    if (!parsed.success || action.isPending) return;
    try {
      await action.mutateAsync({ kind: 'save', id: baseline?.id ?? null, version: baseline?.version ?? null, value: parsed.data });
      router.replace('/payments');
    } catch { /* The mutation error is rendered below. */ }
  }

  return <SpaceContext value={visibility === 'private' ? 'private' : 'shared'}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t(baseline ? 'payments.edit' : 'payments.new')}</ThemedText>
    {prefill && <ThemedText themeColor="textSecondary">{t('quickLog.scheduleHint')}</ThemedText>}
    <Choices label={t('payments.visibility')}>
      {(['shared', 'private'] as const).map((space) => <Choice key={space} label={t(`payments.${space}`)} selected={visibility === space}
        disabled={action.isPending || !!baseline} onPress={() => {
          setVisibility(space);
          const eligible = eligibleCategories(workspace.categories, space, me.userId);
          if (!eligible.some((category) => category.id === categoryId)) setCategoryId(eligible[0]?.id ?? '');
        }} />)}
    </Choices>
    {visibility === 'private' && <ThemedText type="small" themeColor="textSecondary">{t('payments.privacyHint')}</ThemedText>}
    {baseline && <ThemedText type="small" themeColor="textSecondary">{t('payments.fixedType')}</ThemedText>}
    <TextField label={t('payments.name')} value={name} onChangeText={setName} maxLength={80} editable={!action.isPending}
      error={attempted && errors.name ? t('payments.invalidName') : undefined} />
    <TextField label={t('payments.expected', { currency: household.baseCurrency })} value={amount} onChangeText={setAmount}
      keyboardType="decimal-pad" editable={!action.isPending} hint={t('payments.variableHint')}
      error={attempted && errors.expectedAmountMinor ? t('payments.invalidAmount', { currency: household.baseCurrency }) : undefined} />
    {visibility === 'shared' && <Choices label={t('payments.payer')}>
      {members.map((member) => <Choice key={member.userId} label={member.displayName} selected={payerId === member.userId}
        disabled={action.isPending} onPress={() => setPayerId(member.userId)} />)}
    </Choices>}
    <Choices label={t('payments.category')}>
      {categories.map((category) => <Choice key={category.id}
        label={categoryLabel(category)} selected={categoryId === category.id} disabled={action.isPending} onPress={() => setCategoryId(category.id)} />)}
    </Choices>
    <Button title={t('categories.manage')} variant="ghost" disabled={action.isPending} onPress={() => router.push('/categories')} />
    <Choices label={t('payments.recurrence')}>
      {(['one_time', 'monthly'] as const).map((frequency) => <Choice key={frequency} label={t(`payments.${frequency}`)}
        selected={recurrence === frequency} disabled={action.isPending || !!baseline} onPress={() => setRecurrence(frequency)} />)}
    </Choices>
    <Choices label={t('payments.dateType')}>
      <Choice label={t('payments.exact')} selected={!window} disabled={action.isPending} onPress={() => setWindow(false)} />
      <Choice label={t('payments.window')} selected={window} disabled={action.isPending} onPress={() => {
        if (!window && end < start) setEnd(start);
        setWindow(true);
      }} />
    </Choices>
    <TextField label={t(window ? 'payments.dueStart' : 'payments.dueDate')} value={start} onChangeText={setStart}
      maxLength={10} autoCorrect={false} autoCapitalize="none" editable={!action.isPending} />
    {window && <TextField label={t('payments.dueEnd')} value={end} onChangeText={setEnd} maxLength={10}
      autoCorrect={false} autoCapitalize="none" editable={!action.isPending} />}
    <ThemedText type="small" themeColor="textSecondary">{t('payments.dateHint', { timezone: household.timezone })}</ThemedText>
    {baseline?.recurrence === 'monthly' && <ThemedText type="small" themeColor="textSecondary">
      {t('payments.monthlyAnchor', { startDay: baseline.anchorStartDay, endDay: baseline.anchorEndDay })}
    </ThemedText>}
    {attempted && (!parsed.success && (errors.dueStart || errors.dueEnd || parsed.error.flatten().formErrors.length > 0)) &&
      <ThemedText themeColor="attention">{t('payments.invalidDates')}</ThemedText>}
    <Choices label={t('payments.reminder')}>
      {[null, 0, 1, 3, 7].map((days) => <Choice key={String(days)} selected={reminder === days} disabled={action.isPending}
        label={t(days === null ? 'payments.noReminder' : days === 0 ? 'payments.onDueDate' : 'payments.daysBefore', { count: days ?? 0 })}
        onPress={() => setReminder(days)} />)}
    </Choices>
    <ThemedText type="small" themeColor="textSecondary">{t('payments.reminderHint', { timezone: household.timezone })}</ThemedText>
    <TextField label={t('payments.note')} value={note} onChangeText={setNote} maxLength={500} multiline
      editable={!action.isPending} style={{ minHeight: 100, paddingVertical: 16, textAlignVertical: 'top' }} />
    {attempted && !parsed.success && <ThemedText accessibilityRole="alert" themeColor="attention">{t('payments.checkFields')}</ThemedText>}
    <PaymentError error={action.error} reload={reload} />
    <Button title={t('payments.save')} loading={action.isPending} onPress={submit} />
    <Button title={t('payments.cancel')} variant="ghost" disabled={action.isPending} onPress={() => router.replace('/payments')} />
  </Screen></SpaceContext>;
}
