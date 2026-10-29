import { createNudgeHandler } from './handler.ts';
Deno.serve(createNudgeHandler({url:Deno.env.get('SUPABASE_URL')??'',serviceKey:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'',
 cronSecret:Deno.env.get('NUDGE_CRON_SECRET')??'',expoAccessToken:Deno.env.get('EXPO_ACCESS_TOKEN')}));
