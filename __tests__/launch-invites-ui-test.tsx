import { fireEvent, render } from '@testing-library/react-native';
import { router } from 'expo-router';
import { InviteReview, JoinHouseholdForm } from '@/features/household/join-form';
import { useInvitePreview, useJoinHousehold } from '@/features/household/api';
import { LocalizationProvider } from '@/i18n/provider';
import type { InvitePreview } from '@/features/household/schema';

jest.mock('@/global.css', () => ({}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('expo-localization', () => ({ getLocales: () => [{ languageTag: 'en-US' }], useLocales: () => [{ languageTag: 'en-US' }], useCalendars: () => [{ timeZone: 'UTC' }] }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/household/api', () => ({ useInvitePreview: jest.fn(), useJoinHousehold: jest.fn() }));
const preview: InvitePreview = { household_id:'00000000-0000-4000-8000-000000000001',name:'Our home',base_currency:'USD',split_mode:'proportional',revision:12,inviter_name:'Alex',allowance_minor:45000,costs:[{name:'Rent',amount_minor:150000}] };
const mutateAsync=jest.fn(async()=>{}), reset=jest.fn();
const mutation = (error: unknown=null) => ({mutateAsync,reset,isPending:false,error}) as unknown as ReturnType<typeof useJoinHousehold>;
const show = (element: React.ReactNode) => render(<LocalizationProvider>{element}</LocalizationProvider>);
beforeEach(()=>{
 jest.clearAllMocks();
 jest.mocked(useJoinHousehold).mockReturnValue(mutation());
 jest.mocked(useInvitePreview).mockImplementation(code=>({data:code?preview:undefined,error:null,isFetching:false}) as ReturnType<typeof useInvitePreview>);
});
it('prefills the deep-link code and requires a separate review before joining',async()=>{
 const view=await show(<JoinHouseholdForm initialCode="ABCD-EFGH" />);
 expect(view.getByLabelText('Invite code').props.value).toBe('ABCD-EFGH');
 await fireEvent.changeText(view.getByLabelText('Your first name'),'Sam');
 await fireEvent.press(view.getByRole('button',{name:'Review invitation'}));
 expect(mutateAsync).not.toHaveBeenCalled();
 expect(view.getByText('Alex prepared a plan for you')).toBeTruthy();
 expect(view.getByText('Rent')).toBeTruthy();
 await fireEvent.changeText(view.getByLabelText('Your monthly private allowance (USD)'),'400');
 await fireEvent.press(view.getByRole('button',{name:'Confirm allowance and join'}));
 expect(mutateAsync).toHaveBeenCalledWith({inviteCode:'ABCDEFGH',displayName:'Sam',revision:12,allowanceMinor:40000});
 expect(router.replace).toHaveBeenCalledWith('/budget');
});
it('freezes reviewed facts during a background update and offers explicit stale-plan recovery',async()=>{
 const onBack=jest.fn();
 const view=await show(<InviteReview data={preview} code="ABCDEFGH" displayName="Sam" join={mutation()} onBack={onBack}/>);
 await fireEvent.changeText(view.getByLabelText('Your monthly private allowance (USD)'),'420');
 await view.rerender(<LocalizationProvider><InviteReview data={{...preview,revision:13,allowance_minor:90000}} code="ABCDEFGH" displayName="Sam" join={mutation({message:'Budget plan changed'})} onBack={onBack}/></LocalizationProvider>);
 expect(view.getByLabelText('Your monthly private allowance (USD)').props.value).toBe('420');
 expect(view.getByRole('button',{name:'Confirm allowance and join'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(view.getByRole('button',{name:'Review the latest invitation'}));
 expect(onBack).toHaveBeenCalled();
 expect(mutateAsync).not.toHaveBeenCalled();
});
it('accepts a deliberate zero allowance and rejects invalid amounts',async()=>{
 const view=await show(<InviteReview data={{...preview,allowance_minor:null}} code="ABCDEFGH" displayName="Sam" join={mutation()} onBack={jest.fn()}/>);
 await fireEvent.changeText(view.getByLabelText('Your monthly private allowance (USD)'),'-1');
 expect(view.getByRole('button',{name:'Confirm allowance and join'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.changeText(view.getByLabelText('Your monthly private allowance (USD)'),'0');
 await fireEvent.press(view.getByRole('button',{name:'Confirm allowance and join'}));
 expect(mutateAsync).toHaveBeenCalledWith(expect.objectContaining({allowanceMinor:0}));
});
