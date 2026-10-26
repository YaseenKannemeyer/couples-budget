import { minorUnitDigits, toMinor } from '@/lib/money';

import { MAX_BUDGET_MINOR } from './schema';

type Symbols = { decimal: string; group: string | undefined; digits: [string, string][] };
const symbolsCache = new Map<string, Symbols>();

function symbolsFor(locale: string): Symbols {
  const cached = symbolsCache.get(locale);
  if (cached) return cached;
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const digits = new Intl.NumberFormat(locale, { useGrouping: false });
  const symbols: Symbols = {
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
    group: parts.find((part) => part.type === 'group')?.value,
    digits: Array.from({ length: 10 }, (_, digit) => [digits.format(digit), String(digit)]),
  };
  symbolsCache.set(locale, symbols);
  return symbols;
}

/** Parse the device's decimal/grouping symbols without turning comma decimals into whole amounts. */
export function parseBudgetAmount(input: string, currency: string, locale: string): number | null {
  const { decimal, group, digits } = symbolsFor(locale);
  let normalized = input.trim();
  // Native keyboards may emit localized digits (e.g. Arabic-Indic).
  for (const [localized, ascii] of digits) {
    normalized = normalized.split(localized).join(ascii);
  }
  const sections = normalized.split(decimal);
  if (sections.length > 2) return null;
  let whole = sections[0];
  const fraction = sections[1];
  if (group && whole.includes(group)) {
    const groups = whole.split(group);
    if (!/^\d{1,3}$/.test(groups[0]) || groups.slice(1).some((value) => !/^\d{3}$/.test(value))) return null;
    whole = groups.join('');
  }
  if (!/^\d+$/.test(whole) || (fraction !== undefined && !/^\d*$/.test(fraction))) return null;
  if ((fraction?.length ?? 0) > minorUnitDigits(currency)) return null;
  const value = toMinor(`${whole}${fraction === undefined ? '' : `.${fraction}`}`, currency);
  return value !== null && Number.isSafeInteger(value) && value <= MAX_BUDGET_MINOR ? value : null;
}

/** Editable amounts never include currency symbols or grouping separators. */
export function budgetAmountText(minor: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    useGrouping: false,
    minimumFractionDigits: minorUnitDigits(currency),
    maximumFractionDigits: minorUnitDigits(currency),
  }).format(minor / 10 ** minorUnitDigits(currency));
}
