/**
 * Money is always stored and calculated as integer minor units (cents, pence, yen…)
 * together with an ISO 4217 currency code. Floats are only used at the very edge,
 * when formatting for display.
 */

export type CurrencyCode = string;

export type Money = {
  amountMinor: number;
  currency: CurrencyCode;
};

const digitsCache = new Map<CurrencyCode, number>();

/** Number of decimal places a currency uses, e.g. USD → 2, JPY → 0, BHD → 3. */
export function minorUnitDigits(currency: CurrencyCode): number {
  const cached = digitsCache.get(currency);
  if (cached !== undefined) return cached;

  const digits =
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2;
  digitsCache.set(currency, digits);
  return digits;
}

export function isValidCurrency(currency: string): boolean {
  if (!/^[A-Z]{3}$/.test(currency)) return false;
  try {
    new Intl.NumberFormat('en', { style: 'currency', currency });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses a user-typed amount ("12", "12.5", "1,234.56") into minor units without
 * going through floating point. Extra decimal places are rounded half away from zero.
 * Returns null when the input isn't a number.
 */
export function toMinor(input: string | number, currency: CurrencyCode): number | null {
  const digits = minorUnitDigits(currency);
  const text = String(input).trim().replace(/[\s,]/g, '');
  const match = /^(-)?(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[2] === '' && !match[3])) return null;

  const [, sign, whole, fraction = ''] = match;
  const kept = fraction.slice(0, digits).padEnd(digits, '0');
  const roundUp = Number(fraction.charAt(digits) || '0') >= 5;

  const minor = Number(whole || '0') * 10 ** digits + Number(kept || '0') + (roundUp ? 1 : 0);
  return sign && minor !== 0 ? -minor : minor;
}

/** Converts minor units back to a major-unit number. Display and charts only. */
export function fromMinor(amountMinor: number, currency: CurrencyCode): number {
  return amountMinor / 10 ** minorUnitDigits(currency);
}

export function formatMoney(
  amountMinor: number,
  currency: CurrencyCode,
  options: { locale?: string; hideCents?: boolean } = {}
): string {
  const digits = options.hideCents ? 0 : minorUnitDigits(currency);
  return new Intl.NumberFormat(options.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(fromMinor(amountMinor, currency));
}

/**
 * Splits an amount across weights so the parts always add back up to the exact total
 * (largest-remainder method). Weights of all zero fall back to an equal split.
 * Ties for the leftover units go to the earliest weight, so results are deterministic.
 */
export function allocate(totalMinor: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  if (weights.some((w) => w < 0 || !Number.isFinite(w))) {
    throw new Error('allocate: weights must be finite and non-negative');
  }

  const sum = weights.reduce((a, b) => a + b, 0);
  const effective = sum === 0 ? weights.map(() => 1) : weights;
  const effectiveSum = sum === 0 ? weights.length : sum;

  const sign = totalMinor < 0 ? -1 : 1;
  const total = Math.abs(totalMinor);

  const exact = effective.map((w) => (total * w) / effectiveSum);
  const parts = exact.map(Math.floor);
  let leftover = total - parts.reduce((a, b) => a + b, 0);

  const byRemainder = exact
    .map((value, index) => ({ index, remainder: value - Math.floor(value) }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const { index } of byRemainder) {
    if (leftover === 0) break;
    parts[index] += 1;
    leftover -= 1;
  }

  return parts.map((p) => p * sign);
}

/**
 * Converts between currencies. `rate` is how many major units of `to` one major
 * unit of `from` buys (e.g. USD→ZAR ≈ 18.2).
 */
export function convertMinor(
  amountMinor: number,
  from: CurrencyCode,
  to: CurrencyCode,
  rate: number
): number {
  if (from === to) return amountMinor;
  const scale = 10 ** (minorUnitDigits(to) - minorUnitDigits(from));
  return Math.round(amountMinor * rate * scale);
}
