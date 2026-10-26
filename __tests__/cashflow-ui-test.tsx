import { fireEvent,render } from '@testing-library/react-native';
import { cashflow } from '../test/fixtures/cashflow';
import { useMyHousehold } from '@/features/household/api';
import { useCashflow, useCashflowAction } from '@/features/cashflow/api';
import { CashflowCalendar, CashflowScreen } from '@/features/cashflow/cashflow-screen';
import { IncomeEntry } from '@/features/cashflow/income-screens';
import { LocalizationProvider } from '@/i18n/provider';
jest.mock('@/global.css',()=>({}));
jest.mock('expo-router',()=>({router:{push:jest.fn(),replace:jest.fn(),back:jest.fn()},useLocalSearchParams:()=>({})}));
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
jest.mock('react-native-safe-area-context',()=>require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/payments/api',()=>({usePaymentWorkspace:jest.fn()}));
jest.mock('@/features/household/api',()=>({useMyHousehold:jest.fn()}));
jest.mock('@/features/cashflow/api',()=>({useCashflowAction:jest.fn(),useCashflow:jest.fn(),useMyIncome:jest.fn()}));
const mutate=jest.fn();
const props={householdId:'h',currency:'USD',timezone:'Pacific/Auckland',today:'2026-10-25'};
beforeEach(()=>{jest.clearAllMocks();jest.mocked(useCashflowAction).mockReturnValue({mutate,isPending:false,error:null} as unknown as ReturnType<typeof useCashflowAction>);});
it('shows setup without inventing a balance and exposes calendar days as date-labelled buttons',async()=>{
  const v=await render(<LocalizationProvider><CashflowCalendar data={{...cashflow,balance:null}} currency="USD" timezone="Pacific/Auckland" onRefresh={jest.fn()}/></LocalizationProvider>);
  expect(v.getByText('Start with a confirmed shared closing balance to see a forecast.')).toBeTruthy();
  await fireEvent.press(v.getByRole('button',{name:'Oct 26, 2026 · 1 item'}));
  expect(v.getByText('Internet')).toBeTruthy();
  expect(v.getByRole('button',{name:'Correct this forecast item'})).toBeTruthy();
});
it('saves an undated irregular bonus without guessing its amount or sharing it',async()=>{
  const v=await render(<LocalizationProvider><IncomeEntry {...props}/></LocalizationProvider>);
  await fireEvent.changeText(v.getByLabelText('Private income name'),'Maybe bonus');
  await fireEvent.press(v.getByRole('button',{name:'Save income occurrence'}));
  expect(mutate).toHaveBeenCalledWith({kind:'occurrence',id:null,version:0,values:{name:'Maybe bonus',expectedOn:null,expectedAmountMinor:null,status:'expected',
    actualOn:null,actualAmountMinor:null,sharedOn:null,sharedAmountMinor:0,sharedReceived:false}},expect.anything());
});
it('keeps actual income and transfer confirmation separate and refuses contributions above known pay',async()=>{
  const v=await render(<LocalizationProvider><IncomeEntry {...props}/></LocalizationProvider>);
  await fireEvent.changeText(v.getByLabelText('Private income name'),'Salary');
  await fireEvent.press(v.getByRole('radio',{name:'Received privately'}));
  await fireEvent.changeText(v.getByLabelText('Income actually received (USD)'),'100.00');
  await fireEvent.changeText(v.getByLabelText('Amount going to shared funds (USD)'),'120.00');
  await fireEvent.changeText(v.getByLabelText('Shared contribution date'),'2026-10-25');
  expect(v.getByRole('button',{name:'Save income occurrence'}).props.accessibilityState.disabled).toBe(true);
  await fireEvent.changeText(v.getByLabelText('Amount going to shared funds (USD)'),'50.00');
  await fireEvent.press(v.getByRole('button',{name:'Save income occurrence'}));
  expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({values:expect.objectContaining({status:'received',actualAmountMinor:10000,sharedAmountMinor:5000,sharedReceived:false})}),expect.anything());
  await fireEvent.press(v.getByRole('radio',{name:'Transferred to shared funds'}));
  await fireEvent.press(v.getByRole('button',{name:'Save income occurrence'}));
  expect(mutate).toHaveBeenLastCalledWith(expect.objectContaining({values:expect.objectContaining({sharedReceived:true})}),expect.anything());
});
it('dismisses one occurrence, zeros the shared expectation and preserves the original draft version',async()=>{
  const row={id:'entry',name:'Income',expected_on:'2026-10-26',expected_amount_minor:10000,status:'expected' as const,actual_on:null,actual_amount_minor:null,
    shared_on:'2026-10-26',shared_amount_minor:5000,shared_received:false,version:2,overridden:false};
  const v=await render(<LocalizationProvider><IncomeEntry {...props} row={row}/></LocalizationProvider>);
  await v.rerender(<LocalizationProvider><IncomeEntry {...props} row={{...row,version:3}}/></LocalizationProvider>);
  await fireEvent.press(v.getByRole('radio',{name:'Dismissed'}));
  await fireEvent.press(v.getByRole('button',{name:'Save income occurrence'}));
  expect(mutate).toHaveBeenCalledWith(expect.objectContaining({id:'entry',version:2,values:expect.objectContaining({status:'dismissed',sharedAmountMinor:0,sharedReceived:false})}),expect.anything());
});

it('shows household-loading failures with a retry instead of an indefinite dependent-query spinner',async()=>{
  const retry=jest.fn();
  jest.mocked(useMyHousehold).mockReturnValue({data:undefined,isError:true,refetch:retry} as unknown as ReturnType<typeof useMyHousehold>);
  jest.mocked(useCashflow).mockReturnValue({data:undefined,isError:false,refetch:jest.fn()} as unknown as ReturnType<typeof useCashflow>);
  const v=await render(<LocalizationProvider><CashflowScreen/></LocalizationProvider>);
  expect(v.getByText(/We couldn’t load the calendar/)).toBeTruthy();
  await fireEvent.press(v.getByRole('button',{name:'Try again'}));expect(retry).toHaveBeenCalled();
});

it('keeps the calendar window label after an amount-only correction', async () => {
  const data = { ...cashflow, overrides: [{ item_key: `payment:${cashflow.payments[0].id}:2026-10-26`, due_on: null, amount_minor: 15000, dismissed: false, version: 1 }] };
  const view = await render(<LocalizationProvider><CashflowCalendar data={data} currency="USD" timezone="UTC" onRefresh={jest.fn()} /></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button', { name: 'Oct 26, 2026 · 1 item' }));
  expect(view.getByText('Due window ends Oct 28, 2026; reserved from the first day.')).toBeTruthy();
});
