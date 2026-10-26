import type { QuickLogInput, QueuedLog, LogResult } from '@/features/quick-log/schema';
import { household, me, workspace } from './payments';
export const quickInput: QuickLogInput = {
  baseCurrency: household.baseCurrency, visibility: 'shared', amountMinor: 12345, categoryId: workspace.categories[0].id, frequency: 'one_time', paidBy: me.userId,
  description: 'Our groceries', note: null, occurredOn: '2026-10-25', originalCurrency: null, originalAmountMinor: null, fxRate: null,
  scheduleId: null, scheduleVersion: null, scheduleDueStart: null, receipt: false,
};
export const queued: QueuedLog = { id: '00000000-0000-4000-8000-000000000090', userId: me.userId, householdId: household.id,
  values: quickInput, createdAt: 12345, status: 'pending', reason: null, result: null };
export const saved: LogResult = { transactionId: queued.id, visibility: 'shared', scheduleRef: null, receiptPath: null };
