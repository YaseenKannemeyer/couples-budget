import { forecast, type ForecastItem } from '@/features/cashflow/model';
import type { Workspace } from '@/features/cashflow/schema';

function sum(values: number[]) {
  return values.reduce((total, value) => {
    const result = total + value;
    if (!Number.isSafeInteger(result)) throw new Error('Shared budget overflow');
    return result;
  }, 0);
}

/** Monthly plan versus posted shared spending; pending bills are shown separately. */
export function sharedBudgetModel(data: Workspace) {
  const month = data.today.slice(0, 7);
  const categories = data.categories.filter(c => c.visibility === 'shared');
  const categoryIds = new Set(categories.map(c => c.id));
  const actual = data.transactions.filter(t => t.on_date.slice(0, 7) === month && t.on_date <= data.today);
  const spentByCategory = new Map<string, number[]>();
  const plansByCategory = new Map<string, number[]>();
  for (const entry of actual) {
    const amounts = spentByCategory.get(entry.category_id) ?? [];
    amounts.push(entry.amount_minor);
    spentByCategory.set(entry.category_id, amounts);
  }
  const unassigned = data.budgets.filter(b => !b.category_id || !categoryIds.has(b.category_id));
  for (const line of data.budgets) {
    if (!line.category_id || !categoryIds.has(line.category_id)) continue;
    const amounts = plansByCategory.get(line.category_id) ?? [];
    amounts.push(line.amount_minor);
    plansByCategory.set(line.category_id, amounts);
  }
  const rows = categories.map(category => {
    const amounts = plansByCategory.get(category.id);
    const plan = amounts ? sum(amounts) : null;
    const entries = spentByCategory.get(category.id) ?? [];
    const spent = sum(entries);
    return { category, plan, spent, count: entries.length,
      remaining: plan === null ? null : sum([plan, -spent]) };
  }).filter(row => !row.category.archived || row.plan !== null || row.count > 0)
    .sort((a, b) => a.category.sortOrder - b.category.sortOrder || a.category.id.localeCompare(b.category.id));
  const plan = sum(data.budgets.map(b => b.amount_minor));
  const spent = sum(actual.map(t => t.amount_minor));
  // Defensive fallback keeps the ledger total reconcilable if a catalogue row is missing.
  const uncategorised = actual.filter(t => !categoryIds.has(t.category_id));
  const projection = forecast(data);
  const nextPayments = new Map<string, ForecastItem>();
  for (const item of projection.items) {
    if (item.kind !== 'payment' || item.dismissed || item.on > projection.horizon) continue;
    const id = item.key.split(':')[1];
    if (!nextPayments.has(id)) nextPayments.set(id, item);
  }
  return {
    rows, plan, spent, remaining: sum([plan, -spent]), hasPlan: data.budgets.length > 0,
    unassigned, unassignedAmount: sum(unassigned.map(b => b.amount_minor)),
    uncategorisedCount: uncategorised.length, uncategorisedSpent: sum(uncategorised.map(t => t.amount_minor)),
    futureCount: data.transactions.filter(t => t.on_date.slice(0, 7) === month && t.on_date > data.today).length,
    pending: [...nextPayments.values()],
  };
}
