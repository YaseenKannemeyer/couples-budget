import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { useOwnAllowance, usePrivateSpaceRefresh } from '@/features/private-space/api';
import { useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { household, me, partner } from '../test/fixtures/payments';

jest.mock('expo-router', () => ({ useFocusEffect: (callback: () => unknown) => require('react').useEffect(callback, [callback]) }));
jest.mock('@/hooks/use-session', () => ({ useSession: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn(), channel: jest.fn(), removeChannel: jest.fn() } }));
const callbacks = new Map<string, { callback: () => void; filter: string }>();
const rows = (spent = 2500) => [{ user_id: me.userId, allowance_minor: 30000, spent_minor: spent, remaining_minor: 30000 - spent },
  { user_id: partner.userId, allowance_minor: 50000, spent_minor: 1000, remaining_minor: 49000 }];
beforeEach(() => {
  jest.clearAllMocks(); callbacks.clear();
  jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
  jest.mocked(useSession).mockReturnValue({ session: { user: { id: me.userId } } } as ReturnType<typeof useSession>);
  jest.mocked(supabase.rpc).mockResolvedValue({ data: rows(), error: null } as never);
  const channel: { on: jest.Mock; subscribe: jest.Mock } = { on: jest.fn((_type, config, callback) => {
    callbacks.set(config.table, { callback, filter: config.filter }); return channel;
  }), subscribe: jest.fn(() => channel) };
  jest.mocked(supabase.channel).mockReturnValue(channel as never);
});
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, ...await renderHook(() => { usePrivateSpaceRefresh(household.id); return useOwnAllowance(household.id, '2026-10-25'); }, { wrapper }) };
}
it('updates only our aggregate from owner-filtered private activity and foreground changes', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.data?.remaining_minor).toBe(27500));
  expect(callbacks.get('private_transactions')?.filter).toBe(`owner_id=eq.${me.userId}`);
  expect(callbacks.get('members')?.filter).toBe(`user_id=eq.${me.userId}`);
  jest.mocked(supabase.rpc).mockResolvedValue({ data: rows(5000), error: null } as never);
  await act(async () => { callbacks.get('private_transactions')!.callback(); });
  await waitFor(() => expect(view.result.current.data?.remaining_minor).toBe(25000));
  const listener = jest.mocked(AppState.addEventListener).mock.calls[0][1];
  const count = jest.mocked(supabase.rpc).mock.calls.length;
  await act(async () => { listener('active'); });
  await waitFor(() => expect(supabase.rpc).toHaveBeenCalledTimes(count + 1));
  await view.unmount(); expect(supabase.removeChannel).toHaveBeenCalledTimes(1); view.client.clear();
});
it('keeps cached aggregates scoped across account changes', async () => {
  const view = await setup();
  await waitFor(() => expect(view.result.current.data?.user_id).toBe(me.userId));
  jest.mocked(useSession).mockReturnValue({ session: { user: { id: partner.userId } } } as ReturnType<typeof useSession>);
  await view.rerender(undefined);
  await waitFor(() => expect(view.result.current.data?.user_id).toBe(partner.userId));
  expect(view.result.current.data?.remaining_minor).toBe(49000);
  expect(callbacks.get('private_transactions')?.filter).toBe(`owner_id=eq.${partner.userId}`);
  await view.unmount(); view.client.clear();
});
it('refreshes missed events while focused and stops on unmount', async () => {
  jest.useFakeTimers(); const view = await setup();
  await act(async () => { await jest.advanceTimersByTimeAsync(10); });
  const before = jest.mocked(supabase.rpc).mock.calls.length;
  await act(async () => { await jest.advanceTimersByTimeAsync(30_000); });
  expect(jest.mocked(supabase.rpc).mock.calls.length).toBeGreaterThan(before);
  await view.unmount(); const after = jest.mocked(supabase.rpc).mock.calls.length;
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(supabase.rpc).toHaveBeenCalledTimes(after); view.client.clear(); jest.useRealTimers();
});
it('does not read private balances with only a remembered offline identity', async () => {
  jest.mocked(useSession).mockReturnValue({ session: null, accountId: me.userId } as ReturnType<typeof useSession>);
  const view = await setup();
  expect(supabase.rpc).not.toHaveBeenCalled(); expect(supabase.channel).not.toHaveBeenCalled();
  await view.unmount(); view.client.clear();
});
