import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useSharedBudget } from '@/features/shared-budget/api';
import { sharedBudgetModel } from '@/features/shared-budget/model';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { cashflow } from '../test/fixtures/cashflow';
import { household, me } from '../test/fixtures/payments';

jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => unknown) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/hooks/use-session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));

const callbacks = new Map<string, () => void>();
function rawData(spent = 0) {
  const c = cashflow.categories[0];
  return { ...cashflow, categories: [{ id: c.id, household_id: c.householdId, name: c.name, emoji: c.emoji,
    bucket: c.bucket, sort_order: c.sortOrder, archived: false, visibility: 'shared', owner_id: null, version: 1, starter_key: c.starterKey }],
    transactions: spent ? [{ id: '00000000-0000-4000-8000-000000000007', name: 'Partner expense', category_id: c.id, on_date: cashflow.today, amount_minor: spent }] : [] };
}
beforeEach(() => {
  jest.clearAllMocks(); callbacks.clear();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(useSession).mockReturnValue({ session: { user: { id: me.userId } } } as ReturnType<typeof useSession>);
  jest.mocked(supabase.rpc).mockResolvedValue({ data: rawData(), error: null } as never);
  const channel: { on: jest.Mock; subscribe: jest.Mock } = { on: jest.fn((_type, config, callback) => { callbacks.set(config.table, callback); return channel; }), subscribe: jest.fn(() => channel) };
  jest.mocked(supabase.channel).mockReturnValue(channel as never);
});
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...await renderHook(() => useSharedBudget(household.id, cashflow.today), { wrapper }) };
}
it('refreshes a partner’s shared expense into the displayed total without subscribing to private tables', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.data).toBeDefined());
  expect(sharedBudgetModel(view.result.current.data!).spent).toBe(0);
  jest.mocked(supabase.rpc).mockResolvedValue({ data: rawData(2500), error: null } as never);
  await act(async () => { callbacks.get('shared_transactions')!(); });
  await waitFor(() => expect(sharedBudgetModel(view.result.current.data!).spent).toBe(2500));
  expect(callbacks.has('private_transactions')).toBe(false); expect(callbacks.has('income_sources')).toBe(false);
  await view.unmount(); view.client.clear();
});
it('refreshes plan allocations and paid cycles, and resumes after foregrounding', async () => {
  const listener = jest.spyOn(AppState, 'addEventListener');
  const view = await setup();
  await waitFor(() => expect(view.result.current.data).toBeDefined());
  for (const table of ['budget_costs', 'cashflow_budget_links', 'categories', 'payment_records', 'scheduled_payments']) {
    const count = jest.mocked(supabase.rpc).mock.calls.length;
    await act(async () => { callbacks.get(table)!(); });
    await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(count + 1));
  }
  const foreground = listener.mock.calls.find(([event]) => event === 'change')![1];
  const count = jest.mocked(supabase.rpc).mock.calls.length;
  await act(async () => { foreground('active'); });
  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(count + 1));
  await view.unmount(); expect(supabase.removeChannel).toHaveBeenCalledTimes(1); view.client.clear(); listener.mockRestore();
});
it('polls while focused to recover missed events, and stops after leaving the screen', async () => {
  jest.useFakeTimers();
  const view = await setup();
  await act(async () => { await jest.advanceTimersByTimeAsync(10); });
  const count = jest.mocked(supabase.rpc).mock.calls.length;
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(jest.mocked(supabase.rpc).mock.calls.length).toBeGreaterThan(count);
  await view.unmount(); const after = jest.mocked(supabase.rpc).mock.calls.length;
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(supabase.rpc).toHaveBeenCalledTimes(after); view.client.clear(); jest.useRealTimers();
});
it('makes no server requests for an offline-only identity', async () => {
  jest.mocked(useSession).mockReturnValue({ session: null, offlineUserId: me.userId } as ReturnType<typeof useSession>);
  const view = await setup();
  expect(supabase.rpc).not.toHaveBeenCalled(); expect(supabase.channel).not.toHaveBeenCalled();
  await view.unmount(); view.client.clear();
});
