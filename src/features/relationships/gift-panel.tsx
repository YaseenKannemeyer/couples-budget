import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ThemedText } from '@/components/themed-text';
import { ActionReview } from '@/components/ui/action-review';
import { Button } from '@/components/ui/button';
import { Disclosure } from '@/components/ui/disclosure';
import { SummaryRow } from '@/components/ui/summary-row';
import { TextField } from '@/components/ui/text-field';
import { useFlowMoney } from '@/features/cashflow/ui';
import type { Goal, GoalWorkspace } from '@/features/goals/schema';
import type { GoalMutation } from '@/features/goals/ui';
import { useGuideAction } from '@/features/guides/context';
import { GuideSlot } from '@/features/guides/guide-slot';
import type { Household } from '@/features/household/schema';
import { PaymentError } from '@/features/payments/ui';
import { uncertainDecision } from './decision';
export function GiftPanel({ goal, data, household, error, save }: { goal: Goal; data: GoalWorkspace; household: Household; error?: boolean; save: GoalMutation }) {
  const { t } = useTranslation();
  const { money, parse } = useFlowMoney(household.baseCurrency, household.timezone);
  const signal = useGuideAction();
  const [amount, setAmount] = useState('');
  const [review, setReview] = useState<{ amount: number; revision: number; version: number } | null>(null);
  const [given, setGiven] = useState(false);
  const parsed = parse(amount), uncertain = uncertainDecision(save.error);
  const busy = save.isPending || !!error || uncertain || goal.archived || goal.saved_minor >= goal.target_minor;
  const valid = parsed !== null && parsed > 0 && parsed <= goal.target_minor - goal.saved_minor;
  if ((goal.archived || goal.saved_minor >= goal.target_minor) && !review) return null;
  return <><GuideSlot target="goal-gift" offer="gift" /><Disclosure title={t('relationships.give')}>
    <ThemedText>{t('relationships.giftHint')}</ThemedText>
    <TextField label={t('goals.amount')} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" editable={!save.isPending} />
    <Button title={t('relationships.reviewGift')} disabled={busy || !valid} onPress={() => {
      if (valid && parsed !== null) setReview({ amount: parsed, revision: data.revision, version: goal.version });
    }} />
    <PaymentError error={save.error} />
    {uncertain && <ThemedText accessibilityRole="alert" themeColor="attention">{t('relationships.uncertain')}</ThemedText>}
    {given && <ThemedText type="section" themeColor="success" accessibilityLiveRegion="polite">{t('relationships.giftCelebration', { name: goal.name })}</ThemedText>}
    {review && <ActionReview title={t('relationships.reviewGift')}>
      <SummaryRow label={t('relationships.destination')} value={goal.name} />
      <SummaryRow label={t('goals.amount')} value={money(review.amount)} />
      <ThemedText>{t('relationships.giftConfirmHint')}</ThemedText>
      {review.revision !== data.revision && <ThemedText accessibilityRole="alert" themeColor="attention">{t('goals.changed')}</ThemedText>}
      <Button title={t('relationships.confirmGift')} loading={save.isPending} disabled={!!error || !uncertain && review.revision !== data.revision} onPress={() => save.mutate({ action: 'gift',
        revision: review.revision, values: { id: goal.id, version: review.version, amountMinor: review.amount } }, { onSuccess: () => {
          setAmount(''); setReview(null); setGiven(true); signal('gift-saved');
        } })} />
      <Button title={t('common.cancel')} variant="ghost" disabled={save.isPending || uncertain} onPress={() => setReview(null)} />
    </ActionReview>}
  </Disclosure></>;
}
