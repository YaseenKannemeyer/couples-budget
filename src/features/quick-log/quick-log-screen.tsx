import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Choice, Choices } from '@/components/ui/choices';
import { Screen } from '@/components/ui/screen';
import { AmountEntry } from '@/components/ui/amount-entry';
import { CategoryPicker } from '@/components/ui/category-picker';
import { Sheet } from '@/components/ui/sheet';
import { TextField } from '@/components/ui/text-field';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { categoryLabel, eligibleCategories } from '@/features/categories/schema';
import type { Household, Member } from '@/features/household/schema';
import { householdToday, shiftCalendarDays, formatCalendarDate } from '@/features/payments/dates';
import { PaymentLoading, usePaymentData } from '@/features/payments/ui';
import type { PaymentWorkspace } from '@/features/payments/api';
import { useSession } from '@/hooks/use-session';
import { SpaceContext } from '@/hooks/use-theme';
import { errorTranslationKey } from '@/i18n/errors';
import { isValidCurrency } from '@/lib/money';
import { useQuickLogQueue } from './queue';
import { pickReceipt } from './receipt-picker';
import { deleteReceipt, saveReceipt } from './receipt-files';
import { quickLogInput, recordedRate, type QueuedLog } from './schema';

export function QuickLogScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { household, workspace } = usePaymentData();
  const { isOffline } = useSession();
  if (!household || !workspace.data) return <PaymentLoading error={workspace.isError} onRetry={() => workspace.refetch()} />;
  return <QuickLogEntry household={household.household} me={household.me} members={household.members}
    workspace={workspace.data} cached={workspace.isError || isOffline} editId={edit} />;
}
export function QuickLogEntry({ household, me, members, workspace, cached = false, editId }: {
  household: Household; me: Member; members: Member[]; workspace: PaymentWorkspace; cached?: boolean; editId?: string;
}) {
  const { t } = useTranslation(); const queue = useQuickLogQueue(household.id);
  const [edit] = useState(() => queue.entries.find(entry => entry.id === editId && entry.status === 'blocked' && !entry.result));
  const [space, setSpace] = useState<'shared' | 'private' | null>(edit?.values.visibility ?? null);
  if (editId && !edit) return <Screen><ThemedText>{t('quickLog.editUnavailable')}</ThemedText><Button title={t('quickLog.queue')} onPress={() => router.replace('/pending-logs')} /></Screen>;
  if (!space) return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t('quickLog.title')}</ThemedText>
    <ThemedText>{t('quickLog.chooseSpace')}</ThemedText>
    <Button title={t('payments.shared')} onPress={() => setSpace('shared')} />
    <SpaceContext value="private"><Button title={t('payments.private')} onPress={() => setSpace('private')} /></SpaceContext>
    {queue.error && <ThemedText accessibilityRole="alert" themeColor="attention">{t('quickLog.storageError')}</ThemedText>}
    <Button title={queue.error ? t('quickLog.queue') : t('quickLog.queueCount', { count: queue.entries.filter(entry => entry.status !== 'synced').length })} variant="secondary" onPress={() => router.push('/pending-logs')} />
    <Button title={t('common.cancel')} variant="ghost" onPress={() => router.back()} />
  </Screen>;
  return <QuickLogForm key={space} household={household} me={me} members={members} workspace={workspace}
    space={space} initial={edit} cached={cached} onChooseSpace={() => setSpace(null)} />;
}

type FormProps = { household: Household; me: Member; members: Member[]; workspace: PaymentWorkspace;
  space: 'shared' | 'private'; initial?: QueuedLog; cached: boolean; onChooseSpace: () => void };
