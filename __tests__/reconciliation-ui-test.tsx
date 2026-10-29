import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { Reconciliation } from '@/features/reconciliation/reconciliation-screen';
import { LocalizationProvider } from '@/i18n/provider';
import { reconciliation } from '../test/fixtures/reconciliation';
import { household, me, partner } from '../test/fixtures/payments';
import type { useReconciliationAction } from '@/features/reconciliation/api';

jest.mock('@/global.css',()=>({}));
jest.mock('expo-router',()=>({router:{push:jest.fn(),replace:jest.fn()},useFocusEffect:jest.fn()}));
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
jest.mock('react-native-safe-area-context',()=>require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/household/api',()=>({useMyHousehold:jest.fn()}));
jest.mock('@/features/reconciliation/api',()=>({useReconciliation:jest.fn(),useReconciliationAction:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{},isSupabaseConfigured:false}));
const mutate=jest.fn();
const props={data:reconciliation,household,userId:me.userId,members:[me,partner],onRefresh:jest.fn(),
  save:{mutate,isPending:false,error:null} as unknown as ReturnType<typeof useReconciliationAction>};
const screen=(extra:Partial<typeof props>={})=><LocalizationProvider><Reconciliation {...props} {...extra}/></LocalizationProvider>;
beforeEach(()=>jest.clearAllMocks());

it('shows actual, expected and signed gap distinctly without doing financial work on mount',async()=>{
 const v=await render(screen());
 expect(v.getByText('Actual shared balance')).toBeTruthy();expect(v.getByText('$1,450.00')).toBeTruthy();expect(v.getByText('$1,500.00')).toBeTruthy();
 expect(v.getByText('-$50.00')).toBeTruthy();expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Log a missing expense'}));expect(router.push).toHaveBeenCalledWith('/quick-log');
});
it('requires review and explicit confirmation before moving a gap to our own allowance',async()=>{
 const v=await render(screen());await fireEvent.press(v.getByRole('button',{name:'Move the gap to my allowance'}));
 expect(mutate).not.toHaveBeenCalled();expect(v.getByText(/This can take an allowance below zero/)).toBeTruthy();
 await fireEvent.press(v.getByRole('button',{name:'Confirm this decision'}));
 expect(mutate).toHaveBeenCalledWith({action:'allocate',revision:8,values:{id:reconciliation.pending!.id,shares:[{userId:me.userId,amountMinor:5000}]}},expect.anything());
});
it('starts a reviewed split from the household agreement and keeps exact minor units',async()=>{
 const v=await render(screen({members:[{...me,monthlyIncomeMinor:600000},{...partner,monthlyIncomeMinor:400000}]}));
 await fireEvent.press(v.getByRole('button',{name:'Split between our allowances'}));
 expect(v.getByLabelText('My share').props.value).toBe('30.00');
 await fireEvent.changeText(v.getByLabelText('My share'),'31.01');
 await fireEvent.press(v.getByRole('button',{name:'Review proposed split'}));expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Confirm this decision'}));
 expect(mutate).toHaveBeenCalledWith(expect.objectContaining({values:{id:reconciliation.pending!.id,shares:[{userId:me.userId,amountMinor:3101},{userId:partner.userId,amountMinor:1899}]}}),expect.anything());
});
it('does not guess proportional shares when the partner has not entered an income',async()=>{
 const v=await render(screen({members:[me,{...partner,budgetSetupStep:0,monthlyIncomeMinor:0}]}));
 await fireEvent.press(v.getByRole('button',{name:'Split between our allowances'}));
 expect(v.getByLabelText('My share').props.value).toBe('');
 expect(v.getByRole('button',{name:'Review proposed split'}).props.accessibilityState.disabled).toBe(true);
});
it('blocks a stale confirmation when a partner changes the comparison',async()=>{
 const v=await render(screen());await fireEvent.press(v.getByRole('button',{name:'Move the gap to my allowance'}));
 await v.rerender(screen({data:{...reconciliation,revision:9}}));
 expect(v.getByRole('button',{name:'Confirm this decision'}).props.accessibilityState.disabled).toBe(true);expect(mutate).not.toHaveBeenCalled();
});
it('shows a partner proposal and asks only for the signed-in partner approval',async()=>{
 const shares=[{user_id:me.userId,amount_minor:2500,approved_at:null},{user_id:partner.userId,amount_minor:2500,approved_at:'2026-10-27T12:00:00Z'}];
 const v=await render(screen({data:{...reconciliation,pending:{...reconciliation.pending!,shares}}}));
 await fireEvent.press(v.getByRole('button',{name:'Review my share'}));expect(mutate).not.toHaveBeenCalled();
 await fireEvent.press(v.getByRole('button',{name:'Confirm this decision'}));
 expect(mutate).toHaveBeenCalledWith(expect.objectContaining({action:'approve',values:{id:reconciliation.pending!.id}}),expect.anything());
});
it('does not offer allowance charges for extra money or a replaced baseline',async()=>{
 const v=await render(screen({data:{...reconciliation,pending:{...reconciliation.pending!,actual_minor:155000,gap_minor:5000}}}));
 expect(v.queryByRole('button',{name:'Move the gap to my allowance'})).toBeNull();
 expect(v.getByRole('button',{name:'Review extra-money correction'})).toBeTruthy();
 await v.rerender(screen({data:{...reconciliation,pending:{...reconciliation.pending!,baseline_changed:true}}}));
 expect(v.queryByRole('button',{name:'Move the gap to my allowance'})).toBeNull();
 expect(v.getByText(/Our starting balance changed/)).toBeTruthy();
});
it('records a signed starting balance and refuses empty amounts and future dates',async()=>{
 const v=await render(screen({data:{...reconciliation,baseline:null,pending:null,expected_minor:null}}));
 expect(v.getByText(/We need a starting point first/)).toBeTruthy();
 expect(v.getByRole('button',{name:'Save balance check'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(v.getByLabelText('Actual closing balance (USD)'),'25.00');
 await fireEvent.press(v.getByRole('radio',{name:'Overdrawn'}));
 await fireEvent.press(v.getByRole('button',{name:'Save balance check'}));
 expect(mutate).toHaveBeenCalledWith({action:'check',revision:8,values:{on:'2026-10-27',actualMinor:-2500}},expect.anything());
 await fireEvent.changeText(v.getByLabelText('Closing date'),'2099-01-01');
 expect(v.getByRole('button',{name:'Save balance check'}).props.accessibilityState.disabled).toBe(true);
});
it('preserves form text on failed refresh and blocks financial actions until recovery',async()=>{
 const data={...reconciliation,pending:null};const v=await render(screen({data}));
 await fireEvent.changeText(v.getByLabelText('Actual closing balance (USD)'),'12.34');
 await v.rerender(screen({data,error:true} as Partial<typeof props>));
 expect(v.getByLabelText('Actual closing balance (USD)').props.value).toBe('12.34');
 expect(v.getByRole('button',{name:'Save balance check'}).props.accessibilityState.disabled).toBe(true);
});
