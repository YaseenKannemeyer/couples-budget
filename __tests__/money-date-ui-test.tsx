import { fireEvent, render } from '@testing-library/react-native';
import { MoneyDate, MoneyDateScreen, type MoneyDateMutation } from '@/features/money-date/money-date-screen';
import { useMyHousehold } from '@/features/household/api';
import { useMoneyDate, useMoneyDateAction } from '@/features/money-date/api';
import { moneyDateWorkspace } from '@/features/money-date/schema';
import { moneyDateModel } from '@/features/money-date/model';
import { LocalizationProvider } from '@/i18n/provider';
import { moneyDate, lockedMoneyDate } from '../test/fixtures/money-date';
import { household, me } from '../test/fixtures/payments';
jest.mock('@/global.css',()=>({}));
jest.mock('expo-router',()=>({router:{push:jest.fn(),replace:jest.fn()},useFocusEffect:jest.fn()}));
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
jest.mock('react-native-safe-area-context',()=>require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/household/api',()=>({useMyHousehold:jest.fn()}));
jest.mock('@/features/money-date/api',()=>({useMoneyDate:jest.fn(),useMoneyDateAction:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{},isSupabaseConfigured:false}));
const mutate=jest.fn(),noop=jest.fn();const save={mutate,isPending:false,error:null} as unknown as MoneyDateMutation;
const props={household,userId:me.userId,onMonth:noop,onRefresh:noop,save};
const screen=(data=moneyDate,initialStep=0,error=false)=><LocalizationProvider><MoneyDate {...props} data={data} initialStep={initialStep} error={error}/></LocalizationProvider>;
beforeEach(()=>jest.clearAllMocks());
const raw = (data: typeof moneyDate) => ({ ...data, facts: { ...data.facts, flow: { ...data.facts.flow, categories: data.facts.flow.categories.map(c => ({ ...c, household_id: c.householdId, sort_order: c.sortOrder, owner_id: c.ownerId, starter_key: c.starterKey })) } } });
it('validates real contract fixtures, preserves unknown comparisons, and rejects unsafe money',()=>{
 expect(moneyDateWorkspace.parse(raw(moneyDate)).facts.gap_minor).toBe(0);expect(moneyDateWorkspace.parse(raw(lockedMoneyDate)).period.snapshot?.allowances.length).toBe(2);
 expect(moneyDateWorkspace.safeParse({...moneyDate,facts:{...moneyDate.facts,expected_minor:undefined}}).success).toBe(false);
 expect(moneyDateWorkspace.safeParse({...moneyDate,facts:{...moneyDate.facts,gap_minor:9007199254740992}}).success).toBe(false);
 expect(moneyDateModel(moneyDate,me.userId).bills[0].name).toBe('Internet');
});
it('starts with real wins and moving through the five steps never changes money',async()=>{
 const v=await render(screen());expect(v.getByText('Groceries')).toBeTruthy();expect(v.getByText('$115.00')).toBeTruthy();
 for(const title of ['Clean-up','Look ahead','Adjust together','Agree and close'])await fireEvent.press(v.getByRole('button',{name:`Next: ${title}`}));
 expect(v.getByText('5 of 5 · Agree and close')).toBeTruthy();expect(mutate).not.toHaveBeenCalled();
 expect(v.getByRole('button',{name:'Lock month and start next'}).props.accessibilityState.disabled).toBe(true);
});
it('reviews a signed closing balance and submits only after explicit confirmation',async()=>{
 const v=await render(screen(moneyDate,1));await fireEvent.changeText(v.getByLabelText('Actual shared balance'),'-125.50');
 await fireEvent.press(v.getByRole('button',{name:'Review closing balance'}));expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Confirm action'}));
 expect(mutate).toHaveBeenCalledWith({action:'check',token:'review-a',month:'2026-10-01',values:{actualMinor:-12550}},expect.anything());
});
it('requires fresh review after a shared change and prevents writes during a failed refresh',async()=>{
 const v=await render(screen(moneyDate,4));await fireEvent.press(v.getByRole('button',{name:'Review my approval'}));
 await v.rerender(screen({...moneyDate,token:'review-b'},4));
 expect(v.getByRole('button',{name:'Confirm action'}).props.accessibilityState.disabled).toBe(true);
 expect(mutate).not.toHaveBeenCalled();await v.rerender(screen(moneyDate,4,true));
 expect(v.getByRole('button',{name:'Review my approval'}).props.accessibilityState.disabled).toBe(true);
});
it('shows the opening-balance limitation before approving and requires an explicit synced acknowledgement',async()=>{
 const data={...moneyDate,facts:{...moneyDate.facts,expected_minor:null,gap_minor:null}};
 const v=await render(screen(data,4));expect(v.getByText(/cannot verify whether there was unlogged spending/)).toBeTruthy();
 await fireEvent.press(v.getByRole('button',{name:'Review my approval'}));expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Confirm action'}));expect(mutate).toHaveBeenCalledWith(expect.objectContaining({action:'approve',values:{synced:true}}),expect.anything());
});
it('proposes exact allowance shares without charging either person before approval',async()=>{
 const data={...moneyDate,ready:false,facts:{...moneyDate.facts,gap_minor:-1000,expected_minor:181000}};
 const v=await render(screen(data,1));await fireEvent.changeText(v.getByLabelText('My allowance share'),'3.33');
 await fireEvent.press(v.getByRole('button',{name:'Review allowance shares'}));expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Confirm action'}));
 expect(mutate).toHaveBeenCalledWith(expect.objectContaining({action:'options',values:expect.objectContaining({shares:[{user_id:me.userId,amount_minor:333},{user_id:moneyDate.facts.members[1].user_id,amount_minor:667}]})}),expect.anything());
});
it('reviews a temporary split and savings release, and refuses overdraws',async()=>{
 const v=await render(screen(moneyDate,3));await fireEvent.press(v.getByRole('radio',{name:'Equal (50/50)'}));
 await fireEvent.changeText(v.getByLabelText('Release from Our summer trip'),'3001');expect(v.getByRole('button',{name:'Review optional changes'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(v.getByLabelText('Release from Our summer trip'),'150');await fireEvent.press(v.getByRole('button',{name:'Review optional changes'}));
 expect(mutate).not.toHaveBeenCalled();await fireEvent.press(v.getByRole('button',{name:'Confirm action'}));
 expect(mutate).toHaveBeenCalledWith(expect.objectContaining({action:'options',values:expect.objectContaining({nextSplit:'equal',drawdowns:[{goal_id:moneyDate.facts.goals[0].id,amount_minor:15000}]})}),expect.anything());
});
it('requires both approvals for locking and never offers writes or replays a celebration in closed history',async()=>{
 const both={...moneyDate,approvals:moneyDate.approvals.map(a=>({...a,approved:true}))};
 const v=await render(screen(both,4));await fireEvent.press(v.getByRole('button',{name:'Lock month and start next'}));
 expect(mutate).not.toHaveBeenCalled();await fireEvent.press(v.getByRole('button',{name:'Confirm action'}));expect(mutate).toHaveBeenCalledWith(expect.objectContaining({action:'lock'}),expect.anything());
 await v.rerender(screen(lockedMoneyDate,4));expect(v.queryByRole('button',{name:'Lock month and start next'})).toBeNull();expect(v.queryByText('High five. Month closed.')).toBeNull();
 await fireEvent.press(v.getByRole('button',{name:'Closed month allowance totals'}));expect(v.getByText('$184.50')).toBeTruthy();
});
it('celebrates only a successful real close response, with a static reduced-motion message',async()=>{
 mutate.mockImplementationOnce((_input,callbacks)=>callbacks.onSuccess({period_id:moneyDate.period.id,locked:true}));
 const data={...moneyDate,approvals:moneyDate.approvals.map(a=>({...a,approved:true}))};
 const v=await render(screen(data,4));await fireEvent.press(v.getByRole('button',{name:'Lock month and start next'}));
 expect(v.queryByText('High five. Month closed.')).toBeNull();await fireEvent.press(v.getByRole('button',{name:'Confirm action'}));
 expect(v.getByText('High five. Month closed.')).toBeTruthy();expect(v.getByText('You made time for your money together. The next month is ready.')).toBeTruthy();
});

it('pins the server-selected month so closing cannot replace its success view with the next open month',async()=>{
 jest.mocked(useMyHousehold).mockReturnValue({data:{household,me},isError:false,refetch:noop} as never);
 jest.mocked(useMoneyDate).mockReturnValue({data:moneyDate,isError:false,isFetching:false,refetch:noop} as never);
 jest.mocked(useMoneyDateAction).mockReturnValue(save);
 await render(<LocalizationProvider><MoneyDateScreen/></LocalizationProvider>);
 expect(useMoneyDate).toHaveBeenLastCalledWith(household.id,'2026-10-01');
});
it('keeps an unrecorded historic allowance and its remaining balance unknown',async()=>{
 const data={...lockedMoneyDate,period:{...lockedMoneyDate.period,snapshot:{...lockedMoneyDate.period.snapshot!,allowances:[{user_id:me.userId,allowance_minor:null,spent_minor:700}]}}};
 const v=await render(screen(data,4));await fireEvent.press(v.getByRole('button',{name:'Closed month allowance totals'}));
 expect(v.getAllByText('Unknown')).toHaveLength(2);expect(v.getByText('$7.00')).toBeTruthy();
});
