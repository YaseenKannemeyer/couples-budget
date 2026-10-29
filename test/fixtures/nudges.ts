import type { NudgeSettings } from '@/features/nudges/schema';
export const nudgePreferences:NudgeSettings={preferences:{enabled:false,payments:true,low_balance:true,money_date:true,unlogged:false,send_hour:19,language:'en',revision:1,request_id:null},device_id:null,device_registered:false,history:[]};
export const activeNudges:NudgeSettings={...nudgePreferences,preferences:{...nudgePreferences.preferences,enabled:true,revision:3},device_registered:true,device_id:'00000000-0000-4000-8000-000000000081',
 history:[{id:'00000000-0000-4000-8000-000000000082',local_on:'2026-10-28',kind:'payment',status:'accepted'},
 {id:'00000000-0000-4000-8000-000000000083',local_on:'2026-10-27',kind:'low_balance',status:'unknown'}]};
