import { Disclosure } from '@/components/ui/disclosure';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon, type IconName } from '@/components/ui/icon';
import { GroupGap, ListRow, ListSection } from '@/components/ui/list-row';
import { Screen } from '@/components/ui/screen';
import { DetailHeader } from '@/components/ui/screen-header';
import { SpendingWheel } from '@/components/ui/spending-wheel';
import { accentColor, Spacing, type AccentFamily } from '@/constants/theme';
import type { Workspace } from '@/features/cashflow/schema';
import { categoryVisual, featureVisual, unassignedVisual, type TileVisual } from '@/features/categories/visual';
import { useMyHousehold } from '@/features/household/api';
import { useHouseholdToday } from '@/features/payments/dates';
import { useFormatters } from '@/hooks/use-formatters';
import { SpaceContext, useTheme } from '@/hooks/use-theme';
import { useSharedBudget } from './api';
import { sharedBudgetModel, spendingSummary, wheelMode } from './model';

export function SharedBudgetScreen() {
  const household = useMyHousehold();
  const h = household.data?.household;
  const today = useHouseholdToday(h?.timezone ?? 'UTC');
  const query = useSharedBudget(h?.id, today);
  return <SpaceContext value="shared"><SharedBudget
    workspace={query.data} currency={h?.baseCurrency ?? 'USD'} timezone={h?.timezone ?? 'UTC'}
    error={household.isError || query.isError} refreshing={query.isFetching || household.isFetching}
    onRefresh={() => { void household.refetch(); void query.refetch(); }} />
  </SpaceContext>;
}

export type SharedBudgetProps = {
  workspace?: Workspace; currency: string; timezone: string;
  error: boolean; refreshing: boolean; onRefresh: () => unknown;
};

const UNCATEGORISED = 'uncategorised';

/** Spending budget: category wheel, recorded income/spending/net and accessible category rows for one month and cutoff. */
export function SharedBudget({ workspace, currency, timezone, error, refreshing, onRefresh }: SharedBudgetProps) {
  const { t } = useTranslation();
  const locale = useLocales()[0]?.languageTag ?? 'en';
  const format = useFormatters(timezone);
  const [selected, setSelected] = useState<string | null>(null);
  const result = useMemo(() => {
    if (!workspace || error) return null;
    try { return { budget: sharedBudgetModel(workspace), summary: spendingSummary(workspace) }; } catch { return null; }
  }, [workspace, error]);
  const failed = error || (!!workspace && !result);
  const money = (amount: number) => format.money(amount, currency);
  const month = workspace ? new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(`${workspace.today.slice(0, 7)}-15T12:00:00Z`)) : '';

  const rows = result ? result.budget.rows.map(row => ({ id: row.category.id, name: row.category.name, visual: categoryVisual(row.category),
    spent: row.spent, plan: row.plan, remaining: row.remaining, archived: row.category.archived }))
    .concat(result.budget.uncategorisedCount ? [{ id: UNCATEGORISED, name: t('banking.spending.uncategorised'), visual: unassignedVisual,
      spent: result.budget.uncategorisedSpent, plan: null, remaining: null, archived: false }] : []) : [];
  const mode = result ? wheelMode(rows, result.budget.spent) : 'empty';
  const charted = rows.filter(row => row.spent > 0);
  const toggle = (id: string) => setSelected(current => current === id ? null : id);

  return <Screen withAction refreshing={refreshing} onRefresh={onRefresh}>
    <DetailHeader title={t('banking.spending.title')} subtitle={month ? t('banking.spending.subtitle', { month }) : undefined} backLabel={t('banking.back')} />
    {!result ? <View style={styles.state}>
      <ThemedText accessibilityRole={failed ? 'alert' : undefined} themeColor={failed ? 'attention' : 'textSecondary'}>
        {t(failed ? 'sharedBudget.loadError' : 'dashboard.loading')}
      </ThemedText>
      {failed && <Button title={t('common.tryAgain')} onPress={onRefresh} />}
    </View> : <>
      <GuideSlot target="shared-summary" />
      {mode === 'signed' ? <View style={styles.signed}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{t('banking.spending.totalSpend')}</ThemedText>
        <ThemedText type="subtitle" style={[styles.centred, styles.tabular]}>{money(result.budget.spent)}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{t('banking.spending.signed')}</ThemedText>
      </View> : <SpendingWheel centreLabel={t('banking.spending.totalSpend')} centreValue={money(result.budget.spent)}
        segments={charted.map(row => ({ id: row.id, amount: row.spent, family: row.visual.family }))}
        selectedId={selected} onSelect={toggle}
        summary={mode === 'empty' ? t('banking.spending.empty') : t('banking.spending.wheelSummary', {
          details: charted.map(row => `${row.name} ${money(row.spent)}`).join('; '), total: money(result.budget.spent) })} />}
      {mode === 'empty' && <ThemedText themeColor="textSecondary" style={styles.centred}>{t('banking.spending.empty')}</ThemedText>}

      <View style={styles.stats}>
        <FinanceStat icon="income" family="sky" label={t('banking.spending.income')} value={money(result.summary.income)} />
        <FinanceStat icon="spending" family="sky" label={t('banking.spending.totalSpending')} value={money(result.summary.spending)} />
        <FinanceStat icon="wallet" family="sky" label={t('banking.spending.net')} value={money(result.summary.net)} />
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{t('banking.spending.netHint')}</ThemedText>
      <Disclosure title={t('banking.spending.about')}><ThemedText type="small" themeColor="textSecondary">{t('banking.spending.aboutBody')}</ThemedText></Disclosure>

      {result.budget.hasPlan && result.budget.remaining < 0 && <ThemedText accessibilityRole="alert" themeColor="attention">
        {t('dashboard.overPlan', { amount: money(-result.budget.remaining) })}</ThemedText>}

      <ListSection title={t('banking.spending.byCategory')} action={{ label: t('banking.seeAll'), accessibilityLabel: t('expenses.title'),
        onPress: () => router.push({ pathname: '/expenses', params: { visibility: 'shared' } }) }}>
        {rows.length === 0 && <ThemedText themeColor="textSecondary" style={styles.empty}>{t('sharedBudget.emptyCategories')}</ThemedText>}
        {rows.map((row, index) => <CategoryLine key={row.id} row={row} money={money} last={index === rows.length - 1}
          selected={mode === 'wheel' && row.spent > 0 ? selected === row.id : undefined}
          dimmed={mode === 'wheel' && !!selected && selected !== row.id}
          onSelect={mode === 'wheel' && row.spent > 0 ? () => toggle(row.id) : undefined} />)}
      </ListSection>
      {result.budget.futureCount > 0 && <ThemedText type="small" themeColor="textSecondary">{t('banking.spending.futureHint')}</ThemedText>}

      {result.budget.unassigned.length > 0 && <ListSection title={t('sharedBudget.unassigned')}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.hint}>{t('sharedBudget.unassignedHint')}</ThemedText>
        {result.budget.unassigned.map((line, index) => <ListRow key={line.id} title={line.name} visual={unassignedVisual}
          value={money(line.amount_minor)} last={index === result.budget.unassigned.length - 1} />)}
      </ListSection>}

      <GroupGap />
      <ListSection title={t('banking.spending.editPlan')}>
        <ListRow title={t('budget.review')} visual={featureVisual.budget} onPress={() => router.push('/budget')} />
        <ListRow title={t('sharedBudget.assign')} visual={featureVisual.spending} onPress={() => router.push('/budget-categories')} />
        <ListRow title={t('categories.manage')} visual={featureVisual.categories} last onPress={() => router.push('/categories')} />
      </ListSection>
    </>}
    <Button variant="ghost" title={t('banking.refresh')} accessibilityLabel={t('sharedBudget.refresh')}
      loading={refreshing} onPress={onRefresh} />
  </Screen>;
}

