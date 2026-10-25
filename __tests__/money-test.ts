import { allocate, convertMinor, formatMoney, isValidCurrency, minorUnitDigits, toMinor } from '@/lib/money';

describe('minorUnitDigits', () => {
  it('knows how many decimals each currency uses', () => {
    expect(minorUnitDigits('USD')).toBe(2);
    expect(minorUnitDigits('ZAR')).toBe(2);
    expect(minorUnitDigits('JPY')).toBe(0);
    expect(minorUnitDigits('BHD')).toBe(3);
  });
});

describe('isValidCurrency', () => {
  it('accepts ISO codes and rejects junk', () => {
    expect(isValidCurrency('EUR')).toBe(true);
    expect(isValidCurrency('eur')).toBe(false);
    expect(isValidCurrency('EURO')).toBe(false);
  });
});

describe('toMinor', () => {
  it('parses typed amounts without float drift', () => {
    expect(toMinor('12', 'USD')).toBe(1200);
    expect(toMinor('12.5', 'USD')).toBe(1250);
    expect(toMinor('1,234.56', 'USD')).toBe(123456);
    expect(toMinor('0.29', 'USD')).toBe(29); // 0.29 * 100 = 28.999… in floats
    expect(toMinor(19.99, 'EUR')).toBe(1999);
  });

  it('rounds extra decimals half away from zero', () => {
    expect(toMinor('1.005', 'USD')).toBe(101);
    expect(toMinor('1.004', 'USD')).toBe(100);
    expect(toMinor('-1.005', 'USD')).toBe(-101);
    expect(toMinor('150.5', 'JPY')).toBe(151);
  });

  it('respects three-decimal currencies', () => {
    expect(toMinor('1.5', 'BHD')).toBe(1500);
  });

  it('returns null for things that are not amounts', () => {
    expect(toMinor('', 'USD')).toBeNull();
    expect(toMinor('.', 'USD')).toBeNull();
    expect(toMinor('abc', 'USD')).toBeNull();
    expect(toMinor('1.2.3', 'USD')).toBeNull();
  });
});

describe('formatMoney', () => {
  it('formats for the given locale', () => {
    expect(formatMoney(123456, 'USD', { locale: 'en-US' })).toBe('$1,234.56');
    expect(formatMoney(1500, 'JPY', { locale: 'en-US' })).toBe('¥1,500');
    expect(formatMoney(123456, 'USD', { locale: 'en-US', hideCents: true })).toBe('$1,235');
  });
});

describe('allocate', () => {
  it('always adds back up to the exact total', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1000, [2, 1])).toEqual([667, 333]);
    for (const total of [1, 7, 99, 300001]) {
      const parts = allocate(total, [4000, 2000, 1234]);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });

  it('splits equally when every weight is zero', () => {
    expect(allocate(10, [0, 0])).toEqual([5, 5]);
  });

  it('handles negative totals symmetrically', () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it('rejects negative weights', () => {
    expect(() => allocate(100, [1, -1])).toThrow();
  });
});

describe('convertMinor', () => {
  it('converts across currencies with different decimals', () => {
    expect(convertMinor(1000, 'USD', 'ZAR', 18.25)).toBe(18250); // $10 → R182.50
    expect(convertMinor(1000, 'USD', 'JPY', 150)).toBe(1500); // $10 → ¥1500
    expect(convertMinor(1500, 'JPY', 'USD', 1 / 150)).toBe(1000);
    expect(convertMinor(500, 'EUR', 'EUR', 99)).toBe(500);
  });
});
