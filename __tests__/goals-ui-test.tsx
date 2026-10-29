import { fireEvent, render } from '@testing-library/react-native';
import { GoalDetail } from '@/features/goals/goal-detail';
import { GoalEditor } from '@/features/goals/goal-editor';
import { GoalsList } from '@/features/goals/goals-screen';
import type { GoalMutation } from '@/features/goals/ui';
import { LocalizationProvider } from '@/i18n/provider';
import { goalsWorkspace, jointGoal, goalHistory } from '../test/fixtures/goals';
import { household, me, partner } from '../test/fixtures/payments';
jest.mock('@/global.css',()=>({}));
jest.mock('expo-router',()=>({router:{push:jest.fn(),replace:jest.fn()},useLocalSearchParams:()=>({}),useFocusEffect:jest.fn()}));
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
jest.mock('react-native-safe-area-context',()=>require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/household/api',()=>({useMyHousehold:jest.fn()}));
jest.mock('@/features/goals/api',()=>({useGoals:jest.fn(),useGoalAction:jest.fn(),useGoalHistory:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{},isSupabaseConfigured:false}));
const mutate=jest.fn(),noop=jest.fn();
const save={mutate,isPending:false,error:null} as unknown as GoalMutation;
const detailProps={data:goalsWorkspace,goal:jointGoal,household,userId:me.userId,members:[me,partner],history:goalHistory,
  onRefresh:noop,onMoreHistory:noop,onRetryHistory:noop,save};
beforeEach(()=>jest.clearAllMocks());
it('shows both partners at 100% of their own different monthly shares',async()=>{
 const v=await render(<LocalizationProvider><GoalDetail {...detailProps}/></LocalizationProvider>);
 expect(v.getAllByText('100%')).toHaveLength(2);
 expect(v.getByText('$1,200.00 contributed toward a monthly share of $1,200.00.')).toBeTruthy();
 expect(v.getByText('$800.00 contributed toward a monthly share of $800.00.')).toBeTruthy();
 expect(mutate).not.toHaveBeenCalled();
});
it('reviews an own contribution and sends exact integer money only after confirmation',async()=>{
 const v=await render(<LocalizationProvider><GoalDetail {...detailProps}/></LocalizationProvider>);
 await fireEvent.changeText(v.getByLabelText('My contribution (USD)'),'100.01');
 await fireEvent.press(v.getByRole('button',{name:'Review my contribution'}));expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Confirm this decision'}));
 expect(mutate).toHaveBeenCalledWith({action:'contribute',revision:8,values:{id:jointGoal.id,version:3,amountMinor:10001,on:'2026-10-27'}},expect.anything());
});
it('blocks a stale reviewed contribution after a partner changes the goal',async()=>{
 const screen=(revision:number)=><LocalizationProvider><GoalDetail {...detailProps} data={{...goalsWorkspace,revision}}/></LocalizationProvider>;
 const v=await render(screen(8));await fireEvent.changeText(v.getByLabelText('My contribution (USD)'),'10');
 await fireEvent.press(v.getByRole('button',{name:'Review my contribution'}));await v.rerender(screen(9));
 expect(v.getByRole('button',{name:'Confirm this decision'}).props.accessibilityState.disabled).toBe(true);expect(mutate).not.toHaveBeenCalled();
});
it('never offers correction of a partner entry or an already reversed own entry',async()=>{
 const v=await render(<LocalizationProvider><GoalDetail {...detailProps}/></LocalizationProvider>);
 await fireEvent.press(v.getByRole('button',{name:'Contribution history'}));
 expect(v.getByRole('button',{name:'Correct my $1,200.00 contribution'})).toBeTruthy();
 expect(v.queryByRole('button',{name:'Correct my $800.00 contribution'})).toBeNull();
 await v.rerender(<LocalizationProvider><GoalDetail {...detailProps} history={[{...goalHistory[0],reversed:true},goalHistory[1]]}/></LocalizationProvider>);
 expect(v.queryByRole('button',{name:'Correct my $1,200.00 contribution'})).toBeNull();
});
it('keeps missing income shares pending rather than showing zero-percent blame',async()=>{
 const goal={...jointGoal,month:{...jointGoal.month,split_ready:false,shares:jointGoal.month.shares.map(s=>({...s,target_minor:null}))}};
 const v=await render(<LocalizationProvider><GoalDetail {...detailProps} goal={goal}/></LocalizationProvider>);
 expect(v.getAllByText('Pending')).toHaveLength(2);expect(v.queryByText('0%')).toBeNull();
});
it('refuses overfunding, future dates and saves during a failed refresh while preserving the draft',async()=>{
 const screen=(error=false)=><LocalizationProvider><GoalDetail {...detailProps} error={error}/></LocalizationProvider>;
 const v=await render(screen());await fireEvent.changeText(v.getByLabelText('My contribution (USD)'),'4000.01');
 expect(v.getByRole('button',{name:'Review my contribution'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(v.getByLabelText('My contribution (USD)'),'10');await fireEvent.changeText(v.getByLabelText('Contribution date'),'2099-01-01');
 expect(v.getByRole('button',{name:'Review my contribution'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(v.getByLabelText('Contribution date'),'2026-10-27');await v.rerender(screen(true));
 expect(v.getByLabelText('My contribution (USD)').props.value).toBe('10');expect(v.getByRole('button',{name:'Review my contribution'}).props.accessibilityState.disabled).toBe(true);
});
it('celebrates a funded goal and does not invite another contribution or rank a partner behind',async()=>{
 const goal={...jointGoal,saved_minor:jointGoal.target_minor};
 const v=await render(<LocalizationProvider><GoalDetail {...detailProps} goal={goal}/></LocalizationProvider>);
 expect(v.getByText('We reached our goal, together!')).toBeTruthy();expect(v.queryByRole('button',{name:'Review my contribution'})).toBeNull();
 expect(v.queryByText('Our monthly shares')).toBeNull();
});
it('creates a reviewed goal plan without claiming any money was already saved',async()=>{
 const v=await render(<LocalizationProvider><GoalEditor data={goalsWorkspace} household={household} userId={me.userId} onReload={noop} save={save}/></LocalizationProvider>);
 await fireEvent.changeText(v.getByLabelText('Goal name'),'Our home deposit');await fireEvent.changeText(v.getByLabelText('Target amount (USD)'),'5000');
 await fireEvent.changeText(v.getByLabelText('Target date'),'2027-10-27');await fireEvent.press(v.getByRole('button',{name:'Review our goal plan'}));
 expect(mutate).not.toHaveBeenCalled();await fireEvent.press(v.getByRole('button',{name:'Save our goal plan'}));
 expect(mutate).toHaveBeenCalledWith(expect.objectContaining({action:'save',values:expect.objectContaining({id:null,targetMinor:500000,name:'Our home deposit'})}),expect.anything());
});
it('prevents an edit from lowering the target below saved money and keeps the original version on refresh',async()=>{
 const screen=(version=3)=><LocalizationProvider><GoalEditor data={{...goalsWorkspace,goals:[{...jointGoal,version}]}} id={jointGoal.id} household={household} userId={me.userId} onReload={noop} save={save}/></LocalizationProvider>;
 const v=await render(screen());await fireEvent.changeText(v.getByLabelText('Target amount (USD)'),'2999.99');
 expect(v.getByRole('button',{name:'Review our goal plan'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(v.getByLabelText('Target amount (USD)'),'8000');await v.rerender(screen(4));
 await fireEvent.press(v.getByRole('button',{name:'Review our goal plan'}));await fireEvent.press(v.getByRole('button',{name:'Save our goal plan'}));
 expect(mutate).toHaveBeenCalledWith(expect.objectContaining({values:expect.objectContaining({version:3})}),expect.anything());
});
it('explains an empty goal list without fabricated balances or history',async()=>{
 const v=await render(<LocalizationProvider><GoalsList data={{...goalsWorkspace,goals:[]}} household={household} onRefresh={noop}/></LocalizationProvider>);
 expect(v.getByRole('button',{name:'Create a savings goal'})).toBeTruthy();expect(v.getByText(/Nothing is counted as saved/)).toBeTruthy();
 expect(v.queryByText('$0.00')).toBeNull();
});
it('keeps an uncertain final gift review mounted while blocking competing goal decisions',async()=>{
 const goal={...jointGoal,saved_minor:jointGoal.target_minor-1000};
 const v=await render(<LocalizationProvider><GoalDetail {...detailProps} goal={goal}/></LocalizationProvider>);
 await fireEvent.press(v.getByRole('button',{name:'Give from my private allowance'}));await fireEvent.changeText(v.getByLabelText('Amount'),'10');await fireEvent.press(v.getByRole('button',{name:'Review my gift'}));
 const variables={action:'gift' as const,revision:8,values:{id:goal.id,version:goal.version,amountMinor:1000}};
 await v.rerender(<LocalizationProvider><GoalDetail {...detailProps} goal={{...goal,saved_minor:goal.target_minor,version:4}} data={{...goalsWorkspace,revision:9}}
   save={{...save,error:{message:'Network request failed'},variables} as unknown as GoalMutation}/></LocalizationProvider>);
 expect(v.getByRole('button',{name:'Give this amount'}).props.accessibilityState.disabled).toBe(false);
 await fireEvent.press(v.getByRole('button',{name:'Goal settings'}));expect(v.getByRole('button',{name:'Edit this goal'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(v.getByRole('button',{name:'Give this amount'}));expect(mutate).toHaveBeenCalledWith(variables,expect.anything());
});
