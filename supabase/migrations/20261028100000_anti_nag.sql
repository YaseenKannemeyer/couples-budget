-- Owner-only reminder consent, one active device and a daily durable delivery log.
-- No private purchase details or partner activity enter notification payloads.
create table public.nudge_preferences (
 user_id uuid primary key,household_id uuid not null,
 enabled boolean not null default false,payments boolean not null default true,
 low_balance boolean not null default true,money_date boolean not null default true,unlogged boolean not null default false,
 send_hour smallint not null default 19 check(send_hour between 9 and 20),language text not null default 'en' check(language='en'),
 revision integer not null default 1,request_id uuid,
 foreign key(household_id,user_id) references public.members(household_id,user_id) on delete cascade
);
create table public.nudge_devices (
 user_id uuid primary key references auth.users(id) on delete cascade,device_id uuid not null unique,
 expo_token text not null unique check(expo_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$'),
 revision uuid not null default gen_random_uuid(),enabled boolean not null default true,last_seen_at timestamptz not null default now()
);
create table public.nudges (
 id uuid primary key default gen_random_uuid(),household_id uuid not null,user_id uuid not null,
 local_on date not null,kind text not null check(kind in ('money_date','payment','low_balance','unlogged')),
 status text not null default 'pending' check(status in ('pending','evaluating','sending','accepted','sent','failed','unknown','skipped')),
 claim_id uuid,device_revision uuid,ticket_id text,error_code text,source_key text,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(user_id,local_on),foreign key(household_id,user_id) references public.members(household_id,user_id) on delete cascade,
 check(error_code is null or error_code in ('DeviceNotRegistered','InvalidCredentials','MessageTooBig','MessageRateExceeded','MismatchSenderId','provider_rejected','uncertain','expired','context_changed','forecast_unavailable'))
);
create index on public.nudges(status,updated_at);
alter table public.nudge_preferences enable row level security;
alter table public.nudge_devices enable row level security;
alter table public.nudges enable row level security;
create policy own_preferences on public.nudge_preferences for select to authenticated using(user_id=auth.uid() and public.is_household_member(household_id));
create policy own_nudges on public.nudges for select to authenticated using(user_id=auth.uid() and public.is_household_member(household_id));
revoke all on public.nudge_preferences,public.nudge_devices,public.nudges from public,anon,authenticated;
grant select on public.nudge_preferences,public.nudges to authenticated;

create function public.get_nudge_settings(p_household_id uuid,p_actor_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 if p_actor_id is distinct from auth.uid() or not public.is_household_member(p_household_id) then raise exception 'Reminders unavailable';end if;
 insert into public.nudge_preferences(user_id,household_id) values(auth.uid(),p_household_id) on conflict do nothing;
 return jsonb_build_object('preferences',(select to_jsonb(p) from public.nudge_preferences p where user_id=auth.uid() and household_id=p_household_id),
 'device_registered',exists(select 1 from public.nudge_devices where user_id=auth.uid() and enabled and last_seen_at>now()-interval '30 days'),
 'device_id',(select device_id from public.nudge_devices where user_id=auth.uid() and enabled),
 'history',coalesce((select jsonb_agg(to_jsonb(x) order by local_on desc) from(select id,local_on,kind,status from public.nudges where user_id=auth.uid() and household_id=p_household_id and status<>'skipped' order by local_on desc limit 15) x),'[]'::jsonb));
end;$$;
create function public.save_nudge_preferences(p_household_id uuid,p_actor_id uuid,p_revision integer,p_request_id uuid,p_values jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare current public.nudge_preferences;begin
 if p_actor_id is distinct from auth.uid() or not public.is_household_member(p_household_id) then raise exception 'Reminders unavailable';end if;
 perform public.get_nudge_settings(p_household_id,p_actor_id);
 select * into current from public.nudge_preferences where user_id=auth.uid() for update;
 if p_request_id is null or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid reminder input';end if;
 if current.request_id=p_request_id then
  if jsonb_build_object('enabled',current.enabled,'payments',current.payments,'low_balance',current.low_balance,'money_date',current.money_date,'unlogged',current.unlogged,'send_hour',current.send_hour,'language',current.language) is distinct from p_values then raise exception 'Reminders changed';end if;
  return;
 end if;
 if current.revision<>p_revision then raise exception 'Reminders changed';end if;
 if jsonb_typeof(p_values->'enabled') is distinct from 'boolean' or jsonb_typeof(p_values->'payments') is distinct from 'boolean'
 or jsonb_typeof(p_values->'low_balance') is distinct from 'boolean' or jsonb_typeof(p_values->'money_date') is distinct from 'boolean' or jsonb_typeof(p_values->'unlogged') is distinct from 'boolean'
 or jsonb_typeof(p_values->'send_hour') is distinct from 'number' or (p_values->>'send_hour')!~'^[0-9]+$' or p_values->>'language' is distinct from 'en' then raise exception 'Invalid reminder input';end if;
 if (p_values->>'enabled')::boolean and not exists(select 1 from public.nudge_devices where user_id=auth.uid() and enabled and last_seen_at>now()-interval '30 days') then raise exception 'Register reminder device';end if;
 update public.nudge_preferences set enabled=(p_values->>'enabled')::boolean,payments=(p_values->>'payments')::boolean,low_balance=(p_values->>'low_balance')::boolean,
 money_date=(p_values->>'money_date')::boolean,unlogged=(p_values->>'unlogged')::boolean,send_hour=(p_values->>'send_hour')::smallint,language='en',revision=revision+1,request_id=p_request_id where user_id=auth.uid();
 if not (p_values->>'enabled')::boolean then update public.nudges set status='skipped',error_code='context_changed',updated_at=now() where user_id=auth.uid() and status in ('pending','evaluating');end if;
exception when check_violation or invalid_text_representation or numeric_value_out_of_range then raise exception 'Invalid reminder input' using errcode='22023';end;$$;
create function public.register_nudge_device(p_household_id uuid,p_actor_id uuid,p_device_id uuid,p_token text) returns void
language plpgsql security definer set search_path='' as $$
declare lock_key bigint;begin
 if p_actor_id is distinct from auth.uid() or not public.is_household_member(p_household_id) then raise exception 'Reminders unavailable';end if;
 if p_device_id is null or p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$' then raise exception 'Invalid reminder input';end if;
 -- The opaque Expo token is supplied by the native SDK, never returned to a partner.
 -- Rebinding the same installation atomically invalidates the old account's device.
 for lock_key in select distinct hashtextextended(value,0) from unnest(array['token:'||p_token,'device:'||p_device_id::text]) value order by 1 loop perform pg_advisory_xact_lock(lock_key);end loop;
 delete from public.nudge_devices where (expo_token=p_token or device_id=p_device_id) and user_id<>auth.uid();
 insert into public.nudge_devices(user_id,device_id,expo_token) values(auth.uid(),p_device_id,p_token)
 on conflict(user_id) do update set device_id=excluded.device_id,expo_token=excluded.expo_token,enabled=true,last_seen_at=now(),
 revision=case when public.nudge_devices.expo_token=excluded.expo_token and public.nudge_devices.device_id=excluded.device_id and public.nudge_devices.enabled then public.nudge_devices.revision else gen_random_uuid() end;
end;$$;
create function public.unregister_nudge_device(p_actor_id uuid,p_device_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if p_actor_id is distinct from auth.uid() then raise exception 'Reminders unavailable';end if;
 delete from public.nudge_devices where user_id=auth.uid() and device_id=p_device_id;
 if found then update public.nudges set status='skipped',error_code='context_changed',updated_at=now() where user_id=auth.uid() and status in ('pending','evaluating');end if;
end;$$;

-- Only the trusted worker can evaluate these predicates. Private logging is
-- inspected for its owner alone, never written to a shared revision/event stream.
create function public.nudge_kind_due(p_user uuid,p_kind text,p_now timestamptz) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare p public.nudge_preferences;h public.households;today date;wall timestamp;begin
 select * into p from public.nudge_preferences where user_id=p_user;
 select * into h from public.households where id=p.household_id;
 if h.id is null or not p.enabled or not exists(select 1 from public.members where household_id=h.id and user_id=p_user)
 or not exists(select 1 from public.nudge_devices where user_id=p_user and enabled and last_seen_at>p_now-interval '30 days') then return false;end if;
 wall:=p_now at time zone h.timezone;today:=wall::date;
 if extract(hour from wall)<>p.send_hour then return false;end if;
 if p_kind='money_date' then return p.money_date and extract(day from today)=h.money_date_day and exists(select 1 from public.budget_periods where household_id=h.id and status<>'locked' and plan_snapshot is not null and ends_on<=today);
 elsif p_kind='payment' then return p.payments and exists(select 1 from public.scheduled_payments s where household_id=h.id and payer_id=p_user and (visibility='shared' or owner_id=p_user) and status='active' and reminder_days_before is not null
   and today between due_start-reminder_days_before and due_end
   and not exists(select 1 from public.nudges prior where prior.user_id=p_user and prior.kind='payment' and prior.source_key=s.id::text||':'||s.due_start::text and prior.status in ('sending','accepted','sent','unknown')) and not exists(select 1 from public.payment_records r where r.schedule_ref=s.id and r.cycle_on=s.due_start));
 elsif p_kind='low_balance' then return p.low_balance and not exists(select 1 from public.nudges where user_id=p_user and kind='low_balance' and status in ('sending','accepted','sent','unknown') and created_at>p_now-interval '7 days');
 elsif p_kind='unlogged' then return p.unlogged
   and exists(select 1 from public.members where household_id=h.id and user_id=p_user and (joined_at at time zone h.timezone)::date<=today-2)
   and not exists(select 1 from public.nudges where user_id=p_user and kind='unlogged' and status in ('sending','accepted','sent','unknown') and created_at>p_now-interval '7 days') and not exists(select 1 from public.shared_transactions where household_id=h.id and created_by=p_user and occurred_on between today-1 and today)
   and not exists(select 1 from public.private_transactions where household_id=h.id and owner_id=p_user and occurred_on between today-1 and today);
 end if;return false;
end;$$;
create function public.enqueue_nudges(p_now timestamptz default now(),p_limit integer default 100) returns integer
language plpgsql security definer set search_path='' as $$
declare p record;kind text;counted integer:=0;begin
 -- Reclaim evaluations, which have not begun delivery. Sending is irreversible:
 -- after an uncertain network result it is never automatically submitted again.
 update public.nudges set status='pending',claim_id=null,updated_at=p_now where status='evaluating' and updated_at<p_now-interval '10 minutes';
 update public.nudges set status='unknown',error_code='uncertain',updated_at=p_now where status='sending' and updated_at<p_now-interval '10 minutes';
 update public.nudges set status='unknown',error_code='expired',updated_at=p_now where status='accepted' and updated_at<p_now-interval '24 hours';
 update public.nudges n set status='skipped',error_code='expired',updated_at=p_now from public.nudge_preferences pref join public.households h on h.id=pref.household_id
 where n.user_id=pref.user_id and n.status in ('pending','evaluating') and (not pref.enabled or n.local_on<>(p_now at time zone h.timezone)::date or extract(hour from p_now at time zone h.timezone)<>pref.send_hour);
 for p in select np.*, (p_now at time zone h.timezone)::date today from public.nudge_preferences np join public.households h on h.id=np.household_id
 where np.enabled and extract(hour from p_now at time zone h.timezone)=np.send_hour
 and exists(select 1 from public.nudge_devices where user_id=np.user_id and enabled and last_seen_at>p_now-interval '30 days')
 and not exists(select 1 from public.nudges where user_id=np.user_id and local_on=(p_now at time zone h.timezone)::date)
 order by np.user_id limit least(greatest(p_limit,1),500) loop
  if public.nudge_kind_due(p.user_id,'money_date',p_now) then kind:='money_date';
  elsif public.nudge_kind_due(p.user_id,'payment',p_now) then kind:='payment';
  elsif public.nudge_kind_due(p.user_id,'low_balance',p_now) then kind:='low_balance';else kind:='unlogged';end if;
  insert into public.nudges(household_id,user_id,local_on,kind,status,created_at,updated_at) values(p.household_id,p.user_id,p.today,kind,
    case when public.nudge_kind_due(p.user_id,kind,p_now) then 'pending' else 'skipped' end,p_now,p_now) on conflict do nothing;
  counted:=counted+1;
 end loop;return counted;
end;$$;
create function public.claim_nudges(p_now timestamptz default now(),p_limit integer default 100) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.nudges;result jsonb:='[]';begin
 for n in select * from public.nudges where status='pending' and public.nudge_kind_due(user_id,kind,p_now) order by created_at,id limit least(greatest(p_limit,1),100) for update skip locked loop
  if not public.nudge_kind_due(n.user_id,n.kind,p_now) or n.local_on is distinct from (select (p_now at time zone h.timezone)::date from public.households h where id=n.household_id) then
   update public.nudges set status='skipped',error_code='context_changed',updated_at=p_now where id=n.id;continue;end if;
  update public.nudges set status='evaluating',claim_id=gen_random_uuid(),updated_at=p_now where id=n.id returning * into n;
  result:=result||jsonb_build_array(jsonb_build_object('id',n.id,'claim_id',n.claim_id,'kind',n.kind));
 end loop;return result;
end;$$;
create function public.nudge_forecast_context(p_id uuid,p_claim_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.nudges;prior text;result jsonb;begin
 select * into n from public.nudges where id=p_id and claim_id=p_claim_id and status='evaluating' for update;
 if n.id is null or n.kind<>'low_balance' then raise exception 'Nudge unavailable';end if;
 -- get_cashflow is an actor-checked shared projection; reuse it with a bounded,
 -- transaction-local worker identity. No private income source is returned.
 prior:=current_setting('request.jwt.claim.sub',true);perform set_config('request.jwt.claim.sub',n.user_id::text,true);
 result:=public.get_cashflow(n.household_id);
 perform set_config('request.jwt.claim.sub',coalesce(prior,''),true);return result;
end;$$;
create function public.begin_nudge_send(p_id uuid,p_claim_id uuid,p_kind text,p_now timestamptz default now()) returns jsonb
language plpgsql security definer set search_path='' as $$
declare n public.nudges;d public.nudge_devices;source text;begin
 select * into n from public.nudges where id=p_id and claim_id=p_claim_id and status='evaluating' for update;
 if n.id is null then return null;end if;
 if (p_kind<>n.kind and not(n.kind='low_balance' and p_kind='unlogged')) or not public.nudge_kind_due(n.user_id,p_kind,p_now)
 or n.local_on is distinct from (select (p_now at time zone h.timezone)::date from public.households h where id=n.household_id) then
  update public.nudges set status='skipped',error_code='context_changed',updated_at=p_now where id=n.id;return null;end if;
 select * into d from public.nudge_devices where user_id=n.user_id and enabled for update;
 if d.user_id is null then return null;end if;
 if p_kind='payment' then
  select s.id::text||':'||s.due_start::text into source from public.scheduled_payments s where s.household_id=n.household_id and s.payer_id=n.user_id and (s.visibility='shared' or s.owner_id=n.user_id)
   and s.status='active' and s.reminder_days_before is not null and n.local_on between s.due_start-s.reminder_days_before and s.due_end
   and not exists(select 1 from public.payment_records r where r.schedule_ref=s.id and r.cycle_on=s.due_start)
   and not exists(select 1 from public.nudges prior where prior.user_id=n.user_id and prior.kind='payment' and prior.source_key=s.id::text||':'||s.due_start::text and prior.status in ('sending','accepted','sent','unknown'))
   order by s.due_start,s.id limit 1;
 end if;
 update public.nudges set status='sending',source_key=source,kind=p_kind,device_revision=d.revision,updated_at=p_now where id=n.id;
 return jsonb_build_object('token',d.expo_token,'kind',p_kind,'language','en');
end;$$;
create function public.finish_nudge_send(p_id uuid,p_claim_id uuid,p_status text,p_ticket_id text default null,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
declare n public.nudges;begin
 if p_status not in ('accepted','failed','unknown','skipped') or (p_status='accepted' and (p_ticket_id is null or length(p_ticket_id)>200)) then raise exception 'Invalid nudge outcome';end if;
 select * into n from public.nudges where id=p_id and claim_id=p_claim_id and status in ('sending','evaluating') for update;
 if n.id is null then return;end if;
 if n.status='evaluating' and p_status<>'skipped' then raise exception 'Invalid nudge outcome';end if;
 update public.nudges set status=p_status,ticket_id=p_ticket_id,error_code=p_error,updated_at=now() where id=n.id;
 if p_error='DeviceNotRegistered' then update public.nudge_devices set enabled=false where user_id=n.user_id and revision=n.device_revision;end if;
end;$$;
create function public.get_nudge_receipts(p_now timestamptz default now()) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'ticket_id',ticket_id)),'[]'::jsonb) from(select id,ticket_id from public.nudges where status='accepted' and updated_at<=p_now-interval '15 minutes' and updated_at>p_now-interval '24 hours' order by updated_at,id limit 100) n;
$$;
create function public.finish_nudge_receipt(p_id uuid,p_ticket_id text,p_ok boolean,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
declare n public.nudges;begin
 select * into n from public.nudges where id=p_id and ticket_id=p_ticket_id and status='accepted' for update;
 if n.id is null then return;end if;
 update public.nudges set status=case when p_ok then 'sent' else 'failed' end,error_code=p_error,updated_at=now() where id=n.id;
 if p_error='DeviceNotRegistered' then update public.nudge_devices set enabled=false where user_id=n.user_id and revision=n.device_revision;end if;
end;$$;
revoke execute on function public.nudge_kind_due(uuid,text,timestamptz),public.enqueue_nudges(timestamptz,integer),public.claim_nudges(timestamptz,integer),public.nudge_forecast_context(uuid,uuid),public.begin_nudge_send(uuid,uuid,text,timestamptz),public.finish_nudge_send(uuid,uuid,text,text,text),public.get_nudge_receipts(timestamptz),public.finish_nudge_receipt(uuid,text,boolean,text) from public,anon,authenticated;
grant execute on function public.enqueue_nudges(timestamptz,integer),public.claim_nudges(timestamptz,integer),public.nudge_forecast_context(uuid,uuid),public.begin_nudge_send(uuid,uuid,text,timestamptz),public.finish_nudge_send(uuid,uuid,text,text,text),public.get_nudge_receipts(timestamptz),public.finish_nudge_receipt(uuid,text,boolean,text) to service_role;
revoke execute on function public.get_nudge_settings(uuid,uuid),public.save_nudge_preferences(uuid,uuid,integer,uuid,jsonb),public.register_nudge_device(uuid,uuid,uuid,text),public.unregister_nudge_device(uuid,uuid) from public,anon;
grant execute on function public.get_nudge_settings(uuid,uuid),public.save_nudge_preferences(uuid,uuid,integer,uuid,jsonb),public.register_nudge_device(uuid,uuid,uuid,text),public.unregister_nudge_device(uuid,uuid) to authenticated;

alter table public.guide_progress drop constraint guide_progress_check;
alter table public.guide_progress add constraint guide_progress_check check(case guide_id
 when 'welcome' then step_id in ('spaces','connect') when 'first-visit' then step_id in ('home','shared','private','log')
 when 'quick-log' then step_id in ('space','save') when 'payments' then step_id in ('list','create')
 when 'cashflow' then step_id in ('forecast','calendar') when 'categories' then step_id in ('spaces','create')
 when 'budget-categories' then step_id in ('plan','assign') when 'private-allowance' then step_id in ('balance','privacy')
 when 'reconciliation' then step_id in ('compare','check') when 'goals' then step_id in ('overview','create')
 when 'money-date' then step_id in ('review','close') when 'reminders' then step_id in ('overview','save') else false end);
