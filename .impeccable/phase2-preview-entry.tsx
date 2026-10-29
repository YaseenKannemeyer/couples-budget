/** Synthetic state fixtures. No account, financial RPC, push or guide transport is mounted. */
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DisplayFontContext } from '../src/components/ui/font-context';
import { ThemeSchemeContext } from '../src/hooks/use-theme';
import { LocalizationProvider } from '../src/i18n/provider';
import { BillSplitPanel } from '../src/features/relationships/bill-split-screen';
import { BoostersPanel } from '../src/features/relationships/boosters-screen';
import { GoalDetail } from '../src/features/goals/goal-detail';
import { GoalEditor } from '../src/features/goals/goal-editor';
import { GuideContext } from '../src/features/guides/context';
import type { GoalMutation } from '../src/features/goals/ui';
import type { RelationshipMutation } from '../src/features/relationships/api';
import { goalsWorkspace, jointGoal, goalHistory } from '../test/fixtures/goals';
import { boosterData, billData } from '../test/fixtures/relationships';
import { household, me, partner } from '../test/fixtures/payments';
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const noop = () => {};
function Preview() {
  const params = new URLSearchParams(window.location.search), state = params.get('state') ?? 'boosters';
  const [loaded, fontError] = useFonts({ Manrope: { uri: 'http://127.0.0.1:8097/Manrope.ttf' } });
  const save = { mutate: noop, isPending: false, error: null } as unknown as RelationshipMutation;
  if (!loaded && !fontError) return null;
  const goal = state === 'sinking' ? { ...jointGoal, name: 'Annual car insurance', kind: 'sinking' as const } : jointGoal;
  return <SafeAreaProvider><QueryClientProvider client={client}><LocalizationProvider><DisplayFontContext value={loaded}>
    <ThemeSchemeContext value={params.get('theme') === 'dark' ? 'dark' : 'light'}><GuideContext value={null}>
      <View style={{ flex: 1 }}><Text style={{ padding: 8, color: '#191B24', backgroundColor: '#E9ECFF' }}>Synthetic preview · {state} · {loaded ? 'Manrope loaded' : 'font fallback'}</Text>
      {state === 'bill' || state === 'locked' ? <BillSplitPanel household={household} userId={me.userId} data={{ ...billData, locked: state === 'locked' }} save={save} onRefresh={noop} /> :
        state === 'gift' || state === 'sinking' ? <GoalDetail data={goalsWorkspace} goal={goal} household={household} userId={me.userId} members={[me, partner]}
          save={save as unknown as GoalMutation} history={state === 'gift' ? [{ ...goalHistory[0], source: 'gift' }, goalHistory[1]] : goalHistory} onRefresh={noop} onMoreHistory={noop} onRetryHistory={noop} /> :
        state === 'editor' ? <GoalEditor data={goalsWorkspace} household={household} userId={me.userId} initialKind="sinking" save={save as unknown as GoalMutation} onReload={noop} /> :
          <BoostersPanel household={household} userId={me.userId} goals={goalsWorkspace} data={state === 'empty' ? { ...boosterData, candidates: [], budgets: [] } : boosterData} save={save} onRefresh={noop} error={state === 'error'} />}
      </View>
    </GuideContext></ThemeSchemeContext>
  </DisplayFontContext></LocalizationProvider></QueryClientProvider></SafeAreaProvider>;
}
registerRootComponent(Preview);
