import { GuideSlot } from '@/features/guides/guide-slot';
import { useGuideAction } from '@/features/guides/context';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { useLocales } from 'expo-localization';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Choice, Choices } from '@/components/ui/choices';
import { IconTile } from '@/components/ui/icon-tile';
import { Segmented } from '@/components/ui/segmented';
import { Screen } from '@/components/ui/screen';
import { AmountEntry } from '@/components/ui/amount-entry';
import { CategoryPicker } from '@/components/ui/category-picker';
import { Sheet } from '@/components/ui/sheet';
import { TextField } from '@/components/ui/text-field';
import { Disclosure } from '@/components/ui/disclosure';
import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { isCalendarDate } from '@/features/budget/schema';
import { categoryLabel, eligibleCategories } from '@/features/categories/schema';
import type { Household, Member } from '@/features/household/schema';
import { householdToday, shiftCalendarDays, formatCalendarDate } from '@/features/payments/dates';
import { PaymentLoading, usePaymentData } from '@/features/payments/ui';
import type { PaymentWorkspace } from '@/features/payments/api';
import { useSession } from '@/hooks/use-session';
import { SpaceContext } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import { categoryVisual } from '@/features/categories/visual';
import { errorTranslationKey } from '@/i18n/errors';
import { isValidCurrency } from '@/lib/money';
import { useQuickLogQueue } from './queue';
import { pickReceipt } from './receipt-picker';
import { deleteReceipt, saveReceipt } from './receipt-files';
import { quickLogInput, recordedRate, type QueuedLog } from './schema';
import { preferredCategory, readLogPreference, rememberLogChoice } from './preferences';

export function QuickLogScreen() {
  const { edit, space } = useLocalSearchParams<{ edit?: string; space?: string }>();
  const { household, workspace } = usePaymentData();
  const { isOffline } = useSession();
  if (!household || !workspace.data) return <PaymentLoading error={workspace.isError} onRetry={() => workspace.refetch()} />;
  return <QuickLogEntry household={household.household} me={household.me} members={household.members}
    workspace={workspace.data} cached={workspace.isError || isOffline} editId={edit}
    requestedSpace={space === 'private' || space === 'shared' ? space : undefined} />;
}
/**
 * Scope is chosen on the form itself and always visible before saving. Personal entry passes
 * `requestedSpace`; elsewhere the account's last validated choice applies, then Shared.
 */
export function QuickLogEntry({ household, me, members, workspace, cached = false, editId, requestedSpace }: {
  household: Household; me: Member; members: Member[]; workspace: PaymentWorkspace; cached?: boolean; editId?: string;
  requestedSpace?: 'shared' | 'private';
}) {
  const { t } = useTranslation(); const queue = useQuickLogQueue(household.id);
  const [edit] = useState(() => queue.entries.find(entry => entry.id === editId && entry.status === 'blocked' && !entry.result));
  const [preference] = useState(() => readLogPreference(globalThis.localStorage, me.userId, household.id));
  if (editId && !edit) return <Screen><ThemedText>{t('quickLog.editUnavailable')}</ThemedText><Button title={t('quickLog.queue')} onPress={() => router.replace('/pending-logs')} /></Screen>;
  return <QuickLogForm household={household} me={me} members={members} workspace={workspace}
    space={edit?.values.visibility ?? requestedSpace ?? preference.lastSpace ?? 'shared'} initial={edit} cached={cached} />;
}

type FormProps = { household: Household; me: Member; members: Member[]; workspace: PaymentWorkspace;
  space: 'shared' | 'private'; initial?: QueuedLog; cached: boolean };
