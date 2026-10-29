import { fireEvent, render } from '@testing-library/react-native';
import { Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { InviteCard } from '@/features/household/invite-card';
import { LocalizationProvider } from '@/i18n/provider';
import { household } from '../test/fixtures/payments';
jest.mock('@/global.css',()=>({}));
jest.mock('expo-clipboard',()=>({setStringAsync:jest.fn(async()=>true)}));
jest.mock('expo-linking',()=>({createURL:(path:string,options:{queryParams:{code:string}})=>`couplesbudget:/${path}?code=${options.queryParams.code}`}));
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
jest.mock('@/features/household/api',()=>({useRegenerateInviteCode:()=>({mutate:jest.fn(),isPending:false,error:null}),useSaveInviteAllowance:()=>({mutateAsync:jest.fn(),isPending:false,error:null}),useMyHousehold:()=>({refetch:jest.fn()})}));
beforeEach(()=>jest.clearAllMocks());
afterEach(()=>jest.restoreAllMocks());
it('shares the saved proposal as an invitation link without putting amounts in the message',async()=>{
 const share=jest.spyOn(Share,'share').mockResolvedValue({action:Share.sharedAction,activityType:undefined});
 const view=await render(<LocalizationProvider><InviteCard household={{...household,inviteAllowanceMinor:45000}}/></LocalizationProvider>);
 await fireEvent.press(view.getByRole('button',{name:'Share invite'}));
 expect(share).toHaveBeenCalledWith({message:expect.stringContaining('couplesbudget://join?code=ABCDEFGH')});
 const message=share.mock.calls[0][0].message!;
 expect(message).toContain('confirm it or change it');
 expect(message).not.toContain('450');
});
it('copies the complete invitation on web without a share API and keeps code copying separate',async()=>{
 jest.replaceProperty(Platform,'OS','web');
 const original=Object.getOwnPropertyDescriptor(navigator,'share');
 Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
 try{
  const view=await render(<LocalizationProvider><InviteCard household={household}/></LocalizationProvider>);
  await fireEvent.press(view.getByRole('button',{name:'Share invite'}));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith(expect.stringContaining('couplesbudget://join?code=ABCDEFGH'));
  await fireEvent.press(view.getByRole('button',{name:'Copy code'}));
  expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('ABCDEFGH');
 }finally{if(original)Object.defineProperty(navigator,'share',original);else Reflect.deleteProperty(navigator,'share');}
});
it('blocks sharing an unsaved proposal and restores sharing after cancel',async()=>{
 const view=await render(<LocalizationProvider><InviteCard household={household}/></LocalizationProvider>);
 await fireEvent.press(view.getByRole('button',{name:'Prepare their allowance'}));
 expect(view.getByRole('button',{name:'Share invite'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(view.getByRole('button',{name:'Cancel'}));
 expect(view.getByRole('button',{name:'Share invite'}).props.accessibilityState.disabled).toBe(false);
});
