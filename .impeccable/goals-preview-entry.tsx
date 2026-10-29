/** Isolated synthetic screen review; financial writes and guide transport are not mounted. */
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DisplayFontContext } from '../src/components/ui/font-context';
import { ThemeSchemeContext } from '../src/hooks/use-theme';
import { LocalizationProvider } from '../src/i18n/provider';
import { GoalDetail } from '../src/features/goals/goal-detail';
import { GoalEditor } from '../src/features/goals/goal-editor';
import { GoalsList } from '../src/features/goals/goals-screen';
import { GuideContext } from '../src/features/guides/context';
import { findGuide } from '../src/features/guides/registry';
import type { GoalMutation } from '../src/features/goals/ui';
import { goalsWorkspace, jointGoal, goalHistory } from '../test/fixtures/goals';
import { household, me, partner } from '../test/fixtures/payments';
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const noop = () => {};
function Preview() {
  const params = new URLSearchParams(window.location.search);
  const [state, setState] = useState(params.get('state') ?? 'detail');
  const [active, setActive] = useState(params.has('guide'));
  const [step, setStep] = useState(0);
  const [loaded, fontError] = useFonts({ Manrope: { uri: 'http://127.0.0.1:8096/Manrope.ttf' } });
  const guide = findGuide('goals')!;
  const goal = state === 'funded' ? { ...jointGoal, saved_minor: jointGoal.target_minor } : state === 'pending' ?
    { ...jointGoal, month: { ...jointGoal.month, split_ready: false, shares: jointGoal.month.shares.map(s => ({ ...s, target_minor: null })) } } : jointGoal;
  const data = { ...goalsWorkspace, goals: state === 'empty' ? [] : [goal] };
  const save = { mutate: noop, isPending: false, error: null } as unknown as GoalMutation;
  if (!loaded && !fontError) return null;
  return <SafeAreaProvider><QueryClientProvider client={client}><LocalizationProvider><DisplayFontContext value={loaded}>
    <ThemeSchemeContext value={params.get('theme') === 'dark' ? 'dark' : 'light'}>
      <GuideContext value={{ ready: true, active: active ? 'goals' : null, path: state === 'editor' ? '/goal-edit' : '/goals',
        rows: active ? { goals: { guide_id: 'goals', guide_version: 1, step_id: guide.steps[step].id, status: 'in_progress', revision: 1, request_id: me.userId, pending: false } } : {},
        localError: false, syncError: false, start: () => { setStep(0); setState('list'); setActive(true); }, close: () => setActive(false), dismiss: () => setActive(false),
        move: direction => { const next = Math.max(0, Math.min(1, step + direction)); setStep(next); setState(next ? 'editor' : 'list'); }, signal: noop, register: () => noop, retry: noop }}>
        <View style={{ flex: 1 }}>
          <Text style={{ padding: 8, color: '#191B24', backgroundColor: '#E9ECFF' }}>Synthetic preview · {state} · {loaded ? 'Manrope loaded' : 'font fallback'}</Text>
          {(state === 'list' || state === 'empty') ? <GoalsList data={data} household={household} onRefresh={noop} /> : state === 'editor' ?
            <GoalEditor data={data} household={household} userId={me.userId} save={save} onReload={noop} /> :
            <GoalDetail data={data} goal={goal} household={household} userId={me.userId} members={[me, partner]} save={save}
              history={goalHistory} onRefresh={noop} onMoreHistory={noop} onRetryHistory={noop} error={state === 'error'} />}
        </View>
      </GuideContext>
    </ThemeSchemeContext>
  </DisplayFontContext></LocalizationProvider></QueryClientProvider></SafeAreaProvider>;
}
registerRootComponent(Preview);
