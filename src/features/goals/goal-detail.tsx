import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ActionReview } from '@/components/ui/action-review';
import { Button } from '@/components/ui/button';
import { PeriodBarChart } from '@/components/ui/charts';
import { Disclosure } from '@/components/ui/disclosure';
import { ProgressBar } from '@/components/ui/progress-bar';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { isCalendarDate } from '@/features/budget/schema';
import { useFlowMoney } from '@/features/cashflow/ui';
import type { Household, Member } from '@/features/household/schema';
import { formatCalendarDate, shiftCalendarDays } from '@/features/payments/dates';
import { PaymentError } from '@/features/payments/ui';
import { SpaceContext } from '@/hooks/use-theme';
import { useGoalAction, useGoalHistory } from './api';
import { uncertainDecision } from '@/features/relationships/decision';
import { GiftPanel } from '@/features/relationships/gift-panel';
import { goalProgress, sinkingMonthlyNeed } from './model';
import type { Contribution, Goal, GoalWorkspace } from './schema';
import { GoalLoading, useGoalData, type GoalMutation, type GoalReview } from './ui';

export function GoalDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { household, query, error, refresh } = useGoalData();
  const history = useGoalHistory(household.data?.household.id, id);
  if (!household.data || !query.data) return <GoalLoading error={error} retry={refresh} />;
  const goal = query.data.goals.find(g => g.id === id);
  if (!goal) return <GoalLoading unavailable retry={refresh} />;
  return <SpaceContext value="shared"><ConnectedDetail key={`${household.data.household.id}:${household.data.me.userId}:${id}`}
    data={query.data} goal={goal} household={household.data.household} userId={household.data.me.userId} members={household.data.members}
    history={history.data?.pages.flat()} historyError={history.isError} historyLoading={history.isFetching}
    moreHistory={history.hasNextPage} onMoreHistory={() => history.fetchNextPage()} onRetryHistory={() => history.refetch()}
    error={error} onRefresh={refresh} refreshing={query.isFetching} /></SpaceContext>;
}
type Props = { data: GoalWorkspace; goal: Goal; household: Household; userId: string; members: Member[]; error?: boolean;
  refreshing?: boolean; onRefresh: () => unknown; history?: Contribution[]; historyError?: boolean; historyLoading?: boolean;
  moreHistory?: boolean; onMoreHistory: () => unknown; onRetryHistory: () => unknown };
