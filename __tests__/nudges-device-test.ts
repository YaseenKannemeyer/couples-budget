import * as Notifications from 'expo-notifications';
import { devicePushToken,onPushTokenChange,onReminderResponse } from '@/features/nudges/device.native';
import { reconcileDeviceReminders } from '@/features/payments/device-reminders';
jest.mock('expo-constants',()=>({__esModule:true,default:{executionEnvironment:'standalone',expoConfig:{extra:{eas:{projectId:'project'}}}},ExecutionEnvironment:{StoreClient:'storeClient'}}));
jest.mock('expo-crypto',()=>({randomUUID:jest.fn(()=> 'device-id')}));
jest.mock('@/features/payments/device-reminders',()=>({reconcileDeviceReminders:jest.fn(async()=>{})}));
jest.mock('expo-notifications',()=>({getPermissionsAsync:jest.fn(async()=>({granted:true})),requestPermissionsAsync:jest.fn(async()=>({granted:true})),getExpoPushTokenAsync:jest.fn(async()=>({data:'ExpoPushToken[test]'})),setNotificationChannelAsync:jest.fn(),addPushTokenListener:jest.fn(()=>({remove:jest.fn()})),addNotificationResponseReceivedListener:jest.fn(()=>({remove:jest.fn()})),getLastNotificationResponse:jest.fn(()=>null),clearLastNotificationResponse:jest.fn(),AndroidImportance:{DEFAULT:3},IosAuthorizationStatus:{PROVISIONAL:3}}));
beforeEach(()=>{jest.clearAllMocks();jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(null);});
it('refreshes a permitted Expo token without prompting and retires old local schedules first',async()=>{
 expect(await devicePushToken(false)).toBe('ExpoPushToken[test]');expect(Notifications.requestPermissionsAsync).not.toHaveBeenCalled();expect(reconcileDeviceReminders).toHaveBeenCalledWith([],expect.anything());expect(Notifications.getExpoPushTokenAsync).toHaveBeenCalledWith({projectId:'project'});
});
it('requests permission only for an explicit registration action and does not register after denial',async()=>{
 jest.mocked(Notifications.requestPermissionsAsync).mockResolvedValueOnce({granted:false} as never);expect(await devicePushToken(true)).toBeNull();expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});
it('uses token-change events to refresh the Expo token rather than passing a native token to the server',()=>{
 const refresh=jest.fn();const close=onPushTokenChange(refresh);const listener=jest.mocked(Notifications.addPushTokenListener).mock.calls[0][0];listener({type:'ios',data:'native-not-expo'});expect(refresh).toHaveBeenCalledWith();close();
});
it('does not request permission or an Expo token inside Expo Go',async()=>{
 let token:Promise<string|null>=Promise.resolve('unexpected');
 jest.isolateModules(()=>{
  const constants=require('expo-constants');constants.default.executionEnvironment=constants.ExecutionEnvironment.StoreClient;
  const go=require('@/features/nudges/device.native');expect(go.pushAvailable).toBe(false);token=go.devicePushToken(true);
  expect(require('expo-notifications').requestPermissionsAsync).not.toHaveBeenCalled();
 });
 expect(await token).toBeNull();expect(Notifications.getExpoPushTokenAsync).not.toHaveBeenCalled();
});

const responseFor=(identifier:string,kind:string):Notifications.NotificationResponse=>({actionIdentifier:'default',notification:{date:0,request:{identifier,trigger:null,content:{title:null,subtitle:null,body:null,data:{kind},categoryIdentifier:null,sound:null,launchImageName:null,badge:null,attachments:[],threadIdentifier:null}}}});
it('consumes a handled cold-start tap across account subscriptions even if the OS still returns it',()=>{
 const response=responseFor('account-switch-cold-tap','nudge-money_date');
 jest.mocked(Notifications.getLastNotificationResponse).mockReturnValue(response);
 const first=jest.fn();const off=onReminderResponse(first);expect(first).toHaveBeenCalledWith('nudge-money_date');expect(Notifications.clearLastNotificationResponse).toHaveBeenCalledTimes(1);off();
 const otherAccount=jest.fn();const stop=onReminderResponse(otherAccount);expect(otherAccount).not.toHaveBeenCalled();stop();
});
it('ignores stale listeners and unknown routes while allowing a fresh live tap once',()=>{
 const first=jest.fn();const off=onReminderResponse(first);const stale=jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[0][0];off();
 const next=jest.fn();const stop=onReminderResponse(next);const current=jest.mocked(Notifications.addNotificationResponseReceivedListener).mock.calls[1][0];
 const response=responseFor('account-switch-live-tap','nudge-unlogged');
 stale(response);expect(first).not.toHaveBeenCalled();current({...response,notification:{...response.notification,request:{...response.notification.request,content:{...response.notification.request.content,data:{kind:'https://untrusted.example'}}}}});expect(next).not.toHaveBeenCalled();
 current(response);current(response);expect(next).toHaveBeenCalledTimes(1);expect(next).toHaveBeenCalledWith('nudge-unlogged');stop();
});
