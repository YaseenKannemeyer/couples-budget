export const pushAvailable=false;
export async function devicePushToken(_ask:boolean):Promise<string|null>{return null;}
export function onPushTokenChange(_refresh:()=>void){return ()=>{};}
export function onReminderResponse(_open:(kind:string)=>void){return ()=>{};}
export function reminderDeviceId(_create=false):string|null{return null;}
