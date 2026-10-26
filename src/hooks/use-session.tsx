import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { offlineAccountFor, rememberAccount } from '@/features/quick-log/offline-account';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

type SessionState = { session: Session | null; isLoading: boolean; offlineUserId: string | null };
const SessionContext = createContext<SessionState & { refresh: () => Promise<void> }>({
  session: null, isLoading: true, offlineUserId: null, refresh: async () => {},
});
export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, isLoading: isSupabaseConfigured, offlineUserId: null });
  const epoch = useRef(0);
  const refresh = useCallback(async () => {
    const run = ++epoch.current;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (run !== epoch.current) return;
      if (data.session) {
        rememberAccount(data.session.user.id);
        setState({ session: data.session, isLoading: false, offlineUserId: null });
      } else {
        const offlineUserId = offlineAccountFor(error);
        if (!offlineUserId) rememberAccount(null);
        setState({ session: null, isLoading: false, offlineUserId });
      }
    } catch (error) {
      if (run !== epoch.current) return;
      const offlineUserId = offlineAccountFor(error);
      if (!offlineUserId) rememberAccount(null);
      setState({ session: null, isLoading: false, offlineUserId });
    }
  }, []);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void Promise.resolve().then(refresh);
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        epoch.current++;
        rememberAccount(session.user.id);
        setState({ session, isLoading: false, offlineUserId: null });
      } else if (event === 'SIGNED_OUT') {
        epoch.current++;
        rememberAccount(null);
        setState({ session: null, isLoading: false, offlineUserId: null });
      }
      // INITIAL_SESSION=null can follow a retryable refresh failure. The explicit
      // getSession result decides whether the last local drafting account is usable.
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);
  return <SessionContext.Provider value={{ ...state, refresh }}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const state = useContext(SessionContext);
  return { ...state, accountId: state.session?.user.id ?? state.offlineUserId ?? undefined, isOffline: !state.session && !!state.offlineUserId };
}
