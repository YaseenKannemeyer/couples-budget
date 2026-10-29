import { fireEvent, render } from '@testing-library/react-native';
import { RemindersPanel } from '@/features/nudges/reminders-screen';
import { LocalizationProvider } from '@/i18n/provider';
import { nudgePreferences, activeNudges } from '../test/fixtures/nudges';
jest.mock('@/global.css',()=>({}));
jest.mock('@/features/nudges/device',()=>({pushAvailable:false,reminderDeviceId:()=>null,devicePushToken:jest.fn(),onPushTokenChange:()=>()=>{},onReminderResponse:()=>()=>{}}));
jest.mock('expo-router',()=>({router:{push:jest.fn(),replace:jest.fn()},useFocusEffect:jest.fn()}));
jest.mock('react-native-safe-area-context',()=>require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
jest.mock('@/features/nudges/api',()=>({useNudgeSettings:jest.fn(),useSaveNudgeSettings:jest.fn()}));
jest.mock('@/features/household/api',()=>({useMyHousehold:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:null})}));
jest.mock('@/lib/supabase',()=>({supabase:{},isSupabaseConfigured:false}));
const save=jest.fn(),register=jest.fn(),refresh=jest.fn();
const props={timezone:'Africa/Johannesburg',available:true,thisDevice:false,onSave:save,onRegister:register,onRefresh:refresh};
const screen=(data=nudgePreferences,extra={})=><LocalizationProvider><RemindersPanel {...props} {...extra} data={data}/></LocalizationProvider>;
beforeEach(()=>jest.clearAllMocks());
it('starts off and cannot silently request permission or enable delivery without a device',async()=>{
 const v=await render(screen());expect(v.getByText('Off')).toBeTruthy();expect(register).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
 expect(v.getByRole('switch',{name:'Allow my reminders'}).props.disabled).toBe(true);
 await fireEvent.press(v.getByRole('button',{name:'Enable on this device'}));expect(register).toHaveBeenCalledWith(expect.objectContaining({enabled:false,unlogged:false}),1);
});
it('stages independent own choices until Save and preserves integer household-timezone hours',async()=>{
 const v=await render(screen());await fireEvent(v.getByRole('switch',{name:'My expense log'}),'valueChange',true);
 expect(save).not.toHaveBeenCalled();expect(register).not.toHaveBeenCalled();await fireEvent.press(v.getByRole('button',{name:'Choose reminder time'}));
 expect(v.getByRole('radio',{name:'19:00'}).props.accessibilityState.checked).toBe(true);
 await fireEvent.press(v.getByRole('radio',{name:'09:00'}));expect(v.getByRole('radio',{name:'19:00'}).props.accessibilityState.checked).toBe(false);expect(v.getByRole('radio',{name:'09:00'}).props.accessibilityState.checked).toBe(true);await fireEvent.press(v.getByRole('button',{name:'Save my reminder choices'}));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({unlogged:true,send_hour:9,language:'en',enabled:false}),1);
});
it('blocks stale saves after an external revision until saved choices are explicitly loaded',async()=>{
 const v=await render(screen());await v.rerender(screen({...nudgePreferences,preferences:{...nudgePreferences.preferences,revision:2,send_hour:18}}));
 expect(v.getByRole('button',{name:'Save my reminder choices'}).props.accessibilityState.disabled).toBe(true);
 await fireEvent.press(v.getByRole('button',{name:'Load saved choices'}));expect(v.getByRole('button',{name:'Save my reminder choices'}).props.accessibilityState.disabled).toBe(false);
 expect(v.getByText('Chosen hour: 18:00 · Africa/Johannesburg')).toBeTruthy();
});
it('does not mistake its own successful save for an edit from another device',async()=>{
 save.mockResolvedValueOnce(undefined);const v=await render(screen());await fireEvent.press(v.getByRole('button',{name:'Save my reminder choices'}));
 await v.rerender(screen({...nudgePreferences,preferences:{...nudgePreferences.preferences,revision:2}}));
 expect(v.queryByRole('button',{name:'Load saved choices'})).toBeNull();
});
it('lets web pause an existing device but offers no push registration or permission action',async()=>{
 const v=await render(screen(activeNudges,{available:false}));expect(v.queryByRole('button',{name:'Enable on this device'})).toBeNull();
 await fireEvent(v.getByRole('switch',{name:'Allow my reminders'}),'valueChange',false);await fireEvent.press(v.getByRole('button',{name:'Save my reminder choices'}));
 expect(save).toHaveBeenCalledWith(expect.objectContaining({enabled:false}),3);expect(register).not.toHaveBeenCalled();
});
it('shows only own generic delivery metadata and honestly distinguishes unconfirmed delivery',async()=>{
 const v=await render(screen(activeNudges));await fireEvent.press(v.getByRole('button',{name:'My recent reminders'}));
 expect(v.getByText('Awaiting delivery confirmation')).toBeTruthy();expect(v.getByText('Delivery not confirmed')).toBeTruthy();
 expect(v.queryByText(/ExpoPushToken/)).toBeNull();expect(v.queryByText(/\$[0-9]/)).toBeNull();
});
it('preserves the draft while failed refresh disables saves and registration',async()=>{
 const v=await render(screen());await fireEvent(v.getByRole('switch',{name:'Upcoming payments'}),'valueChange',false);
 await v.rerender(screen(nudgePreferences,{failed:true}));expect(v.getByRole('switch',{name:'Upcoming payments'}).props.value).toBe(false);
 expect(v.getByRole('button',{name:'Save my reminder choices'}).props.accessibilityState.disabled).toBe(true);expect(v.getByRole('button',{name:'Enable on this device'}).props.accessibilityState.disabled).toBe(true);
});
