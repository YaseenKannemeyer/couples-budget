import { forecast } from '@/features/cashflow/model';
import { shiftCalendarDays } from '@/features/payments/dates';
import type { DateOptions, MoneyDateWorkspace } from './schema';
export function optionsAction(options: DateOptions) {
  return { action: 'options' as const, values: { shares: options.gap_shares, surplusCorrection: options.surplus_correction,
    nextSplit: options.next_split, drawdowns: options.drawdowns } };
}
export function moneyDateModel(data: MoneyDateWorkspace, userId: string) {
  const flow = forecast(data.facts.flow, shiftCalendarDays(data.facts.today, 30));
  return {
    wins: data.facts.categories.filter(c => c.spent_minor < c.planned_minor),
    bills: flow.items.filter(i => i.kind === 'payment' && !i.dismissed && i.on <= flow.horizon),
    forecast: flow,
    locked: data.period.status === 'locked',
    completed: data.period.ends_on <= data.today,
    ownApproved: data.approvals.some(a => a.user_id === userId && a.approved),
    bothApproved: data.approvals.length === 2 && data.approvals.every(a => a.approved),
  };
}
