import { fireEvent, render } from '@testing-library/react-native';
import { BillSplitPanel } from '@/features/relationships/bill-split-screen';
import { BoostersPanel } from '@/features/relationships/boosters-screen';
import { GiftPanel } from '@/features/relationships/gift-panel';
import { GoalEditor } from '@/features/goals/goal-editor';
import type { GoalMutation } from '@/features/goals/ui';
import type { RelationshipMutation } from '@/features/relationships/api';
import { LocalizationProvider } from '@/i18n/provider';
import { billData, boosterData } from '../test/fixtures/relationships';
import { goalsWorkspace, jointGoal } from '../test/fixtures/goals';
import { household, me } from '../test/fixtures/payments';
jest.mock('@/global.css',()=>({}));
jest.mock('expo-router',()=>({router:{push:jest.fn(),replace:jest.fn(),back:jest.fn()},useLocalSearchParams:()=>({}),useFocusEffect:jest.fn()}));
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
jest.mock('react-native-safe-area-context',()=>require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/household/api',()=>({useMyHousehold:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{},isSupabaseConfigured:false}));
jest.mock('@/components/ui/category-picker',()=>{
 const {View,Text}=require('react-native');const {Button}=require('@/components/ui/button');
 return {CategoryPicker:({label,options,onChange,disabled}:{label:string;options:{id:string;label:string}[];onChange:(id:string)=>void;disabled?:boolean})=><View><Text>{label}</Text>{options.map(o=><Button key={o.id} title={o.label} disabled={disabled} onPress={()=>onChange(o.id)}/>)}</View>};
});
const mutate=jest.fn(),noop=jest.fn();
const save={mutate,isPending:false,error:null} as unknown as RelationshipMutation;
const billProps={household,userId:me.userId,data:billData,onRefresh:noop,save};
const boosterProps={household,userId:me.userId,goals:goalsWorkspace,data:boosterData,onRefresh:noop,save};
beforeEach(()=>jest.clearAllMocks());
it('shows the recorded payer separately from exact expected shares and confirms only the reviewed plan',async()=>{
 const v=await render(<LocalizationProvider><BillSplitPanel {...billProps}/></LocalizationProvider>);
 expect(v.getByText('Recorded payer')).toBeTruthy();expect(v.getByText('Household suggestion · not yet saved')).toBeTruthy();
 await fireEvent.press(v.getByRole('radio',{name:'Equal amounts'}));await fireEvent.press(v.getByRole('button',{name:'Review expected contributions'}));expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Confirm this decision'}));expect(mutate).toHaveBeenCalledWith({token:'bill-review',mode:'equal',weights:[]},expect.anything());
});
it('blocks a stale reviewed split while retaining the entered form',async()=>{
 const screen=(token:string)=><LocalizationProvider><BillSplitPanel {...billProps} data={{...billData,token}}/></LocalizationProvider>;
 const v=await render(screen('one'));await fireEvent.press(v.getByRole('button',{name:'Review expected contributions'}));await v.rerender(screen('two'));
 expect(v.getByRole('button',{name:'Confirm this decision'}).props.accessibilityState.disabled).toBe(true);expect(mutate).not.toHaveBeenCalled();
});
it('recovers an uncertain split even after the server returns a new token or locked period',async()=>{
 const v=await render(<LocalizationProvider><BillSplitPanel {...billProps}/></LocalizationProvider>);
 await fireEvent.press(v.getByRole('button',{name:'Review expected contributions'}));
 await v.rerender(<LocalizationProvider><BillSplitPanel {...billProps} data={{...billData,token:'new',locked:true}} save={{...save,error:{message:'Network request failed'}} as unknown as RelationshipMutation}/></LocalizationProvider>);
 expect(v.getByRole('button',{name:'Confirm this decision'}).props.accessibilityState.disabled).toBe(false);
 await fireEvent.press(v.getByRole('button',{name:'Confirm this decision'}));expect(mutate).toHaveBeenCalledWith(expect.objectContaining({token:'bill-review'}),expect.anything());
});
it('leaves a closed expense readable and prevents a new split',async()=>{
 const v=await render(<LocalizationProvider><BillSplitPanel {...billProps} data={{...billData,locked:true}}/></LocalizationProvider>);
 expect(v.getByText('Weekly groceries')).toBeTruthy();expect(v.getByRole('button',{name:'Review expected contributions'}).props.accessibilityState.disabled).toBe(true);
});
it('reviews a gift from only the signed-in allowance and never renders a private remainder',async()=>{
 const v=await render(<LocalizationProvider><GiftPanel goal={jointGoal} data={goalsWorkspace} household={household} save={save as unknown as GoalMutation}/></LocalizationProvider>);
 await fireEvent.press(v.getByRole('button',{name:'Give from my private allowance'}));await fireEvent.changeText(v.getByLabelText('Amount'),'10.01');
 await fireEvent.press(v.getByRole('button',{name:'Review my gift'}));expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Give this amount'}));expect(mutate).toHaveBeenCalledWith({action:'gift',revision:8,values:{id:jointGoal.id,version:3,amountMinor:1001}},expect.anything());
 expect(v.queryByText(/Remaining allowance/)).toBeNull();
});
it('requires synced-week acknowledgement before a booster and sends the chosen source and destination',async()=>{
 const v=await render(<LocalizationProvider><BoostersPanel {...boosterProps}/></LocalizationProvider>);
 await fireEvent.press(v.getByRole('button',{name:/Savings ·.*40.00/}));await fireEvent.press(v.getByRole('button',{name:jointGoal.name}));await fireEvent.changeText(v.getByLabelText('Amount'),'10');
 expect(v.getByRole('button',{name:'Review this booster'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent(v.getByRole('switch',{name:'We have checked that both partners’ expenses for this week have synced.'}), 'valueChange', true);
 await fireEvent.press(v.getByRole('button',{name:'Review this booster'}));expect(mutate).not.toHaveBeenCalled();await fireEvent.press(v.getByRole('button',{name:'Confirm this decision'}));
 expect(mutate).toHaveBeenCalledWith({token:boosterData.token,action:'boost',values:{categoryId:boosterData.candidates[0].category_id,weekOn:'2026-10-19',amountMinor:1000,goalId:jointGoal.id,goalVersion:3}},expect.anything());
});
it('explains the first full week without inventing a monthly-to-weekly budget',async()=>{
 const v=await render(<LocalizationProvider><BoostersPanel {...boosterProps} data={{...boosterData,budgets:[],candidates:[]}}/></LocalizationProvider>);
 expect(v.getByText(/No completed weekly budget/)).toBeTruthy();expect(v.queryByRole('button',{name:'Review this booster'})).toBeNull();
 await fireEvent.press(v.getByRole('button',{name:'Set weekly category budgets'}));expect(v.getByLabelText('Starting Monday').props.value).toBe('2026-11-02');
});
it('saves sinking-fund purpose only with the reviewed target and date',async()=>{
 const v=await render(<LocalizationProvider><GoalEditor data={goalsWorkspace} household={household} userId={me.userId} save={save as unknown as GoalMutation} onReload={noop}/></LocalizationProvider>);
 await fireEvent.press(v.getByRole('radio',{name:'Sinking fund'}));await fireEvent.changeText(v.getByLabelText('Goal name'),'Annual insurance');await fireEvent.changeText(v.getByLabelText('Target amount (USD)'),'1200');
 await fireEvent.changeText(v.getByLabelText('Target date'),'2027-10-27');await fireEvent.press(v.getByRole('button',{name:'Review our goal plan'}));await fireEvent.press(v.getByRole('button',{name:'Save our goal plan'}));
 expect(mutate).toHaveBeenCalledWith(expect.objectContaining({action:'save',values:expect.objectContaining({kind:'sinking',name:'Annual insurance',targetMinor:120000,deadlineOn:'2027-10-27'})}),expect.anything());
});
it('explains unavailable income shares in an equal-default household',async()=>{
 const data={...billData,default_mode:'equal' as const,default_ready:true,members:billData.members.map(m=>({...m,setup_step:0,income_minor:0}))};
 const v=await render(<LocalizationProvider><BillSplitPanel {...billProps} data={data}/></LocalizationProvider>);await fireEvent.press(v.getByRole('radio',{name:'Income ratio'}));
 expect(v.getByText(/Income-based shares need both partners/)).toBeTruthy();expect(v.getByRole('button',{name:'Review expected contributions'}).props.accessibilityState.disabled).toBe(true);
});
