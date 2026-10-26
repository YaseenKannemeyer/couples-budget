/**
 * The Fair-Share Calculator: works out how much each partner puts into the
 * Shared Bucket, based on the split mode the couple agreed on.
 */

import { allocate } from '@/lib/money';

export type SplitMode = 'proportional' | 'equal' | 'combined';

export type Partner = {
  id: string;
  monthlyIncomeMinor: number;
};

export type PartnerShare = {
  id: string;
  /** Whole-number percentage. Percentages across partners always add up to 100. */
  percent: number;
  /** This partner's part of the total, in minor units. Parts always add up to the total. */
  amountMinor: number;
};

export const SPLIT_MODES = [
  {
    mode: 'proportional',
    labelKey: 'split.proportional.label',
    descriptionKey: 'split.proportional.description',
  },
  {
    mode: 'equal',
    labelKey: 'split.equal.label',
    descriptionKey: 'split.equal.description',
  },
  {
    mode: 'combined',
    labelKey: 'split.combined.label',
    descriptionKey: 'split.combined.description',
  },
] as const satisfies readonly { mode: SplitMode; labelKey: string; descriptionKey: string }[];

function weightsFor(partners: Partner[], mode: SplitMode): number[] {
  if (mode === 'equal') return partners.map(() => 1);
  // Proportional and combined both follow income: in a combined household every
  // salary lands in the shared pot, so each person's part is their income's share.
  return partners.map((p) => p.monthlyIncomeMinor);
}

/** Each partner's percentage share of shared costs (e.g. 67 / 33). */
export function incomeShares(partners: Partner[], mode: SplitMode = 'proportional') {
  const percents = allocate(100, weightsFor(partners, mode));
  return partners.map((p, i) => ({ id: p.id, percent: percents[i] }));
}

/** Splits a shared amount (rent, a goal's monthly target…) between partners. */
export function splitShared(
  totalMinor: number,
  partners: Partner[],
  mode: SplitMode
): PartnerShare[] {
  const weights = weightsFor(partners, mode);
  const amounts = allocate(totalMinor, weights);
  const percents = allocate(100, weights);
  return partners.map((p, i) => ({ id: p.id, percent: percents[i], amountMinor: amounts[i] }));
}
