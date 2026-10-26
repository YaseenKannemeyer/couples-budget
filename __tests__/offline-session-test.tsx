import { act, render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import { rememberAccount, offlineAccountFor } from '@/features/quick-log/offline-account';
import { SessionProvider, useSession } from '@/hooks/use-session';
import { supabase } from '@/lib/supabase';
import { me, partner } from '../test/fixtures/payments';

jest.mock('@/global.css', () => ({}));
jest.mock('@/lib/supabase', () => ({ isSupabaseConfigured: true, supabase: { auth: { getSession: jest.fn(), onAuthStateChange: jest.fn() } } }));
const memory = new Map<string, string>();
let authChange: (event: string, session: unknown) => void;
beforeEach(() => {
  memory.clear(); jest.clearAllMocks();
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) ?? null,
    setItem: (key: string, value: string) => memory.set(key, value),
    removeItem: (key: string) => memory.delete(key),
  } });
  jest.mocked(supabase.auth.onAuthStateChange).mockImplementation(callback => {
    authChange = callback as typeof authChange;
    return { data: { subscription: { unsubscribe: jest.fn() } } } as unknown as ReturnType<typeof supabase.auth.onAuthStateChange>;
  });
});
function Probe() { const auth = useSession(); return <Text>{`${auth.accountId ?? 'none'}:${auth.isOffline}:${auth.session ? 'authenticated' : 'local-only'}`}</Text>; }
it('allows only a remembered account to draft after retryable connection failure, without fabricating a session', async () => {
  rememberAccount(me.userId);
  jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: { name: 'AuthRetryableFetchError' } } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  const view = await render(<SessionProvider><Probe /></SessionProvider>);
  await waitFor(() => expect(view.getByText(`${me.userId}:true:local-only`)).toBeTruthy());
  await act(async () => authChange('INITIAL_SESSION', null));
  expect(view.getByText(`${me.userId}:true:local-only`)).toBeTruthy();
  await act(async () => authChange('SIGNED_OUT', null));
  expect(view.getByText('none:false:local-only')).toBeTruthy();
  expect(offlineAccountFor({ name: 'AuthRetryableFetchError' })).toBeNull();
});
it('does not unlock offline data after explicit authentication rejection', async () => {
  rememberAccount(me.userId);
  jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: { name: 'AuthApiError', status: 401 } } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>);
  const view = await render(<SessionProvider><Probe /></SessionProvider>);
  await waitFor(() => expect(view.getByText('none:false:local-only')).toBeTruthy());
  expect(offlineAccountFor({ name: 'AuthRetryableFetchError' })).toBeNull();
});
it('preserves a newer account event when an older session read finishes late', async () => {
  let finish!: (value: Awaited<ReturnType<typeof supabase.auth.getSession>>) => void;
  jest.mocked(supabase.auth.getSession).mockReturnValue(new Promise(resolve => { finish = resolve; }));
  const view = await render(<SessionProvider><Probe /></SessionProvider>);
  await act(async () => authChange('SIGNED_IN', { user: { id: partner.userId } }));
  await act(async () => finish({ data: { session: null }, error: { name: 'AuthRetryableFetchError' } } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>));
  expect(view.getByText(`${partner.userId}:false:authenticated`)).toBeTruthy();
});

it('clears the remembered identity for thrown authentication rejection before a later network failure', async () => {
  rememberAccount(me.userId);
  jest.mocked(supabase.auth.getSession).mockRejectedValue({ name: 'AuthApiError', status: 401 });
  const view = await render(<SessionProvider><Probe /></SessionProvider>);
  await waitFor(() => expect(view.getByText('none:false:local-only')).toBeTruthy());
  expect(offlineAccountFor({ name: 'AuthRetryableFetchError' })).toBeNull();
});
