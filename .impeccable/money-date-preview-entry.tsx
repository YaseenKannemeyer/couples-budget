/** Synthetic preview only. No session provider, RPC or financial transport mounts. */
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DisplayFontContext } from '../src/components/ui/font-context';
import { ThemeSchemeContext } from '../src/hooks/use-theme';
import { LocalizationProvider } from '../src/i18n/provider';
import { MoneyDate, type MoneyDateMutation } from '../src/features/money-date/money-date-screen';
import { GuideContext } from '../src/features/guides/context';
import { findGuide } from '../src/features/guides/registry';
import { moneyDate, lockedMoneyDate } from '../test/fixtures/money-date';
import { household, me } from '../test/fixtures/payments';
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const noop = () => {};
function Preview() {
  const params = new URLSearchParams(window.location.search);
  const [state, setState] = useState(params.get('state') ?? 'wins');
  const [active, setActive] = useState(params.has('guide'));
  const [guideStep, setGuideStep] = useState(0);
  const [loaded, fontError] = useFonts({ Manrope: { uri: 'http://127.0.0.1:8097/Manrope.ttf' } });
  const guide = findGuide('money-date')!;
  const data = state === 'closed' ? lockedMoneyDate : state === 'opening' ? { ...moneyDate, facts: { ...moneyDate.facts, expected_minor: null, gap_minor: null } } :
    state === 'empty' ? { ...moneyDate, facts: { ...moneyDate.facts, goals: [], categories: [] } } : state === 'gap' ?
      { ...moneyDate, ready: false, facts: { ...moneyDate.facts, gap_minor: -1000, expected_minor: 181000 } } : state === 'agree' ?
        { ...moneyDate, approvals: moneyDate.approvals.map(a => ({ ...a, approved: true })) } : moneyDate;
  const initialStep = ['cleanup', 'gap'].includes(state) ? 1 : state === 'lookahead' ? 2 : state === 'adjust' ? 3 : ['agree', 'opening', 'closed'].includes(state) ? 4 : 0;
  const save = { mutate: noop, isPending: false, error: null } as unknown as MoneyDateMutation;
  if (!loaded && !fontError) return null;
  return <SafeAreaProvider><QueryClientProvider client={client}><LocalizationProvider><DisplayFontContext value={loaded}>
    <ThemeSchemeContext value={params.get('theme') === 'dark' ? 'dark' : 'light'}>
      <GuideContext value={{ ready: true, active: active ? 'money-date' : null, path: '/money-date',
        rows: active ? { 'money-date': { guide_id: 'money-date', guide_version: 1, step_id: guide.steps[guideStep].id, status: 'in_progress', revision: 1, request_id: me.userId, pending: false } } : {},
        localError: false, syncError: false, start: () => { setGuideStep(0); setState('wins'); setActive(true); }, close: () => setActive(false), dismiss: () => setActive(false),
        move: direction => { const next = Math.max(0, Math.min(1, guideStep + direction)); setGuideStep(next); setState(next ? 'agree' : 'wins'); }, signal: noop, register: () => noop, retry: noop }}>
        <View style={{ flex: 1 }}><Text style={{ padding: 8, color: '#191B24', backgroundColor: '#E9ECFF' }}>Synthetic preview · {state} · {loaded ? 'Manrope loaded' : 'font fallback'}</Text>
          <MoneyDate key={state} data={data} household={household} userId={me.userId} save={save} onRefresh={noop} onMonth={noop} initialStep={initialStep} error={state === 'error'} />
        </View>
      </GuideContext>
    </ThemeSchemeContext>
  </DisplayFontContext></LocalizationProvider></QueryClientProvider></SafeAreaProvider>;
}
registerRootComponent(Preview);