type Line = { id: string; name: string; visual: TileVisual; spent: number; plan: number | null; remaining: number | null; archived: boolean };
function CategoryLine({ row, money, last, selected, dimmed, onSelect }: {
  row: Line; money: (n: number) => string; last: boolean; selected?: boolean; dimmed: boolean; onSelect?: () => void;
}) {
  const { t } = useTranslation();
  const over = row.remaining !== null && row.remaining < 0;
  const subtitle = [row.plan === null ? (row.id === UNCATEGORISED ? null : t('banking.spending.categoryNoPlan'))
    : over ? t('banking.spending.categoryOver', { plan: money(row.plan), amount: money(-row.remaining!) })
      : t('banking.spending.categoryPlan', { plan: money(row.plan), remaining: money(row.remaining!) }),
  row.spent < 0 ? t('banking.spending.categoryRefund') : null, row.archived ? t('payments.archived') : null].filter(Boolean).join(' · ');
  return <ListRow title={row.name} visual={row.visual} value={money(row.spent)} subtitle={subtitle || undefined}
    tone={over ? 'attention' : 'default'} last={last} selected={selected} dimmed={dimmed} chevron={false} onPress={onSelect}
    accessibilityLabel={[row.name, `${t('sharedBudget.spent')} ${money(row.spent)}`, subtitle, selected ? t('banking.spending.selected') : null].filter(Boolean).join(', ')} />;
}

/** Circular badge is an icon holder only — it never implies a progress ratio. */
function FinanceStat({ icon, family, label, value }: { icon: IconName; family: AccentFamily; label: string; value: string }) {
  const theme = useTheme();
  return <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.stat}>
    <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}><Icon name={icon} color={accentColor(family)} size={24} /></View>
    <ThemedText type="small" themeColor="textSecondary" style={styles.centred}>{label}</ThemedText>
    <ThemedText style={[styles.centred, styles.statValue]}>{value}</ThemedText>
  </View>;
}

const styles = StyleSheet.create({
  state: { gap: Spacing.three, paddingVertical: Spacing.two },
  signed: { gap: Spacing.one, paddingVertical: Spacing.three },
  centred: { textAlign: 'center' },
  tabular: { fontVariant: ['tabular-nums'] },
  stats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.three },
  stat: { flexGrow: 1, flexBasis: 96, alignItems: 'center', gap: Spacing.one },
  badge: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.one },
  statValue: { fontSize: 18, lineHeight: 24, fontWeight: '700', fontVariant: ['tabular-nums'] },
  empty: { paddingVertical: Spacing.three },
  hint: { paddingTop: Spacing.two },
});
