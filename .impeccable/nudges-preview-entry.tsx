/** Synthetic UI only. No session, registration transport or push permissions. */
import { registerRootComponent } from 'expo';
import { useFonts } from 'expo-font';
import { useState } from 'react';
import { Text,View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DisplayFontContext } from '../src/components/ui/font-context';
import { ThemeSchemeContext } from '../src/hooks/use-theme';
import { LocalizationProvider } from '../src/i18n/provider';
import { RemindersPanel } from '../src/features/nudges/reminders-screen';
import { GuideContext } from '../src/features/guides/context';
import { findGuide } from '../src/features/guides/registry';
import { nudgePreferences,activeNudges } from '../test/fixtures/nudges';
import { me } from '../test/fixtures/payments';
const noop=()=>{};
function Preview(){
 const params=new URLSearchParams(window.location.search);const mode=params.get('state')??'off';
 const [data,setData]=useState(mode==='off'?nudgePreferences:activeNudges);const [active,setActive]=useState(params.has('guide'));const [step,setStep]=useState(0);
 const [loaded,error]=useFonts({Manrope:{uri:'http://127.0.0.1:8098/Manrope.ttf'}});const guide=findGuide('reminders')!;
 if(!loaded&&!error)return null;
 return <SafeAreaProvider><LocalizationProvider><DisplayFontContext value={loaded}><ThemeSchemeContext value={params.get('theme')==='dark'?'dark':'light'}>
  <GuideContext value={{ready:true,active:active?'reminders':null,path:'/reminders',rows:active?{reminders:{guide_id:'reminders',guide_version:1,step_id:guide.steps[step].id,status:'in_progress',revision:1,request_id:me.userId,pending:false}}:{},localError:false,syncError:false,
   start:()=>{setActive(true);setStep(0);},close:()=>setActive(false),dismiss:()=>setActive(false),move:direction=>setStep(Math.max(0,Math.min(1,step+direction))),signal:noop,register:()=>noop,retry:noop}}>
  <View style={{flex:1}}><Text style={{padding:8,backgroundColor:'#E9ECFF',color:'#191B24'}}>Synthetic preview · {mode} · {loaded?'Manrope loaded':'font fallback'}</Text>
   <RemindersPanel data={data} timezone="Africa/Johannesburg" available={mode!=='web'} thisDevice={mode!=='web'&&data.device_registered} failed={mode==='error'} error={mode==='denied'?{message:'Reminder permission unavailable'}:null} onRefresh={noop}
    onSave={values=>setData(current=>({...current,preferences:{...current.preferences,...values,revision:current.preferences.revision+1}}))}
    onRegister={values=>setData(current=>({...current,device_registered:true,device_id:activeNudges.device_id,preferences:{...current.preferences,...values,enabled:true,revision:current.preferences.revision+1}}))}/>
  </View></GuideContext>
 </ThemeSchemeContext></DisplayFontContext></LocalizationProvider></SafeAreaProvider>;
}
registerRootComponent(Preview);
