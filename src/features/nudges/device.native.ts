import Constants, { ExecutionEnvironment } from 'expo-constants';
import { randomUUID } from 'expo-crypto';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, IosAuthorizationStatus } from 'expo-notifications';
import { Platform } from 'react-native';
import { reconcileDeviceReminders } from '@/features/payments/device-reminders';
export const pushAvailable=Constants.executionEnvironment!==ExecutionEnvironment.StoreClient;
const deviceKey='couple-goals:push-device:v1';
export function reminderDeviceId(create=false):string|null {
 const saved=localStorage.getItem(deviceKey);if(saved)return saved;if(!create)return null;
 const id=randomUUID();localStorage.setItem(deviceKey,id);return id;
}
export async function devicePushToken(ask:boolean):Promise<string|null> {
 if(!pushAvailable) return null;
 await reconcileDeviceReminders([],{title:'',body:'',channel:'Payments',language:'en'});
 if(Platform.OS==='android') await Notifications.setNotificationChannelAsync('couple-goals-reminders',{name:'Couple Goals reminders',importance:AndroidImportance.DEFAULT});
 const permission=ask?await Notifications.requestPermissionsAsync():await Notifications.getPermissionsAsync();
 if(!permission.granted && permission.ios?.status!==IosAuthorizationStatus.PROVISIONAL)return null;
 const projectId=Constants.expoConfig?.extra?.eas?.projectId??Constants.easConfig?.projectId;
 if(typeof projectId!=='string')throw new Error('Reminder project unavailable');
 return (await Notifications.getExpoPushTokenAsync({projectId})).data;
}
export function onPushTokenChange(refresh:()=>void) {
 const subscription=Notifications.addPushTokenListener(()=>refresh());return ()=>subscription.remove();
}
const handledResponses=new Set<string>();
const handledKey='couple-goals:last-handled-reminder:v1';
export function onReminderResponse(open:(kind:string)=>void) {
 let active=true;
 const receive=(response:Notifications.NotificationResponse|null)=>{
  if(!active||!response)return;
  const id=response.notification.request.identifier;const kind=response.notification.request.content.data?.kind;
  if(typeof kind!=='string'||!/^nudge-(payment|money_date|low_balance|unlogged)$/.test(kind))return;
  let stored:string|null=null;try{stored=localStorage.getItem(handledKey);}catch{/* OS clearing and the in-memory ledger still apply. */}
  if(handledResponses.has(id)||stored===id)return;
  // Consume BEFORE navigation; the next account's subscription must not replay it.
  handledResponses.add(id);if(handledResponses.size>100)handledResponses.delete(handledResponses.values().next().value!);
  try{localStorage.setItem(handledKey,id);}catch{/* Device storage may be unavailable. */}
  try{Notifications.clearLastNotificationResponse();}catch{/* Durable/local consumption still prevents replay. */}
  open(kind);
 };
 const subscription=Notifications.addNotificationResponseReceivedListener(receive);
 try{receive(Notifications.getLastNotificationResponse());}catch{/* Live response handling remains available. */}
 return ()=>{active=false;subscription.remove();};
}
