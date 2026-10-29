import { fireEvent, render } from '@testing-library/react-native';
import { Text as MockText } from 'react-native';
import JoinScreen from '@/app/join';
import { LocalizationProvider } from '@/i18n/provider';
import { useMyHousehold } from '@/features/household/api';
import { router } from 'expo-router';
import { household,me } from '../test/fixtures/payments';
let mockSession=false;
let mockOffline=false;
const mockRefresh=jest.fn(async()=>{mockOffline=false;mockSession=true;});
let mockCode:string|string[]='ABCD-EFGH';
jest.mock('@/global.css',()=>({}));
jest.mock('expo-router',()=>({router:{replace:jest.fn()},useLocalSearchParams:()=>({code:mockCode})}));
jest.mock('@/features/auth/sign-in-screen',()=>({__esModule:true,default:({invited}:{invited:boolean})=><MockText>{invited?'Invite sign-in':'Sign-in'}</MockText>}));
jest.mock('@/features/household/join-form',()=>({JoinHouseholdForm:({initialCode}:{initialCode:string})=><MockText>Review code: {initialCode}</MockText>}));
jest.mock('@/features/household/api',()=>({useMyHousehold:jest.fn()}));
jest.mock('@/hooks/use-session',()=>({useSession:()=>({session:mockSession?{user:{id:'A'}}:null,accountId:mockSession?'A':undefined,isLoading:false,isOffline:mockOffline,refresh:mockRefresh})}));
jest.mock('@/lib/supabase',()=>({isSupabaseConfigured:true}));
jest.mock('react-native-safe-area-context',()=>require('react-native-safe-area-context/jest/mock').default);
jest.mock('expo-localization',()=>({getLocales:()=>[{languageTag:'en-US'}],useLocales:()=>[{languageTag:'en-US'}],useCalendars:()=>[{timeZone:'UTC'}]}));
beforeEach(()=>{jest.clearAllMocks();mockSession=false;mockOffline=false;mockCode='ABCD-EFGH';jest.mocked(useMyHousehold).mockReturnValue({data:null,isPending:false,isError:false} as ReturnType<typeof useMyHousehold>);});
it('keeps the same invite route/code while signing in, then offers review without auto-joining',async()=>{
 const view=await render(<LocalizationProvider><JoinScreen/></LocalizationProvider>);
 expect(view.getByText('Invite sign-in')).toBeTruthy();
 mockSession=true;await view.rerender(<LocalizationProvider><JoinScreen/></LocalizationProvider>);
 expect(view.getByText('Review code: ABCD-EFGH')).toBeTruthy();
 expect(router.replace).not.toHaveBeenCalled();
});
it('offers Home to an existing member without replacing their household',async()=>{
 mockSession=true;jest.mocked(useMyHousehold).mockReturnValue({data:{household,me,members:[me],partner:null},isPending:false,isError:false} as ReturnType<typeof useMyHousehold>);
 const view=await render(<LocalizationProvider><JoinScreen/></LocalizationProvider>);
 expect(view.getByText('You already belong to a household. Opening an invitation does not change it.')).toBeTruthy();
 expect(view.queryByText(/Review code:/)).toBeNull();
 expect(router.replace).not.toHaveBeenCalled();
});
it('ignores repeated code parameters rather than choosing an unintended invitation',async()=>{
 mockSession=true;mockCode=['ABCDEFGH','ZZZZZZZZ'];
 const view=await render(<LocalizationProvider><JoinScreen/></LocalizationProvider>);
 expect(view.getByText('Review code: ')).toBeTruthy();
});

it('reconnects an offline invitation without losing its route code',async()=>{
 mockOffline=true;
 const view=await render(<LocalizationProvider><JoinScreen/></LocalizationProvider>);
 expect(view.getByText('Connect to the internet to review and join a household.')).toBeTruthy();
 await fireEvent.press(view.getByRole('button',{name:'Try again'}));
 expect(mockRefresh).toHaveBeenCalledTimes(1);
 await view.rerender(<LocalizationProvider><JoinScreen/></LocalizationProvider>);
 expect(view.getByText('Review code: ABCD-EFGH')).toBeTruthy();
 expect(router.replace).not.toHaveBeenCalled();
});
