jest.mock('@/global.css', () => ({}));
import { wheelArcs } from '@/components/ui/wheel-geometry';
import { spendingSummary, wheelMode } from '@/features/shared-budget/model';
import { categoryVisual } from '@/features/categories/visual';
import { familyForId } from '@/constants/theme';
import { cashflow } from '../test/fixtures/cashflow';

it('computes exact arc angles from the real values (concept example 7,500/4,000/1,500/750)', () => {
  const arcs = wheelArcs([{ id: 'housing', amount: 7500 }, { id: 'food', amount: 4000 }, { id: 'transport', amount: 1500 }, { id: 'other', amount: 750 }])!;
  const full = Math.PI * 2;
  expect(arcs.map(arc => arc.share)).toEqual([7500 / 13750, 4000 / 13750, 1500 / 13750, 750 / 13750]);
  expect(arcs[0].start).toBe(0); expect(arcs[3].end).toBeCloseTo(full, 10);
  arcs.forEach((arc, i) => { expect(arc.end - arc.start).toBeCloseTo(arc.share * full, 10); if (i) expect(arc.start).toBeCloseTo(arcs[i - 1].end, 10); });
  expect(arcs.every(arc => !arc.dot && arc.path.startsWith('M'))).toBe(true);
});
it('refuses signed, zero or non-finite data instead of clamping it into a donut', () => {
  expect(wheelArcs([{ id: 'a', amount: 100 }, { id: 'b', amount: -20 }])).toBeNull();
  expect(wheelArcs([{ id: 'a', amount: 0 }])).toBeNull();
  expect(wheelArcs([{ id: 'a', amount: Number.NaN }])).toBeNull();
  expect(wheelArcs([])).toBeNull();
  expect(wheelMode([{ spent: 100 }, { spent: -20 }], 80)).toBe('signed');
  expect(wheelMode([{ spent: 100 }, { spent: -200 }], -100)).toBe('signed');
  expect(wheelMode([], 0)).toBe('empty');
  expect(wheelMode([{ spent: 100 }, { spent: 0 }], 100)).toBe('wheel');
});
it('keeps a tiny category visible as a dot and a single category as a full ring', () => {
  const arcs = wheelArcs([{ id: 'big', amount: 1_000_000 }, { id: 'tiny', amount: 1 }])!;
  expect(arcs[1].dot).toBe(true); expect(arcs[0].dot).toBe(false);
  expect(wheelArcs([{ id: 'only', amount: 5 }])![0].path.split('A')).toHaveLength(3);
});
it('uses one month and one cutoff for income, spending and net', () => {
  const summary = spendingSummary({ ...cashflow,
    income: [{ on_date: cashflow.today, amount_minor: 1000, confirmed: true }, { on_date: '2026-10-26', amount_minor: 5000, confirmed: true },
      { on_date: '2026-10-01', amount_minor: 3000, confirmed: false }],
    transactions: [{ id: 'a', name: null, on_date: cashflow.today, amount_minor: 400, category_id: cashflow.categories[0].id },
      { id: 'b', name: null, on_date: '2026-10-27', amount_minor: 900, category_id: cashflow.categories[0].id },
      { id: 'c', name: null, on_date: '2026-09-30', amount_minor: 800, category_id: cashflow.categories[0].id },
      { id: 'd', name: null, on_date: '2026-10-02', amount_minor: -100, category_id: cashflow.categories[0].id }] });
  expect(summary).toEqual({ income: 1000, spending: 300, net: 700 });
});
it('keeps category colour tied to identity, not order, and always draws a white glyph', () => {
  const id = '33333333-3333-4333-8333-333333333333';
  expect(familyForId(id)).toBe(familyForId(id));
  expect(categoryVisual({ id, emoji: null, starterKey: 'housing' })).toEqual({ family: 'orange', glyph: 'home' });
  expect(categoryVisual({ id, emoji: '🏰', starterKey: 'housing' })).toEqual({ family: 'orange', glyph: 'home' });
  expect(categoryVisual({ id, emoji: '🛡️', starterKey: null })).toEqual({ family: familyForId(id), glyph: 'shield' });
  expect(categoryVisual({ id, emoji: null, starterKey: null, name: 'Eating out' }).glyph).toBe('dining');
  expect(categoryVisual({ id, emoji: '🎸', starterKey: null })).toEqual({ family: familyForId(id), glyph: 'tag' });
});
