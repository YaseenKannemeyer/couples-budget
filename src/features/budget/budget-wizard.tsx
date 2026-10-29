import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, View } from 'react-native';
import { useLocales } from 'expo-localization';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { SummaryRow } from '@/components/ui/summary-row';
import { Radius, Spacing } from '@/constants/theme';
import { useFormatters } from '@/hooks/use-formatters';
import { errorTranslationKey } from '@/i18n/errors';
import { incomeShares, splitShared, SPLIT_MODES, type SplitMode } from '@/lib/split';

import { type BudgetSetup, useSaveBudgetStep } from './api';
import { budgetAmountText, parseBudgetAmount } from './money-input';
import { allowancesInput, costsInput, incomeInput, isCalendarDate, sourcesInput, type Cadence } from './schema';

type CostDraft = { id?: string; key: string; name: string; amount: string };
type SourceDraft = CostDraft & { id?: string; cadence: Cadence; nextPayday: string };
const stepTitles = ['incomeTitle', 'allowancesTitle', 'costsTitle', 'paydaysTitle'] as const;
const stepDescriptions = ['incomeDescription', 'allowancesDescription', 'costsDescription', 'paydaysDescription'] as const;
const cadences: Cadence[] = ['monthly', 'weekly', 'biweekly', 'irregular'];

