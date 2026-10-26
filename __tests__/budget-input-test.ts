import { budgetAmountText, parseBudgetAmount } from '@/features/budget/money-input';
import { isCalendarDate, sourcesInput } from '@/features/budget/schema';

describe('budget amounts', () => {
  it.each([
    ['1,234.56', 'USD', 'en-US', 123456],
    ['1.234,56', 'EUR', 'de-DE', 123456],
    ['1 234,56', 'EUR', 'fr-FR', 123456],
    ['١٢٣٫٤٥', 'USD', 'ar-EG', 12345],
    ['1500', 'JPY', 'ja-JP', 1500],
    ['12.345', 'BHD', 'en-US', 12345],
    ['0', 'USD', 'en-US', 0],
  ])('parses %s in %s (%s) into integer minor units', (input, currency, locale, expected) => {
    expect(parseBudgetAmount(input, currency, locale)).toBe(expected);
  });

  it.each(['', '-1', 'NaN', 'Infinity', '1e3', '1,23', '0.001', '9007199254740993', '$12']) (
    'rejects unsafe, malformed or over-precise input: %s', (input) => {
      expect(parseBudgetAmount(input, 'USD', 'en-US')).toBeNull();
    }
  );

  it('does not interpret a German decimal comma as a thousands separator', () => {
    expect(parseBudgetAmount('1,5', 'EUR', 'de-DE')).toBe(150);
    expect(budgetAmountText(150, 'EUR', 'de-DE')).toBe('1,50');
  });
});

describe('payday input', () => {
  it('checks real calendar dates, including leap years', () => {
    expect(isCalendarDate('2028-02-29')).toBe(true);
    for (const date of ['0000-01-01', '2026-02-29', '2026-02-30', '2026-13-01', '02/11/2026', '2026-1-2']) {
      expect(isCalendarDate(date)).toBe(false);
    }
  });

  it('allows unknown irregular paydays but requires an amount and anchor for recurring sources', () => {
    const source = { name: 'Freelance', cadence: 'irregular', amountMinor: null, nextPayday: null };
    expect(sourcesInput.safeParse([source]).success).toBe(true);
    expect(sourcesInput.safeParse([{ ...source, cadence: 'weekly' }]).success).toBe(false);
    expect(sourcesInput.safeParse([{ ...source, cadence: 'biweekly', amountMinor: 0, nextPayday: '2026-11-02' }]).success).toBe(true);
  });
});