export function QuickLogForm({ household, me, members, workspace, space, initial, cached, onChooseSpace }: FormProps) {
  const { t } = useTranslation(); const deviceLocale = useLocales()[0]?.languageTag ?? 'en'; const [locale] = useState(deviceLocale);
  const [id] = useState(() => initial?.id ?? randomUUID()); const queue = useQuickLogQueue(household.id);
  const [value] = useState(initial?.values);
  const categories = eligibleCategories(workspace.categories, space, me.userId);
  const schedules = workspace.schedules.filter(s => s.status === 'active' && s.visibility === space && (space === 'shared' || s.ownerId === me.userId));
  const [amount, setAmount] = useState(value && value.baseCurrency === household.baseCurrency ? budgetAmountText(value.amountMinor, household.baseCurrency, locale) : '');
  const [description, setDescription] = useState(value?.description ?? '');
  const [categoryId, setCategoryId] = useState(value?.categoryId ?? categories[0]?.id ?? '');
  const [frequency, setFrequency] = useState<'one_time' | 'monthly'>(value?.frequency ?? 'one_time');
  const [paidBy, setPaidBy] = useState(value?.paidBy ?? me.userId);
  const [on, setOn] = useState(value?.occurredOn ?? householdToday(household.timezone));
  const [note, setNote] = useState(value?.note ?? '');
  const [link, setLink] = useState(value?.scheduleId ?? '');
  const [linkSnapshot, setLinkSnapshot] = useState(value?.scheduleId ? { version: value.scheduleVersion!, due: value.scheduleDueStart! } : null);
  const [foreign, setForeign] = useState(!!value?.originalCurrency);
  const [currency, setCurrency] = useState(value?.originalCurrency ?? '');
  const [original, setOriginal] = useState(value?.originalAmountMinor && value.originalCurrency ? budgetAmountText(value.originalAmountMinor, value.originalCurrency, locale) : '');
  const [photo, setPhoto] = useState<string | null>(null); const [hasPhoto, setHasPhoto] = useState(value?.receipt ?? false);
  const [busy, setBusy] = useState(false); const [attempted, setAttempted] = useState(false); const [error, setError] = useState<unknown>(null);
  const [submitted, setSubmitted] = useState(false);
  const saved = submitted ? queue.entries.find(entry => entry.id === id) : undefined;
  const minor = parseBudgetAmount(amount, household.baseCurrency, locale);
  const originalMinor = foreign && isValidCurrency(currency) ? parseBudgetAmount(original, currency, locale) : null;
  const linked = schedules.find(s => s.id === link);
  const input = quickLogInput.safeParse({ baseCurrency: household.baseCurrency, visibility: space, amountMinor: minor, categoryId, description, note: note.trim() || null,
    frequency: linked?.recurrence ?? frequency, paidBy: space === 'private' ? me.userId : paidBy, occurredOn: on,
    originalCurrency: foreign ? currency : null, originalAmountMinor: foreign ? originalMinor : null,
    fxRate: foreign && minor && originalMinor ? recordedRate(minor, household.baseCurrency, originalMinor, currency) : null,
    scheduleId: link || null, scheduleVersion: linkSnapshot?.version ?? null, scheduleDueStart: linkSnapshot?.due ?? null, receipt: hasPhoto });
  const today = householdToday(household.timezone);
  const valid = input.success && on <= today && on >= shiftCalendarDays(today, -3660) && categories.some(c => c.id === categoryId) && (!link || !!linked);
  async function choosePhoto(camera: boolean) {
    setBusy(true); setError(null);
    try { const picked = await pickReceipt(camera); if (picked) { setPhoto(picked.uri); setHasPhoto(true); } }
    catch (err) { setError(err); } finally { setBusy(false); }
  }
  async function submit() {
    setAttempted(true); setError(null);
    if (!valid || !input.success || busy) return;
    setBusy(true);
    try {
      if (photo && hasPhoto) await saveReceipt(me.userId, household.id, id, photo);
      queue.enqueue(id, input.data);
      setSubmitted(true);
      if (!hasPhoto) void deleteReceipt(me.userId, household.id, id).catch(() => undefined);
    } catch (err) {
      if (photo && !initial) await deleteReceipt(me.userId, household.id, id).catch(() => undefined);
      setError(err);
    } finally { setBusy(false); }
  }
  if (saved) return <SpaceContext value={space}><Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{t(`quickLog.status.${saved.status}`)}</ThemedText>
    <ThemedText>{t(saved.status === 'synced' ? 'quickLog.savedHint' : saved.result ? 'quickLog.receiptPendingHint' : saved.status === 'blocked' ? 'quickLog.reviewHint' : 'quickLog.queuedHint')}</ThemedText>
    {saved.result && !saved.result.scheduleRef && <Button title={t('quickLog.scheduleAfter')} onPress={() => router.push({ pathname: '/payment', params: { fromExpense: saved.result!.transactionId, visibility: space } })} />}
    <Button title={t('quickLog.queue')} variant="secondary" onPress={() => router.replace('/pending-logs')} />
    <Button title={t('quickLog.done')} variant="ghost" onPress={() => router.back()} />
  </Screen></SpaceContext>;
  return <SpaceContext value={space}><Sheet title={t('quickLog.title')}
    cancel={{ label: t('common.cancel'), disabled: busy, onPress: () => router.back() }}
    save={{ label: t('quickLog.save'), loading: busy, onPress: submit }}>
    {attempted && !valid && <ThemedText accessibilityRole="alert" themeColor="attention">{t('quickLog.invalid')}</ThemedText>}
    <ThemedText type="smallBold">{t(`payments.${space}`)}</ThemedText>
    {space === 'private' && <ThemedText themeColor="textSecondary">{t('payments.privacyHint')}</ThemedText>}
    {value && value.baseCurrency !== household.baseCurrency && <ThemedText themeColor="attention">{t('quickLog.currencyChanged')}</ThemedText>}
    {cached && <ThemedText themeColor="attention">{t('quickLog.cached')}</ThemedText>}
    {queue.error && <ThemedText accessibilityRole="alert" themeColor="attention">{t('quickLog.storageError')}</ThemedText>}
    <AmountEntry label={t('quickLog.amount', { currency: household.baseCurrency })} currency={household.baseCurrency} locale={locale} value={amount} onChange={setAmount} disabled={busy} />
    <TextField label={t('quickLog.description')} value={description} onChangeText={setDescription} maxLength={120} editable={!busy} />
    <CategoryPicker label={t('payments.category')} value={categoryId} options={categories.map(c => ({ id: c.id, label: categoryLabel(c) }))} disabled={busy} onChange={setCategoryId} />
    {space === 'shared' && <Choices label={t('quickLog.paidBy')}>{members.map(m => <Choice key={m.userId} label={m.displayName} selected={paidBy === m.userId} disabled={busy} onPress={() => setPaidBy(m.userId)} />)}</Choices>}
    <TextField label={t('quickLog.date')} hint={t('cashflow.dateHint')} value={on} onChangeText={setOn} maxLength={10} editable={!busy} />
    <Choices label={t('quickLog.link')}>
      <Choice label={t('quickLog.noLink')} selected={!link} disabled={busy} onPress={() => { setLink(''); setLinkSnapshot(null); }} />
      {schedules.map(s => <Choice key={s.id} label={s.name} selected={link === s.id} disabled={busy} onPress={() => {
        setLink(s.id); setLinkSnapshot({ version: s.version, due: s.dueStart }); setFrequency(s.recurrence); setCategoryId(s.categoryId);
        if (!description.trim()) setDescription(s.name);
      }} />)}
    </Choices>
    {!!link && <ThemedText type="small" themeColor="textSecondary">{t('quickLog.linkHint', { date: linkSnapshot ? formatCalendarDate(linkSnapshot.due, locale) : '' })}</ThemedText>}
    <Choices label={t('expenses.frequency')}>{(['one_time', 'monthly'] as const).map(f => <Choice key={f} label={t(`payments.${f}`)} selected={(linked?.recurrence ?? frequency) === f} disabled={busy || !!link} onPress={() => setFrequency(f)} />)}</Choices>
    {!link && <ThemedText type="small" themeColor="textSecondary">{t('expenses.frequencyHint')}</ThemedText>}
    <TextField label={t('payments.note')} value={note} onChangeText={setNote} maxLength={500} multiline editable={!busy} />
    <Choices label={t('quickLog.currencyChoice')}>
      <Choice label={household.baseCurrency} selected={!foreign} disabled={busy} onPress={() => setForeign(false)} />
      <Choice label={t('quickLog.foreign')} selected={foreign} disabled={busy} onPress={() => setForeign(true)} />
    </Choices>
    {foreign && <>
      <ThemedText type="small" themeColor="textSecondary">{t('quickLog.foreignHint', { currency: household.baseCurrency })}</ThemedText>
      <TextField label={t('quickLog.originalCurrency')} value={currency} onChangeText={text => setCurrency(text.toUpperCase())} autoCapitalize="characters" maxLength={3} editable={!busy} />
      <TextField label={t('quickLog.originalAmount')} value={original} onChangeText={setOriginal} keyboardType="decimal-pad" editable={!busy} />
    </>}
    {photo && hasPhoto && <Image source={{ uri: photo }} contentFit="contain" cachePolicy="none" style={{ height: 180 }} accessibilityLabel={t('quickLog.photo')} />}
    {hasPhoto && <Button title={t('quickLog.removePhoto')} variant="ghost" disabled={busy} onPress={() => { setPhoto(null); setHasPhoto(false); }} />}
    <Button title={t(hasPhoto ? 'quickLog.replacePhoto' : 'quickLog.attachPhoto')} variant="secondary" disabled={busy} onPress={() => choosePhoto(false)} />
    {Platform.OS !== 'web' && <Button title={t('quickLog.camera')} variant="secondary" disabled={busy} onPress={() => choosePhoto(true)} />}
    <ThemedText type="small" themeColor="textSecondary">{t('quickLog.photoHint')}</ThemedText>
    {error != null && <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(error))}</ThemedText>}
    {!initial && <Button title={t('quickLog.changeSpace')} variant="ghost" disabled={busy} onPress={onChooseSpace} />}
  </Sheet></SpaceContext>;
}