export function BudgetWizard({ data, onReload, reloading }: {
  data: BudgetSetup; onReload: () => Promise<void>; reloading: boolean;
}) {
  const { t } = useTranslation();
  const deviceLocale = useLocales()[0]?.languageTag ?? 'en';
  // A draft keeps its input convention if device settings change mid-entry.
  const [locale] = useState(deviceLocale);
  const { household, me } = data;
  const joining = !me.budgetCompletedAt && data.members[0]?.userId !== me.userId;
  const [editShared, setEditShared] = useState(!joining);
  const currency = household.baseCurrency;
  const format = useFormatters(household.timezone);
  const edit = (minor: number) => budgetAmountText(minor, currency, locale);
  const parse = (value: string) => parseBudgetAmount(value, currency, locale);
  const [step, setStep] = useState(me.budgetCompletedAt ? 0 : Math.min(me.budgetSetupStep, 3));
  const [revision, setRevision] = useState(household.budgetRevision);
  const [income, setIncome] = useState(me.budgetSetupStep > 0 ? edit(me.monthlyIncomeMinor) : '');
  const [splitMode, setSplitMode] = useState<SplitMode>(household.splitMode);
  const [allowances, setAllowances] = useState(() => data.members.map((member) => ({
    userId: member.userId, name: member.displayName, amount: edit(member.monthlyAllowanceMinor),
  })));
  const [costs, setCosts] = useState<CostDraft[]>(() => data.costs.map((cost) => ({
    id: cost.id, key: cost.id, name: cost.name, amount: edit(cost.amountMinor),
  })));
  const [sources, setSources] = useState<SourceDraft[]>(() => data.sources.length ? data.sources.map((source) => ({
    id: source.id, key: source.id, name: source.name, cadence: source.cadence,
    amount: source.amountMinor === null ? '' : edit(source.amountMinor), nextPayday: source.nextPayday ?? '',
  })) : [{ key: 'initial', name: t('budget.sourceDefault'), cadence: 'monthly', amount: '', nextPayday: '' }]);
  const counter = useRef(0);
  const save = useSaveBudgetStep(household.id);
  const [attempted, setAttempted] = useState(false);
  const busy = save.isPending || reloading;

  const incomeMinor = parse(income);
  const people = data.members.map((member) => ({
    id: member.userId, monthlyIncomeMinor: member.userId === me.userId ? incomeMinor ?? 0 : member.monthlyIncomeMinor,
  }));
  const ratiosReady = data.members.length === 2 && incomeMinor !== null &&
    data.members.every((member) => member.userId === me.userId || member.budgetSetupStep >= 1);
  const incomeTotal = people.reduce((sum, person) => sum + person.monthlyIncomeMinor, 0);
  const allowanceValues = allowances.map((allowance) => ({ userId: allowance.userId, amountMinor: parse(allowance.amount) }));
  const costValues = costs.map((cost) => ({ id: cost.id, name: cost.name, amountMinor: parse(cost.amount) }));
  const sourceValues = sources.map((source) => ({
    id: source.id, name: source.name, cadence: source.cadence, nextPayday: source.nextPayday || null,
    amountMinor: source.amount.trim() === '' && source.cadence === 'irregular' ? null : parse(source.amount) ?? Number.NaN,
  }));
  const allowanceTotal = allowanceValues.reduce((sum, row) => sum + (row.amountMinor ?? 0), 0);
  const costTotal = costValues.reduce((sum, row) => sum + (row.amountMinor ?? 0), 0);
  const contributions = splitShared(costTotal, people, splitMode);
  const remaining = incomeTotal - allowanceTotal - costTotal;

  async function next() {
    if (busy) return;
    setAttempted(true);
    try {
      let nextRevision: number;
      switch (step) {
        case 0: {
          const value = incomeInput.safeParse({ amountMinor: incomeMinor, splitMode });
          if (!value.success) return;
          nextRevision = await save.mutateAsync({ step: 0, value: value.data, revision });
          break;
        }
        case 1: {
          const value = allowancesInput.safeParse(allowanceValues);
          if (!value.success) return;
          nextRevision = await save.mutateAsync({ step: 1, value: value.data, revision });
          break;
        }
        case 2: {
          const value = costsInput.safeParse(costValues);
          if (!value.success) return;
          nextRevision = await save.mutateAsync({ step: 2, value: value.data, revision });
          break;
        }
        default: {
          const value = sourcesInput.safeParse(sourceValues);
          if (!value.success) return;
          nextRevision = await save.mutateAsync({ step: 3, value: value.data, revision });
        }
      }
      setRevision(nextRevision);
      setAttempted(false);
      if (step === 3) router.replace('/');
      else setStep((current) => current + 1);
    } catch {
      // The mutation retains the service error for a translated retry below.
    }
  }

  function amountError(value: string, positive = false, optional = false) {
    if (!attempted && !value.trim()) return undefined;
    if (optional && !value.trim()) return undefined;
    const parsed = parse(value);
    return parsed === null || (positive && parsed === 0)
      ? t(positive ? 'budget.invalidPositiveAmount' : 'budget.invalidAmount', { currency }) : undefined;
  }
  const nameError = (value: string) => attempted && (!value.trim() || value.trim().length > 80) ? t('budget.invalidName') : undefined;
  const isValid = [
    incomeInput.safeParse({ amountMinor: incomeMinor, splitMode }).success,
    allowancesInput.safeParse(allowanceValues).success,
    costsInput.safeParse(costValues).success,
    sourcesInput.safeParse(sourceValues).success,
  ][step];

  return (
    <Screen>
      <View style={styles.header}>
        <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
          {t('budget.progress', { step: step + 1, total: 4 })}
        </ThemedText>
        <ThemedText type="subtitle" accessibilityRole="header">{t(`budget.${stepTitles[step]}`)}</ThemedText>
        <ThemedText themeColor="textSecondary">{t(`budget.${stepDescriptions[step]}`)}</ThemedText>
        <ProgressBar value={(step + 1) / 4 * 100} label={t('budget.progress', { step: step + 1, total: 4 })} />
      </View>
      {!data.partner && <ThemedText themeColor="textSecondary">{t('budget.soloHint')}</ThemedText>}
      {joining && <>
        <ThemedText type="smallBold">{t('budget.joiningTitle')}</ThemedText>
        <ThemedText themeColor="textSecondary">{t('budget.joiningHint')}</ThemedText>
        <Button variant="secondary" title={t(editShared ? 'budget.keepShared' : 'budget.changeShared')} disabled={busy}
          onPress={() => {
            if (editShared) {
              setSplitMode(data.household.splitMode);
              setAllowances(data.members.map(member => ({ userId: member.userId, name: member.displayName, amount: edit(member.monthlyAllowanceMinor) })));
              setCosts(data.costs.map(cost => ({ id: cost.id, key: cost.id, name: cost.name, amount: edit(cost.amountMinor) })));
            }
            setEditShared(value => !value);
          }} />
      </>}

      {data.month_split?.temporary && <ThemedText themeColor="attention">{t('moneyDate.temporarySplitNotice', { mode: t(`split.${data.month_split.mode}.label`), month: data.month_split.month_on.slice(0, 7) })}</ThemedText>}
      {step === 0 && <>
        <ThemedText type="small" themeColor="textSecondary">{t('budget.incomeWhy')}</ThemedText>
        <TextField label={t('budget.incomeLabel', { currency })} value={income} onChangeText={setIncome}
          keyboardType="decimal-pad" error={amountError(income)} editable={!busy} />
        <ThemedText type="small" themeColor="textSecondary">{t('budget.incomeVisibility')}</ThemedText>
        <ThemedText type="smallBold">{t('budget.splitTitle')}</ThemedText>
        <View accessibilityRole="radiogroup" accessibilityLabel={t('budget.splitTitle')} style={styles.group}>
          {SPLIT_MODES.map((mode) => <Choice key={mode.mode} label={t(mode.labelKey)} description={t(mode.descriptionKey)}
            selected={splitMode === mode.mode} disabled={busy || !editShared} onPress={() => setSplitMode(mode.mode)} />)}
        </View>
        <Card>
          <ThemedText type="smallBold">{t('budget.ratioTitle')}</ThemedText>
          {ratiosReady ? incomeShares(people, splitMode).map((share) => <ThemedText key={share.id}>
            {t('budget.ratio', { name: data.members.find((member) => member.userId === share.id)!.displayName,
              percent: format.number(share.percent / 100, { style: 'percent', maximumFractionDigits: 0 }) })}
          </ThemedText>) : <ThemedText themeColor="textSecondary">{t('budget.waitingIncome')}</ThemedText>}
        </Card>
      </>}

      {step === 1 && <>
        <ThemedText type="small" themeColor="textSecondary">{t('budget.allowanceWhy')}</ThemedText>
        {allowances.map((allowance, index) => <TextField key={allowance.userId}
          label={t('budget.allowanceLabel', { name: allowance.name, currency })}
          value={allowance.amount} editable={!busy && editShared} keyboardType="decimal-pad" error={amountError(allowance.amount)}
          onChangeText={(amount) => setAllowances((rows) => rows.map((row, i) => i === index ? { ...row, amount } : row))} />)}
        <Card>
          <SummaryRow label={t(ratiosReady ? 'budget.jointIncome' : 'budget.partialIncome')} value={format.money(incomeTotal, currency)} />
          <SummaryRow label={t('budget.allowanceTotal')} value={format.money(allowanceTotal, currency)} />
        </Card>
      </>}

      {step === 2 && <>
        <ThemedText type="small" themeColor="textSecondary">{t('budget.costWhy')}</ThemedText>
        {!costs.length && <ThemedText themeColor="textSecondary">{t('budget.emptyCosts')}</ThemedText>}
        {costs.map((cost, index) => <View key={cost.key} style={styles.entry}>
          <TextField label={t('budget.costName')} value={cost.name} editable={!busy && editShared} maxLength={80} error={nameError(cost.name)}
            onChangeText={(name) => setCosts((rows) => rows.map((row, i) => i === index ? { ...row, name } : row))} />
          <TextField label={t('budget.costAmount', { currency })} value={cost.amount} editable={!busy && editShared}
            keyboardType="decimal-pad" error={amountError(cost.amount, true)}
            onChangeText={(amount) => setCosts((rows) => rows.map((row, i) => i === index ? { ...row, amount } : row))} />
          <Button variant="ghost" disabled={busy || !editShared} title={t('budget.removeCost', { name: cost.name || t('budget.unnamedCost') })}
            onPress={() => setCosts((rows) => rows.filter((row) => row.key !== cost.key))} />
        </View>)}
        <View style={styles.suggestions}>
          {(['rent', 'groceries', 'wifi', 'insurance'] as const).map((name) => <Button key={name} variant="secondary"
            title={t('budget.addStarter', { name: t(`budget.starterCosts.${name}`) })} disabled={busy || !editShared || costs.length >= 50}
            onPress={() => setCosts((rows) => [...rows, { key: `new-${++counter.current}`, name: t(`budget.starterCosts.${name}`), amount: '' }])} />)}
        </View>
        <Button variant="secondary" title={t('budget.addCost')} disabled={busy || !editShared || costs.length >= 50}
          onPress={() => setCosts((rows) => [...rows, { key: `new-${++counter.current}`, name: '', amount: '' }])} />
        {costs.length >= 50 && <ThemedText type="small">{t('budget.costLimit')}</ThemedText>}
        <Card>
          <SummaryRow label={t('budget.totalCosts')} value={format.money(costTotal, currency)} />
          {ratiosReady ? contributions.map((share) => <SummaryRow key={share.id}
            label={t('budget.contribution', { name: data.members.find((member) => member.userId === share.id)!.displayName })}
            value={format.money(share.amountMinor, currency)} />) : <ThemedText themeColor="textSecondary">{t('budget.waitingIncome')}</ThemedText>}
          {ratiosReady ? <SummaryRow label={t('budget.leftAfterPlan')} value={format.money(remaining, currency)} /> :
            <ThemedText type="small" themeColor="textSecondary">{t('budget.pendingTotals')}</ThemedText>}
        </Card>
      </>}

      {step === 3 && <>
        <ThemedText themeColor="textSecondary">{t('budget.paydayOptional')}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">{t('budget.paydayPrivacy')}</ThemedText>
        {sources.map((source, index) => {
          function update(patch: Partial<SourceDraft>) {
            setSources((rows) => rows.map((row, i) => i === index ? { ...row, ...patch } : row));
          }
          const irregular = source.cadence === 'irregular';
          const validDate = isCalendarDate(source.nextPayday);
          const dateError = source.nextPayday && !validDate ? t('budget.invalidDate')
            : attempted && !source.nextPayday && !irregular ? t('budget.requiredDate') : undefined;
          return <View key={source.key} style={styles.entry}>
            <TextField label={t('budget.sourceName')} value={source.name} onChangeText={(name) => update({ name })}
              maxLength={80} editable={!busy} error={nameError(source.name)} />
            <View accessibilityRole="radiogroup" accessibilityLabel={t('budget.cadenceLabel', {
              name: source.name || t('budget.unnamedSource'),
            })} style={styles.group}>
              {cadences.map((cadence) => <Choice key={cadence} label={t(`budget.cadence.${cadence}`)} disabled={busy}
                selected={source.cadence === cadence} onPress={() => update({ cadence })} />)}
            </View>
            <TextField label={t(irregular ? 'budget.irregularAmount' : 'budget.sourceAmount', { currency })}
              value={source.amount} onChangeText={(amount) => update({ amount })} editable={!busy}
              keyboardType="decimal-pad" error={amountError(source.amount, false, irregular)} />
            <TextField label={t('budget.nextPayday')} value={source.nextPayday} onChangeText={(nextPayday) => update({ nextPayday })}
              autoCorrect={false} autoCapitalize="none" maxLength={10} placeholder={t('budget.datePlaceholder')}
              editable={!busy} error={dateError || undefined} hint={t(irregular ? 'budget.irregularDateHint' : 'budget.dateHint')} />
            {validDate && <ThemedText type="small" themeColor="textSecondary">
              {t('budget.datePreview', { date: new Intl.DateTimeFormat(deviceLocale, { dateStyle: 'long', timeZone: 'UTC' })
                .format(new Date(`${source.nextPayday}T12:00:00Z`)), timezone: household.timezone })}
            </ThemedText>}
            {sources.length > 1 && <Button variant="ghost" disabled={busy}
              title={t('budget.removeSource', { name: source.name || t('budget.unnamedSource') })}
              onPress={() => setSources((rows) => rows.filter((row) => row.key !== source.key))} />}
          </View>;
        })}
        <Button variant="secondary" disabled={busy || sources.length >= 10} title={t('budget.addSource')}
          onPress={() => setSources((rows) => [...rows, { key: `new-${++counter.current}`, name: '', cadence: 'monthly', amount: '', nextPayday: '' }])} />
        {sources.length >= 10 && <ThemedText type="small">{t('budget.sourceLimit')}</ThemedText>}
      </>}

      {(step === 1 || step === 2) && ratiosReady && remaining < 0 && <ThemedText themeColor="attention">{t('budget.overPlan')}</ThemedText>}
      {attempted && !isValid && <ThemedText themeColor="attention" accessibilityRole="alert">{t('budget.checkStep')}</ThemedText>}
      {save.error && <View style={styles.group}>
        <ThemedText themeColor="attention" accessibilityRole="alert">{t(errorTranslationKey(save.error))}</ThemedText>
        {errorTranslationKey(save.error) === 'errors.budgetChanged' && <>
          <ThemedText type="small" themeColor="textSecondary">{t('budget.reloadHint')}</ThemedText>
          <Button title={t('budget.reload')} variant="secondary" onPress={onReload} loading={reloading} />
        </>}
      </View>}
      <Button title={t(step === 3 ? 'budget.finish' : 'budget.continue')} onPress={next} loading={save.isPending} disabled={reloading} />
      {step === 3 && <>
        <Button title={t('budget.deferPaydays')} variant="secondary" disabled={busy} onPress={async () => {
          try { await save.mutateAsync({ step: 'defer', revision }); router.replace('/'); }
          catch { /* Preserve the draft and show the same version-aware error below. */ }
        }} />
        <ThemedText type="small" themeColor="textSecondary">{t('budget.deferHint')}</ThemedText>
      </>}
      {step > 0 && <Button title={t('budget.back')} variant="secondary" disabled={busy} onPress={() => {
        // Adopt newly saved line identities before allowing another edit.
        setCosts((draft) => draft.map((cost, index) => {
          const saved = data.costs[index];
          return !cost.id && saved && cost.name === saved.name && parse(cost.amount) === saved.amountMinor
            ? { ...cost, id: saved.id } : cost;
        }));
        setStep((current) => current - 1); setAttempted(false); save.reset();
      }} />}
      <ThemedText type="small" themeColor="textSecondary">{t('budget.saveHint')}</ThemedText>
      <Button title={t('budget.later')} variant="ghost" disabled={busy} onPress={() => router.replace('/')} />
    </Screen>
  );
}

function Choice({ label, description, selected, disabled, onPress }: {
  label: string; description?: string; selected: boolean; disabled: boolean; onPress: () => void;
}) {
  return <Pressable accessibilityRole="radio" accessibilityLabel={label} accessibilityHint={description} accessibilityState={{ checked: selected, disabled }}
    disabled={disabled} onPress={onPress}>
    <ThemedView type={selected ? 'backgroundSelected' : 'backgroundElement'} style={styles.choice}>
      <ThemedText type="smallBold" themeColor={selected ? 'accent' : 'text'}>{label}</ThemedText>
      {description && <ThemedText type="small" themeColor="textSecondary">{description}</ThemedText>}
    </ThemedView>
  </Pressable>;
}

const styles = StyleSheet.create({
  header: { gap: Spacing.two, paddingTop: Spacing.three },
  group: { gap: Spacing.two },
  entry: { gap: Spacing.three, paddingVertical: Spacing.three },
  choice: { minHeight: 50, padding: Spacing.three, borderRadius: Radius.small, gap: Spacing.one },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
});
