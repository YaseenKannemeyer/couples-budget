/** Development-only synthetic preview. No auth provider or financial transport. */
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DisplayFontContext } from '../src/components/ui/font-context';
import { ThemeSchemeContext } from '../src/hooks/use-theme';
import { LocalizationProvider } from '../src/i18n/provider';
import { Reconciliation } from '../src/features/reconciliation/reconciliation-screen';
import type { ReconciliationAction } from '../src/features/reconciliation/schema';
import type { useReconciliationAction } from '../src/features/reconciliation/api';
import { GuideContext } from '../src/features/guides/context';
import { findGuide } from '../src/features/guides/registry';
import { reconciliation } from '../test/fixtures/reconciliation';
import { household, me, partner } from '../test/fixtures/payments';

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
function Preview() {
  const params = new URLSearchParams(window.location.search);
  const mode = params.get('state') ?? 'gap';
  const [loaded, fontError] = useFonts({ Manrope: { uri: 'http://127.0.0.1:8095/Manrope.ttf' } });
  const [guideActive, setGuideActive] = useState(params.has('guide'));
  const [step, setStep] = useState(0);
  const guide = findGuide('reconciliation')!;
  const data = { ...reconciliation,
    baseline: mode === 'opening' ? null : reconciliation.baseline,
    pending: mode === 'opening' ? null : { ...reconciliation.pending!,
      ...(mode === 'surplus' ? { actual_minor: 155000, gap_minor: 5000 } : {}),
      ...(mode === 'matched' ? { actual_minor: 150000, gap_minor: 0 } : {}),
      shares: mode === 'proposal' ? [
        { user_id: me.userId, amount_minor: 3000, approved_at: null },
        { user_id: partner.userId, amount_minor: 2000, approved_at: '2026-10-27T12:00:00Z' },
      ] : [],
    },
  };
  if (!loaded && !fontError) return null;
  const save = { isPending: false, error: null,
    mutate: (_input: ReconciliationAction, options?: { onSuccess?: () => void }) => options?.onSuccess?.(),
  } as unknown as ReturnType<typeof useReconciliationAction>;
  return <SafeAreaProvider><QueryClientProvider client={client}><LocalizationProvider>
    <DisplayFontContext value={loaded}><ThemeSchemeContext value={params.get('theme') === 'dark' ? 'dark' : 'light'}>
      <GuideContext value={{ rows: guideActive ? { reconciliation: { guide_id: 'reconciliation', guide_version: 1,
        step_id: guide.steps[step].id, status: 'in_progress', revision: 1, request_id: me.userId, pending: false } } : {},
        ready: true, active: guideActive ? 'reconciliation' : null, path: '/reconciliation', localError: false, syncError: false,
        start: () => { setGuideActive(true); setStep(0); }, close: () => setGuideActive(false), dismiss: () => setGuideActive(false),
        move: direction => setStep(Math.max(0, Math.min(1, step + direction))), signal: () => setGuideActive(false), register: () => () => {}, retry: () => {} }}>
        <View style={{ flex: 1 }}>
          <Text style={{ padding: 8, color: '#191B24', backgroundColor: '#E9ECFF' }}>Synthetic preview · {mode} · {loaded ? 'Manrope loaded' : 'font fallback'}</Text>
          <Reconciliation data={data} household={household} userId={me.userId} members={[me, { ...partner, monthlyIncomeMinor: 400000 }]}
            save={save} onRefresh={() => {}} error={mode === 'error'} />
        </View>
      </GuideContext>
    </ThemeSchemeContext></DisplayFontContext>
  </LocalizationProvider></QueryClientProvider></SafeAreaProvider>;
}
registerRootComponent(Preview);
