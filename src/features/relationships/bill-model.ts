import type { BillAction, BillMode, BillWorkspace } from './schema';
/** Locale parsing is supplied by the form; integer weights keep rounding exact. */
export function billPreview(data: BillWorkspace, mode: BillMode, inputs: Record<string, string>, parseMoney: (value: string) => number | null): { weights: BillAction['weights']; shares: { user_id: string; amount_minor: number }[] } | null {
  if (data.members.length !== 2) return null;
  const total = Math.abs(data.expense.amount_minor);
  let weights: BillAction['weights'];
  if (mode === 'income') {
    if (data.members.some(m => m.setup_step < 1) || !data.members.some(m => m.income_minor > 0)) return null;
    weights = data.members.map(m => ({ userId: m.user_id, weight: m.income_minor }));
  } else if (mode === 'equal') weights = data.members.map(m => ({ userId: m.user_id, weight: 1 }));
  else {
    const parsed = data.members.map(m => {
      const input = inputs[m.user_id]?.trim() ?? '';
      if (mode === 'custom') return /^\d+$/.test(input) ? Number(input) : null;
      if (mode === 'percentage') {
        // Percent input is localized independently of the household currency's precision.
        return parseMoney(input);
      }
      return parseMoney(input);
    });
    if (parsed.some(n => n === null || !Number.isSafeInteger(n) || n < 0 || n > 1e12)) return null;
    const sum = parsed.reduce<number>((s, n) => s + n!, 0);
    if (!Number.isSafeInteger(sum) || sum <= 0 || mode === 'percentage' && sum !== 10000 || mode === 'fixed' && sum !== total) return null;
    weights = data.members.map((m, i) => ({ userId: m.user_id, weight: parsed[i]! }));
  }
  // BigInt products mirror the server's numeric largest-remainder calculation.
  const denominator = weights.reduce((n, w) => n + BigInt(w.weight), 0n);
  if (!denominator) return null;
  const numerators = weights.map(w => BigInt(total) * BigInt(w.weight));
  const parts = numerators.map(n => Number(n / denominator));
  let left = total - parts.reduce((s, n) => s + n, 0);
  const order = numerators.map((n, i) => ({ i, remainder: n % denominator })).sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1);
  for (const { i } of order) { if (!left) break; parts[i]++; left--; }
  return { weights: mode === 'equal' || mode === 'income' ? [] : weights,
    shares: weights.map((w, i) => ({ user_id: w.userId, amount_minor: parts[i] * Math.sign(data.expense.amount_minor) })) };
}
