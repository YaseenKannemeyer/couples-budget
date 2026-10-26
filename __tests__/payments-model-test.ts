import { household, me, partner, schedule } from '../test/fixtures/payments';

import { dueState, formatCalendarDate, householdToday, reminderInstant } from '@/features/payments/dates';
import { buildReminderPlan } from '@/features/payments/reminder-plan';
import { paymentInput } from '@/features/payments/schema';

describe('payment dates', () => {
  it('uses the household calendar at month boundaries and keeps date-only values stable', () => {
    const instant = new Date('2026-10-31T23:30:00Z');
    expect(householdToday('Africa/Johannesburg', instant)).toBe('2026-11-01');
    expect(householdToday('America/Los_Angeles', instant)).toBe('2026-10-31');
    expect(formatCalendarDate('2026-11-02', 'en-US')).toBe('Nov 2, 2026');
  });
  it('treats an open window as due now and only calls it overdue after the window closes', () => {
    expect(dueState('2026-11-14', '2026-11-16', '2026-11-10')).toBe('upcoming');
    expect(dueState('2026-11-14', '2026-11-16', '2026-11-11')).toBe('dueSoon');
    expect(dueState('2026-11-14', '2026-11-16', '2026-11-15')).toBe('dueNow');
    expect(dueState('2026-11-14', '2026-11-16', '2026-11-17')).toBe('overdue');
  });
  it('puts reminders at 9 am in the household timezone, including DST changes', () => {
    expect(new Date(reminderInstant('2026-11-02', 'Africa/Johannesburg')).toISOString()).toBe('2026-11-02T07:00:00.000Z');
    expect(new Date(reminderInstant('2026-03-07', 'America/New_York')).toISOString()).toBe('2026-03-07T14:00:00.000Z');
    expect(new Date(reminderInstant('2026-03-08', 'America/New_York')).toISOString()).toBe('2026-03-08T13:00:00.000Z');
  });
});

describe('schedule validation', () => {
  const value = { name: 'Bank', expectedAmountMinor: null, payerId: me.userId, visibility: 'shared', categoryId: schedule.categoryId,
    note: null, recurrence: 'monthly', dateMode: 'window', dueStart: '2026-11-14', dueEnd: '2026-11-16', reminderDaysBefore: 1 };
  it('accepts unknown variable amounts and exact or window dates', () => {
    expect(paymentInput.safeParse(value).success).toBe(true);
    expect(paymentInput.safeParse({ ...value, dueEnd: value.dueStart }).success).toBe(true);
  });
  it.each([
    { dueEnd: '2026-11-13' }, { dueEnd: '2026-12-01' }, { dueStart: '2026-02-30' },
    { expectedAmountMinor: 0 }, { expectedAmountMinor: 1.5 }, { reminderDaysBefore: -1 },
  ])('rejects invalid date windows or amounts: %j', (patch) => {
    expect(paymentInput.safeParse({ ...value, ...patch }).success).toBe(false);
  });
});

describe('private reminder plans', () => {
  const now = new Date('2026-11-01T00:00:00Z').getTime();
  it('includes only the signed-in payer’s active reminders and excludes private partner data defensively', () => {
    const plan = buildReminderPlan([
      schedule,
      { ...schedule, id: 'partner', payerId: partner.userId },
      { ...schedule, id: 'private-other', visibility: 'private', ownerId: partner.userId, payerId: me.userId, name: 'SECRET' },
      { ...schedule, id: 'paused', status: 'paused' },
      { ...schedule, id: 'off', reminderDaysBefore: null },
      { ...schedule, id: 'past', dueStart: '2026-10-01' },
    ], me.userId, household.timezone, 'en', now);
    expect(plan).toHaveLength(1);
    expect(new Date(plan[0].at).toISOString()).toBe('2026-11-13T07:00:00.000Z');
    expect(JSON.stringify(plan)).not.toMatch(/Internet|SECRET|7500|Our connection/);
  });
  it('sorts by actual reminder time and respects the device queue cap', () => {
    const rows = Array.from({ length: 60 }, (_, index) => ({ ...schedule, id: String(index), reminderDaysBefore: index % 8 }));
    const plan = buildReminderPlan(rows, me.userId, household.timezone, 'en', now);
    expect(plan).toHaveLength(50);
    expect(plan.every((value, index) => index === 0 || value.at >= plan[index - 1].at)).toBe(true);
  });
});
