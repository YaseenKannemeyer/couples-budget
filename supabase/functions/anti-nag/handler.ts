import { forecast, shiftCalendarDays, type ForecastInput } from '../_shared/forecast.ts';
type Kind = 'money_date' | 'payment' | 'low_balance' | 'unlogged';
type Job = { id: string; claim_id: string; kind: Kind };
type Receipt = { id: string; ticket_id: string };
type Ticket = { status?: string; id?: string; details?: { error?: string } };
type Config = { url: string; serviceKey: string; cronSecret: string; expoAccessToken?: string };
const messages: Record<Kind, string> = {
 money_date: 'Time for your Money Date. Review your month together.',
 payment: 'Take a moment to review your upcoming payments.',
 low_balance: 'Your shared cash-flow forecast could use a quick look.',
 unlogged: 'If you have expenses to add, take a moment to update your own log.',
};
const allowedErrors = new Set(['DeviceNotRegistered','InvalidCredentials','MessageTooBig','MessageRateExceeded','MismatchSenderId']);
const safeError = (value?: string) => value && allowedErrors.has(value) ? value : 'provider_rejected';
async function secretMatches(actual: string, expected: string) {
 if (!expected || !actual) return false;
 const encode = new TextEncoder();const [a,b] = await Promise.all([actual,expected].map(value=>crypto.subtle.digest('SHA-256',encode.encode(value))));
 const left = new Uint8Array(a),right = new Uint8Array(b);let difference = 0;
 for(let n=0;n<left.length;n++) difference |= left[n]^right[n];return difference===0;
}
export function createNudgeHandler(config: Config, send: typeof fetch = fetch) {
 return async (request: Request): Promise<Response> => {
  if (!await secretMatches(request.headers.get('authorization') ?? '',`Bearer ${config.cronSecret}`) || !config.cronSecret) return new Response('Unauthorized',{status:401});
  if (request.method!=='POST') return new Response('Method not allowed',{status:405});
  if (!config.serviceKey || !config.url) return new Response('Worker not configured',{status:503});
  // Never accept user IDs, recipient tokens, copy or timestamps from the HTTP body.
  async function rpc<T>(name: string, args: Record<string,unknown> = {}): Promise<T> {
   const response = await send(`${config.url}/rest/v1/rpc/${name}`,{method:'POST',headers:{'Content-Type':'application/json',apikey:config.serviceKey,Authorization:`Bearer ${config.serviceKey}`},body:JSON.stringify(args),signal:AbortSignal.timeout(10_000)});
   if (!response.ok) throw new Error('Worker database operation failed');const body=await response.text();return (body?JSON.parse(body):null) as T;
  }
  const headers: Record<string,string> = {'Content-Type':'application/json',Accept:'application/json'};
  if(config.expoAccessToken) headers.Authorization=`Bearer ${config.expoAccessToken}`;
  let submitted=0,receiptsChecked=0;
  try {
   await rpc('enqueue_nudges');
   const receipts = await rpc<Receipt[]>('get_nudge_receipts');
   if(receipts.length) {
    try {
     const response = await send('https://exp.host/--/api/v2/push/getReceipts',{method:'POST',headers,body:JSON.stringify({ids:receipts.map(r=>r.ticket_id)}),signal:AbortSignal.timeout(10_000)});
     if(response.ok) {
      const body = await response.json() as {data?: Record<string,Ticket>};
      for(const item of receipts) {const receipt=body.data?.[item.ticket_id];if(!receipt || !['ok','error'].includes(receipt.status??''))continue;
       await rpc('finish_nudge_receipt',{p_id:item.id,p_ticket_id:item.ticket_id,p_ok:receipt.status==='ok',p_error:receipt.status==='error'?safeError(receipt.details?.error):null});receiptsChecked++;
      }
     }
    } catch { /* Receipt lookups are safe to retry on the next scheduled run. */ }
   }
   const jobs = await rpc<Job[]>('claim_nudges');
   async function process(job:Job) {
    let kind=job.kind;
    if(kind==='low_balance') {
     let low=false;
     try {
      const input=await rpc<ForecastInput>('nudge_forecast_context',{p_id:job.id,p_claim_id:job.claim_id});
      const result=forecast(input,shiftCalendarDays(input.today,30));
      low=result.gaps.length===0 && result.low && result.lowest!==null;
     } catch {
      await rpc('finish_nudge_send',{p_id:job.id,p_claim_id:job.claim_id,p_status:'skipped',p_error:'forecast_unavailable'});return;
     }
     if(!low) kind='unlogged'; // The database rechecks the owner's separate opt-in and activity.
    }
    const target=await rpc<{token:string;kind:Kind;language:string}|null>('begin_nudge_send',{p_id:job.id,p_claim_id:job.claim_id,p_kind:kind});
    if(!target)return;
    let status='unknown',ticket:string|null=null,error:string|null='uncertain';
    try {
     // sending was durably committed BEFORE contacting Expo. An uncertain
     // response or crash never automatically resubmits the same day's nudge.
     const response=await send('https://exp.host/--/api/v2/push/send',{method:'POST',headers,body:JSON.stringify({to:target.token,title:'Couple Goals',body:messages[target.kind],data:{kind:`nudge-${target.kind}`},channelId:'couple-goals-reminders',ttl:3600}),signal:AbortSignal.timeout(10_000)});
     if(response.ok) {
      const body=await response.json() as {data?:Ticket|Ticket[]};const result=Array.isArray(body.data)?body.data[0]:body.data;
      if(result?.status==='ok' && typeof result.id==='string') {status='accepted';ticket=result.id;error=null;submitted++;}
      else if(result?.status==='error') {status='failed';error=safeError(result.details?.error);}
     } else if(response.status>=400 && response.status<500) {status='failed';error='provider_rejected';}
    } catch { /* Commit unknown; preserve the no-resubmit guarantee. */ }
    await rpc('finish_nudge_send',{p_id:job.id,p_claim_id:job.claim_id,p_status:status,p_ticket_id:ticket,p_error:error});
   }
   // Bound concurrent provider connections, while independent jobs progress.
   let failed=false;
   for(let offset=0;offset<jobs.length;offset+=6) {
    const results=await Promise.allSettled(jobs.slice(offset,offset+6).map(process));
    if(results.some(result=>result.status==='rejected'))failed=true;
   }
   if(failed)return new Response('Some reminder jobs could not complete',{status:503});
   return Response.json({submitted,receiptsChecked});
  } catch { return new Response('Worker could not complete this run',{status:503}); }
 };
}