function ConnectedDetail(props: Props) {
  const save = useGoalAction(props.household.id, props.userId);
  return <GoalDetail {...props} save={save} />;
}
export function GoalDetail({ data, goal, household, userId, members, error, refreshing, onRefresh, history, historyError, historyLoading,
  moreHistory, onMoreHistory, onRetryHistory, save }: Props & { save: GoalMutation }) {
  const { t } = useTranslation();
  const { money, parse, locale } = useFlowMoney(household.baseCurrency, household.timezone);
  const progress = goalProgress(goal);
  const [amount, setAmount] = useState('');
  const [on, setOn] = useState(data.today);
  const [review, setReview] = useState<GoalReview | null>(null);
  const [saved, setSaved] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const parsed = parse(amount);
  const valid = parsed !== null && parsed > 0 && parsed <= progress.remaining && isCalendarDate(on) && on >= goal.starts_on && on >= shiftCalendarDays(data.today, -365) && on <= data.today;
  const uncertain = uncertainDecision(save.error);
  const retryingReview = uncertain && !!review && save.variables?.action !== 'gift' &&
    JSON.stringify([save.variables?.action, save.variables?.values]) === JSON.stringify([review.action.action, review.action.values]);
  const busy = save.isPending || !!error || uncertain;
  const date = (value: string) => formatCalendarDate(value, locale);
  const openReview = (action: GoalReview['action'], label: string, details: GoalReview['details'] = []) => setReview({ action, revision: data.revision, label, details });
  return <Screen>
    <ThemedText type="subtitle" accessibilityRole="header">{goal.name}</ThemedText>
    {goal.kind === 'sinking' && <ThemedText themeColor="textSecondary">{t('relationships.sinkingHint')}</ThemedText>}
    <ThemedText themeColor="textSecondary">{t('goals.deadlineValue', { date: date(goal.deadline_on) })}</ThemedText>
    {!!error && <ThemedText themeColor="attention" accessibilityRole="alert">{t('goals.loadError')}</ThemedText>}
    {(celebrate || progress.completed) && <ThemedText type="section" themeColor="success" accessibilityLiveRegion="polite">{t('goals.reachedTogether')}</ThemedText>}
    <SummaryRow label={t('goals.saved')} value={money(goal.saved_minor)} />
    <ProgressBar value={progress.percent} label={t('goals.progress', { name: goal.name })} summary={t('goals.progressSummary', { saved: money(goal.saved_minor), target: money(goal.target_minor) })} />
    <SummaryRow label={t('goals.targetPlain')} value={money(goal.target_minor)} />
    <SummaryRow label={t('goals.remaining')} value={money(progress.remaining)} />
    {goal.kind === 'sinking' && <SummaryRow label={t('relationships.monthlyNeeded')} value={money(sinkingMonthlyNeed(goal, data.today))} />}
    <ThemedText type="small" themeColor="textSecondary">{t('relationships.savingsMeaning')}</ThemedText>
    {!progress.completed && goal.deadline_on < data.today && <ThemedText themeColor="attention">{t('goals.overdue')}</ThemedText>}
    {goal.archived && <ThemedText themeColor="attention">{t('goals.archiveHint')}</ThemedText>}
    {!goal.archived && !progress.completed && <View style={styles.section}>
      <ThemedText type="section" accessibilityRole="header">{t('goals.ourMonth', { date: date(goal.month.due_on) })}</ThemedText>
      <SummaryRow label={t('goals.monthTarget')} value={money(goal.month.target_minor)} />
      {!goal.month.split_ready && <ThemedText themeColor="textSecondary">{t('goals.sharesPending')}</ThemedText>}
      {members.map(member => {
        const share = progress.shares.find(s => s.user_id === member.userId);
        const percent = share?.percent ?? null;
        return <View key={member.userId} style={styles.section}>
          <SummaryRow label={member.displayName} value={percent === null ? t('goals.pending') :
            new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(percent / 100)} />
          {percent !== null && <ProgressBar value={percent} label={t('goals.shareProgress', { name: member.displayName })}
            summary={t('goals.shareSummary', { saved: money(share?.contributed_minor ?? 0), target: money(share?.target_minor ?? 0) })} />}
          <ThemedText type="small" themeColor="textSecondary">{share?.target_minor != null ?
            t(share.target_minor === 0 ? 'goals.noShareDue' : 'goals.shareSummary', { saved: money(share.contributed_minor), target: money(share.target_minor) }) : t('goals.sharesPending')}</ThemedText>
        </View>;
      })}
      <ThemedText type="small" themeColor="textSecondary">{t('goals.monthHint')}</ThemedText>
    </View>}
    {!goal.archived && !progress.completed && <View style={styles.section}>
      <ThemedText type="section" accessibilityRole="header">{t('goals.contribute')}</ThemedText>
      <TextField label={t('goals.contributionAmount', { currency: household.baseCurrency })} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
      <TextField label={t('goals.contributionDate')} value={on} onChangeText={setOn} hint={t('cashflow.dateHint')} autoCapitalize="none" />
      <ThemedText type="small" themeColor="textSecondary">{t('goals.contributionHint')}</ThemedText>
      <Button title={t('goals.reviewContribution')} disabled={busy || !valid} onPress={() => openReview(
        { action: 'contribute', values: { id: goal.id, version: goal.version, amountMinor: parsed!, on } }, t('goals.earmarkHint'),
        [{ label: t('goals.contributor'), value: members.find(m => m.userId === userId)?.displayName ?? t('goals.me') }, { label: t('goals.amount'), value: money(parsed!) }, { label: t('goals.contributionDate'), value: date(on) }])} />
    </View>}
    <PaymentError error={save.error} />
    {save.isPending && <ThemedText accessibilityLiveRegion="polite">{t('goals.saving')}</ThemedText>}
    {saved && !save.isPending && <ThemedText themeColor="success" accessibilityLiveRegion="polite">{t('goals.savedDecision')}</ThemedText>}
    {review && <ActionReview key={JSON.stringify(review.action)} title={t('goals.reviewTitle')}>
      <ThemedText>{review.label}</ThemedText>
      {review.details.map(detail => <SummaryRow key={detail.label} {...detail} />)}
      {data.revision !== review.revision && <ThemedText themeColor="attention" accessibilityRole="alert">{t('goals.changed')}</ThemedText>}
      <Button title={t('goals.confirmDecision')} loading={save.isPending} disabled={!!error || uncertain && !retryingReview || data.revision !== review.revision && !retryingReview} onPress={() => {
        setSaved(false);
        save.mutate({ ...review.action, revision: review.revision }, { onSuccess: result => {
          setCelebrate(review.action.action === 'contribute' && result.completed); setSaved(true); setReview(null);
          if (review.action.action === 'contribute') { setAmount(''); setOn(data.today); }
        } });
      }} />
      <Button title={t('common.cancel')} variant="ghost" disabled={save.isPending || retryingReview} onPress={() => setReview(null)} />
    </ActionReview>}
    <GiftPanel goal={goal} data={data} household={household} error={error} save={save} />
    {history?.filter(c => c.source === 'gift' && c.amount_minor > 0 && !c.reversed).slice(0, 1).map(c =>
      <ThemedText key={c.id} type="section" themeColor="success" accessibilityLiveRegion="polite">{t('relationships.sharedGiftCelebration', { name: members.find(m => m.userId === c.contributor_id)?.displayName ?? t('goals.partner'), amount: money(c.amount_minor), goal: goal.name })}</ThemedText>)}
    <Disclosure title={t('goals.progressChart')}>
      {!goal.series.length ? <ThemedText themeColor="textSecondary">{t('goals.noContributions')}</ThemedText> :
        <PeriodBarChart items={goal.series.map(point => ({ id: point.month_on, label: new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${point.month_on}T12:00:00Z`)), amount: point.amount_minor, value: money(point.amount_minor) }))}
          summary={t('goals.chartSummary', { name: goal.name, details: goal.series.map(p => `${date(p.month_on)}: ${money(p.amount_minor)}`).join('; ') })} />}
    </Disclosure>
    <Disclosure title={t('goals.history')}>
      {historyError ? <><ThemedText accessibilityRole="alert" themeColor="attention">{t('goals.historyError')}</ThemedText><Button title={t('common.tryAgain')} onPress={onRetryHistory} /></> :
        history ? <>
          {!history.length && <ThemedText themeColor="textSecondary">{t('goals.noContributions')}</ThemedText>}
          {history.map(entry => <View key={entry.id} style={styles.section}>
            <SummaryRow label={members.find(m => m.userId === entry.contributor_id)?.displayName ?? t('goals.partner')} value={money(entry.amount_minor)} />
            <ThemedText type="small" themeColor="textSecondary">{date(entry.occurred_on)} · {t(entry.reverses_id ? 'goals.correctedEntry' : entry.source === 'variance' ? 'moneyDate.drawdownEntry' : entry.source === 'gift' ? 'relationships.giftEntry' : entry.source === 'booster' ? 'relationships.boosterEntry' : 'goals.sharedContribution')}</ThemedText>
            {entry.reversed && <ThemedText type="small" themeColor="textSecondary">{t('goals.wasCorrected')}</ThemedText>}
            {entry.contributor_id === userId && entry.amount_minor > 0 && !entry.reversed && <Button title={t('goals.reverse', { amount: money(entry.amount_minor) })} variant="ghost" disabled={busy}
              onPress={() => openReview({ action: 'reverse', values: { id: goal.id, version: goal.version, contributionId: entry.id } }, t(entry.source === 'gift' ? 'relationships.reverseGiftHint' : entry.source === 'booster' ? 'relationships.reverseBoosterHint' : 'goals.reverseHint'), [{ label: t('goals.amount'), value: money(entry.amount_minor) }])} />}
          </View>)}
          {moreHistory && <Button title={t('goals.moreHistory')} variant="secondary" loading={historyLoading} onPress={onMoreHistory} />}
        </> : <ThemedText themeColor="textSecondary">{t('dashboard.loading')}</ThemedText>}
    </Disclosure>
    <Disclosure title={t('goals.settings')}>
      <Button title={t('goals.edit')} variant="secondary" disabled={busy} onPress={() => router.push({ pathname: '/goal-edit', params: { id: goal.id } })} />
      <ThemedText type="small" themeColor="textSecondary">{t('goals.replanHint')}</ThemedText>
      <Button title={t('goals.replan')} variant="secondary" disabled={busy || goal.archived} onPress={() => openReview({ action: 'replan', values: { id: goal.id, version: goal.version } }, t('goals.replanHint'))} />
      <Button title={t(goal.archived ? 'goals.restore' : 'goals.archive')} variant="ghost" disabled={busy} onPress={() => openReview(
        { action: 'archive', values: { id: goal.id, version: goal.version, archived: !goal.archived } }, t('goals.archiveHint'))} />
    </Disclosure>
    <Button title={t('goals.refresh')} variant="secondary" loading={refreshing} disabled={save.isPending} onPress={onRefresh} />
    <Button title={t('goals.back')} variant="ghost" onPress={() => router.replace('/goals')} />
  </Screen>;
}
const styles = StyleSheet.create({ section: { gap: Spacing.two } });