export function QuickLogForm({ household, me, members, workspace, space: initialSpace, initial, cached }: FormProps) {
  const [space, setSpace] = useState(initialSpace);
  const [details, setDetails] = useState(!!initial);
  const { t } = useTranslation(); const deviceLocale = useLocales()[0]?.languageTag ?? 'en'; const [locale] = useState(deviceLocale);
  const guideAction = useGuideAction();
  const [id] = useState(() => initial?.id ?? randomUUID()); const queue = useQuickLogQueue(household.id);
  const [value] = useState(initial?.values);
  const categories = eligibleCategories(workspace.categories, space, me.userId);
  const schedules = workspace.schedules.filter(s => s.status === 'active' && s.visibility === space && (space === 'shared' || s.ownerId === me.userId));
  const [amount, setAmount] = useState(value && value.baseCurrency === household.baseCurrency ? budgetAmountText(value.amountMinor, household.baseCurrency, locale) : '');
  const [description, setDescription] = useState(value?.description ?? '');
  const [categoryId, setCategoryId] = useState(value?.categoryId ?? preferredCategory(readLogPreference(globalThis.localStorage, me.userId, household.id)[space], categories));
  const [frequency, setFrequency] = useState<'one_time' | 'monthly'>(value?.frequency ?? 'one_time');
  const [paidBy, setPaidBy] = useState(value?.paidBy ?? me.userId);
  // Changing scope keeps amount and description; category, bill link and payer must be valid for the new scope.
  function chooseSpace(next: 'shared' | 'private') {
    if (next === space || initial) return;
    setSpace(next); guideAction('space-chosen');
    setCategoryId(preferredCategory(readLogPreference(globalThis.localStorage, me.userId, household.id)[next], eligibleCategories(workspace.categories, next, me.userId)));
    setLink(''); setLinkSnapshot(null); if (next === 'private') setPaidBy(me.userId);
  }
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
  const dateLabel = isCalendarDate(on) ? formatCalendarDate(on, locale) : t('budget.invalidDate');
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
      rememberLogChoice(globalThis.localStorage, me.userId, household.id, space, categoryId);
      // Saving confirms the visible scope, so a guide waiting on that choice can advance first.
      guideAction('space-chosen');
      guideAction('expense-queued');
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
  const selectedCategory = categories.find(c => c.id === categoryId);
  const payer = paidBy === me.userId ? null : members.find(member => member.userId === paidBy)?.displayName ?? t('common.unknown');
  const pendingCount = queue.entries.filter(entry => entry.status !== 'synced').length;
  return <SpaceContext value={space}><Sheet title={t('banking.log.title')}
    cancel={{ label: t('common.cancel'), disabled: busy, onPress: () => router.back() }}>
    {attempted && !valid && <ThemedText accessibilityRole="alert" themeColor="attention">{t('quickLog.invalid')}</ThemedText>}
    <GuideSlot target="log-space" offer="quick-log" />
    <View style={styles.scope}>
      <Segmented label={t('banking.log.scope')} value={space} disabled={busy || !!initial} onChange={chooseSpace}
        options={[{ value: 'shared', label: t('banking.log.shared') }, { value: 'private', label: t('banking.log.personal') }]} />
      <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>
        {t(space === 'shared' ? 'banking.log.sharedHint' : 'banking.log.personalHint')}</ThemedText>
      {!!initial && <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{t('banking.log.scopeLocked')}</ThemedText>}
    </View>
    {value && value.baseCurrency !== household.baseCurrency && <ThemedText themeColor="attention">{t('quickLog.currencyChanged')}</ThemedText>}
    {cached && <ThemedText themeColor="attention">{t('quickLog.cached')}</ThemedText>}
    {queue.error && <ThemedText accessibilityRole="alert" themeColor="attention">{t('quickLog.storageError')}</ThemedText>}
    <GuideSlot target="log-amount" />
    <AmountEntry label={t('banking.log.amount', { currency: household.baseCurrency })} currency={household.baseCurrency} locale={locale} value={amount} onChange={setAmount} disabled={busy} />
    <View style={styles.category}>
      {selectedCategory && <IconTile visual={categoryVisual(selectedCategory)} />}
      <View style={{ flex: 1 }}>
        <CategoryPicker label={t('banking.log.category')} value={categoryId} options={categories.map(c => ({ id: c.id, label: categoryLabel(c) }))} disabled={busy} onChange={setCategoryId} />
      </View>
    </View>
    <TextField label={t('quickLog.description')} value={description} onChangeText={setDescription} maxLength={120} editable={!busy} />
    <View style={styles.payer}>
      <ThemedText themeColor="textSecondary" style={{ flex: 1 }}>{space === 'shared' && payer
        ? t('banking.log.paidBy', { name: payer, date: dateLabel }) : t('banking.log.paidByYou', { date: dateLabel })}</ThemedText>
      <Pressable accessibilityRole="button" accessibilityLabel={t('banking.log.editLabel')} disabled={busy} hitSlop={6}
        onPress={() => setDetails(true)} style={({ pressed }) => [styles.edit, { opacity: pressed ? 0.6 : 1 }]}>
        <ThemedText themeColor="accent">{t('banking.log.edit')}</ThemedText>
      </Pressable>
    </View>
    {linked && <ThemedText type="small" themeColor="textSecondary">{t('phase18.linkedBill', { name: linked.name })}</ThemedText>}
    <Disclosure title={t('banking.log.more')} hint={t('banking.log.moreHint')} open={details} onOpenChange={setDetails}>
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
    </Disclosure>
    <Button title={t('quickLog.save')} loading={busy} onPress={submit} />
    <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{t('phase18.saveHint')}</ThemedText>
    {error != null && <ThemedText accessibilityRole="alert" themeColor="attention">{t(errorTranslationKey(error))}</ThemedText>}
    {(pendingCount > 0 || queue.error) && <Button title={queue.error ? t('quickLog.queue') : t('quickLog.queueCount', { count: pendingCount })}
      variant="ghost" disabled={busy} onPress={() => router.push('/pending-logs')} />}
  </Sheet></SpaceContext>;
}
const styles = StyleSheet.create({
  scope: { gap: Spacing.two },
  centred: { textAlign: 'center' },
  category: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  payer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  edit: { minHeight: 48, minWidth: 48, alignItems: 'flex-end', justifyContent: 'center' },
});
