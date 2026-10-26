import type { Household, Member } from '@/features/household/schema';
import type { PaymentWorkspace } from '@/features/payments/api';
import type { Schedule } from '@/features/payments/schema';

export const household: Household = { id: '00000000-0000-4000-8000-000000000001', name: 'Synthetic home',
  baseCurrency: 'USD', timezone: 'Africa/Johannesburg', splitMode: 'proportional', moneyDateDay: 1, inviteCode: 'ABCDEFGH', budgetRevision: 0 };
export const me: Member = { householdId: household.id, userId: '00000000-0000-4000-8000-00000000000a', displayName: 'Alex',
  monthlyIncomeMinor: 600000, monthlyAllowanceMinor: 30000, budgetSetupStep: 4, budgetCompletedAt: '2026-10-25T12:00:00Z', joinedAt: '2026-10-25T12:00:00Z' };
export const partner: Member = { ...me, userId: '00000000-0000-4000-8000-00000000000b', displayName: 'Sam' };
export const schedule: Schedule = { id: '00000000-0000-4000-8000-000000000002', householdId: household.id, ownerId: me.userId,
  payerId: me.userId, visibility: 'shared', name: 'Internet', expectedAmountMinor: null, categoryId: '00000000-0000-4000-8000-000000000003',
  note: 'Our connection', recurrence: 'monthly', dateMode: 'window', dueStart: '2026-11-14', dueEnd: '2026-11-16', anchorStartDay: 14, anchorEndDay: 16,
  reminderDaysBefore: 1, status: 'active', version: 4, estimateMinor: 7500, paidThisMonth: false,
  recentAmounts: [{ amountMinor: 7500, paidOn: '2026-10-15' }] };
export const workspace: PaymentWorkspace = { schedules: [schedule], categories: [
  { id: schedule.categoryId, householdId: household.id, name: 'Utilities', emoji: null, archived: false, bucket: 'needs',
    visibility: 'shared', ownerId: null, version: 1, sortOrder: 1, starterKey: 'utilities' },
] };
