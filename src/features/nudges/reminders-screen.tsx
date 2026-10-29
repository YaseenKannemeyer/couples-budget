import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Switch, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Choice, Choices } from '@/components/ui/choices';
import { Disclosure } from '@/components/ui/disclosure';
import { Screen } from '@/components/ui/screen';
import { SummaryRow } from '@/components/ui/summary-row';
import { Spacing } from '@/constants/theme';
import { useGuideAction } from '@/features/guides/context';
import { GuideSlot } from '@/features/guides/guide-slot';
import { useMyHousehold } from '@/features/household/api';
import { PaymentError } from '@/features/payments/ui';
import { useTheme } from '@/hooks/use-theme';
import { registerReminderDevice, useNudgeSettings, useSaveNudgeSettings } from './api';
import { pushAvailable, reminderDeviceId } from './device';
import { preferenceValues, type NudgeSettings, type PreferenceValues } from './schema';
export function RemindersScreen() {
 const household=useMyHousehold();const query=useNudgeSettings(household.data?.household.id);const {t}=useTranslation();
 if(!household.data||!query.data)return <Screen><ThemedText type="subtitle">{t('nudges.title')}</ThemedText>
  <ThemedText>{t(household.isError||query.isError?'nudges.loadError':'payments.loading')}</ThemedText>
  {(household.isError||query.isError)&&<Button title={t('common.tryAgain')} onPress={()=>{void household.refetch();void query.refetch();}}/>}
  <Button title={t('nudges.settings')} variant="ghost" onPress={()=>router.replace('/settings')}/></Screen>;
 return <ConnectedReminders key={`${household.data.household.id}:${household.data.me.userId}`} householdId={household.data.household.id} userId={household.data.me.userId}
  data={query.data} timezone={household.data.household.timezone} failed={query.isError||household.isError} refresh={()=>query.refetch()}/>;
}
function ConnectedReminders({householdId,userId,data,timezone,failed,refresh}:{householdId:string;userId:string;data:NudgeSettings;timezone:string;failed:boolean;refresh:()=>unknown}) {
 const save=useSaveNudgeSettings(householdId,userId);const [registering,setRegistering]=useState(false);const [deviceError,setDeviceError]=useState<unknown>(null);const signal=useGuideAction();
 let device:string|null=null;try {device=pushAvailable?reminderDeviceId():null;}catch{/* Explicit registration reports device storage failures. */}
 return <RemindersPanel data={data} timezone={timezone} available={pushAvailable} thisDevice={!!device&&device===data.device_id}
  failed={failed} busy={save.isPending||registering} error={deviceError??save.error} onRefresh={refresh}
  onSave={async(values,revision)=>{setDeviceError(null);await save.mutateAsync({values,revision});signal('reminders-saved');}}
  onRegister={async(values,revision)=>{setRegistering(true);setDeviceError(null);
   try {await registerReminderDevice(householdId,userId,true);await save.mutateAsync({values:{...values,enabled:true},revision});signal('reminders-saved');}
   catch(error){setDeviceError(error);throw error;}finally{setRegistering(false);void refresh();}
  }}/>;
}
export function RemindersPanel({data,timezone,available,thisDevice,failed,busy,error,onRefresh,onSave,onRegister}:{
 data:NudgeSettings;timezone:string;available:boolean;thisDevice:boolean;failed?:boolean;busy?:boolean;error?:unknown;onRefresh:()=>unknown;
 onSave:(values:PreferenceValues,revision:number)=>unknown;onRegister:(values:PreferenceValues,revision:number)=>unknown;
}) {
 const {t}=useTranslation();const theme=useTheme();const [values,setValues]=useState(()=>preferenceValues.parse(data.preferences));const [revision,setRevision]=useState(data.preferences.revision);const [saved,setSaved]=useState(false);
 const stale=revision!==data.preferences.revision;const disabled=!!busy||!!failed||stale;
 const toggle=(key:'enabled'|'payments'|'low_balance'|'money_date'|'unlogged',title:string,body?:string)=><View style={styles.option}>
  <View style={styles.copy}><ThemedText type="smallBold">{title}</ThemedText>{body&&<ThemedText type="small" themeColor="textSecondary">{body}</ThemedText>}</View>
  <Switch hitSlop={10} accessibilityLabel={title} value={values[key]} disabled={disabled||(key==='enabled'&&!values.enabled&&!data.device_registered)} onValueChange={value=>{setSaved(false);setValues(current=>({...current,[key]:value}));}}
   thumbColor={theme.onAccent} trackColor={{false:theme.border,true:theme.accent}}/>
 </View>;
 return <Screen>
  <ThemedText type="subtitle" accessibilityRole="header">{t('nudges.title')}</ThemedText>
  <ThemedText themeColor="textSecondary">{t('nudges.intro')}</ThemedText>
  <SummaryRow label={t('nudges.status')} value={t(data.preferences.enabled?'nudges.on':'nudges.off')}/>
  <ThemedText type="small" themeColor="textSecondary">{t('nudges.privacy')}</ThemedText>
  <GuideSlot target="reminders-overview" offer="reminders"/>
  {!!failed&&<ThemedText accessibilityRole="alert" themeColor="attention">{t('nudges.loadError')}</ThemedText>}
  <PaymentError error={error}/>
  {saved&&!stale&&<ThemedText accessibilityLiveRegion="polite" themeColor="success">{t('nudges.saved')}</ThemedText>}
  {stale&&<><ThemedText accessibilityRole="alert" themeColor="attention">{t('nudges.changed')}</ThemedText><Button title={t('nudges.loadSaved')} variant="secondary" disabled={busy}
   onPress={()=>{setSaved(false);setValues(preferenceValues.parse(data.preferences));setRevision(data.preferences.revision);}}/></>}
  <ThemedText type="section" accessibilityRole="header">{t('nudges.device')}</ThemedText>
  <ThemedText>{t(data.device_registered?(thisDevice?'nudges.thisDevice':'nudges.otherDevice'):'nudges.noDevice')}</ThemedText>
  {available?<Button title={t(thisDevice?'nudges.refreshDevice':'nudges.enableDevice')} loading={busy} disabled={disabled}
   onPress={async()=>{setSaved(false);try{await onRegister(values,revision);setValues(current=>({...current,enabled:true}));setRevision(revision+1);setSaved(true);}catch{/* Parent presents the registration error. */}}}/>:<ThemedText type="small" themeColor="textSecondary">{t('nudges.nativeRequired')}</ThemedText>}
  <ThemedText type="small" themeColor="textSecondary">{t('nudges.deviceHint')}</ThemedText>
  <GuideSlot target="reminders-preferences"/>
  {toggle('enabled',t('nudges.enabled'))}
  <ThemedText type="section" accessibilityRole="header">{t('nudges.types')}</ThemedText>
  {toggle('payments',t('nudges.payments'),t('nudges.paymentsHint'))}
  {toggle('low_balance',t('nudges.low_balance'),t('nudges.lowHint'))}
  {toggle('money_date',t('nudges.money_date'),t('nudges.moneyHint'))}
  {toggle('unlogged',t('nudges.unlogged'),t('nudges.unloggedHint'))}
  <Disclosure title={t('nudges.timing')}>
   <ThemedText type="small" themeColor="textSecondary">{t('nudges.timingHint',{timezone})}</ThemedText>
   <Choices label={t('nudges.hour')}>{Array.from({length:12},(_,n)=>n+9).map(hour=><Choice key={hour} label={`${String(hour).padStart(2,'0')}:00`} selected={hour===values.send_hour} disabled={disabled}
    onPress={()=>{setSaved(false);setValues(current=>({...current,send_hour:hour}));}}/>)}</Choices>
  </Disclosure>
  <ThemedText type="small" themeColor="textSecondary">{t('nudges.scheduled',{hour:`${String(values.send_hour).padStart(2,'0')}:00`,timezone})}</ThemedText>
  <Button title={t('nudges.save')} loading={busy} disabled={disabled} onPress={async()=>{setSaved(false);try{await onSave(values,revision);setRevision(revision+1);setSaved(true);}catch{/* Parent presents the save error. */}}}/>
  <Disclosure title={t('nudges.history')}>
   <ThemedText type="small" themeColor="textSecondary">{t('nudges.deliveryHint')}</ThemedText>
   {!data.history.length&&<ThemedText>{t('nudges.noHistory')}</ThemedText>}
   {data.history.map(row=><View key={row.id} style={styles.history}><ThemedText type="smallBold">{t(`nudges.${row.kind==='payment'?'payments':row.kind}`)}</ThemedText><SummaryRow label={row.local_on} value={t(`nudges.delivery.${row.status}`)}/></View>)}
  </Disclosure>
  <Button title={t('nudges.refresh')} variant="secondary" disabled={busy} onPress={onRefresh}/>
  <Button title={t('nudges.settings')} variant="ghost" onPress={()=>router.replace('/settings')}/>
 </Screen>;
}
const styles=StyleSheet.create({option:{flexDirection:'row',alignItems:'center',gap:Spacing.three,paddingVertical:Spacing.two},copy:{flex:1,gap:Spacing.one},history:{gap:Spacing.one,paddingVertical:Spacing.two}});
