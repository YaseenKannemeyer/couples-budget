import { formatMoney } from '@/lib/money';

/** Formatting follows the device's region even when its language falls back to English. */
export function createFormatters(locale: string, timeZone: string) {
  return {
    money: (amountMinor: number, currency: string, options: { hideCents?: boolean } = {}) =>
      formatMoney(amountMinor, currency, { ...options, locale }),
    number: (value: number, options: Intl.NumberFormatOptions = {}) =>
      new Intl.NumberFormat(locale, options).format(value),
    date: (value: Date | number, options: Intl.DateTimeFormatOptions = {}) =>
      new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(value),
  };
}
