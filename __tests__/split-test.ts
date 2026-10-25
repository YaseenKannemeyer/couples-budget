import { incomeShares, splitShared, type Partner } from '@/lib/split';

const alex: Partner = { id: 'alex', monthlyIncomeMinor: 400000 };
const sarah: Partner = { id: 'sarah', monthlyIncomeMinor: 200000 };

describe('incomeShares', () => {
  it('turns incomes into whole percentages that add up to 100', () => {
    expect(incomeShares([alex, sarah])).toEqual([
      { id: 'alex', percent: 67 },
      { id: 'sarah', percent: 33 },
    ]);
  });

  it('is 50/50 in equal mode regardless of income', () => {
    expect(incomeShares([alex, sarah], 'equal').map((s) => s.percent)).toEqual([50, 50]);
  });

  it('falls back to 50/50 when nobody has entered an income yet', () => {
    const noIncome = [
      { id: 'a', monthlyIncomeMinor: 0 },
      { id: 'b', monthlyIncomeMinor: 0 },
    ];
    expect(incomeShares(noIncome).map((s) => s.percent)).toEqual([50, 50]);
  });
});

describe('splitShared', () => {
  it('scales contributions to income in proportional mode', () => {
    // The Euro Trip example: $300/month → $200 + $100
    expect(splitShared(30000, [alex, sarah], 'proportional')).toEqual([
      { id: 'alex', percent: 67, amountMinor: 20000 },
      { id: 'sarah', percent: 33, amountMinor: 10000 },
    ]);
  });

  it('splits down the middle in equal mode', () => {
    expect(splitShared(300001, [alex, sarah], 'equal').map((s) => s.amountMinor)).toEqual([
      150001, 150000,
    ]);
  });

  it('follows income in combined mode', () => {
    expect(splitShared(30000, [alex, sarah], 'combined').map((s) => s.amountMinor)).toEqual([
      20000, 10000,
    ]);
  });

  it('never loses or invents a cent', () => {
    const odd = [
      { id: 'a', monthlyIncomeMinor: 333333 },
      { id: 'b', monthlyIncomeMinor: 123457 },
    ];
    for (const total of [1, 99, 100, 299999, 1234567]) {
      const parts = splitShared(total, odd, 'proportional');
      expect(parts[0].amountMinor + parts[1].amountMinor).toBe(total);
    }
  });
});
