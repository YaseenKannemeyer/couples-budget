-- Reconciliation compares observed closing balances with CONFIRMED shared cash.
-- Budget reservations, expected salaries and private purchases are never inputs.
alter table public.households add column reconciliation_revision integer not null default 0;

create table public.balance_checkins (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  checked_by uuid not null references auth.users(id),
  as_of_on date not null,
  actual_minor bigint not null check (actual_minor between -1000000000000 and 1000000000000),
  baseline_on date, baseline_minor bigint, baseline_version integer not null,
  expected_minor bigint,
  status text not null check (status in ('pending','resolved','superseded')),
  resolution text check (resolution in ('opening','matched','allowance','correction')),
  resolved_expected_minor bigint, resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(household_id,id),
  check ((status='resolved') = (resolution is not null and resolved_at is not null))
);
create unique index one_pending_checkin on public.balance_checkins(household_id) where status='pending';
create index on public.balance_checkins(household_id,created_at desc);

-- These are explicitly shared allocations of a shared discrepancy, not private
-- purchase records. Every charged member must approve their own allocation.
create table public.balance_checkin_shares (
  household_id uuid not null,
  checkin_id uuid not null,
  user_id uuid not null,
  amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
  approved_at timestamptz,
  primary key(checkin_id,user_id),
  foreign key(household_id,checkin_id) references public.balance_checkins(household_id,id) on delete cascade,
  foreign key(household_id,user_id) references public.members(household_id,user_id) deferrable initially deferred
);
create table public.reconciliation_requests (
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  payload jsonb not null, result jsonb not null,
  primary key(user_id,request_id)
);
create index on public.balance_checkin_shares(household_id,user_id);
alter table public.balance_checkins enable row level security;
alter table public.balance_checkin_shares enable row level security;
alter table public.reconciliation_requests enable row level security;
create policy household_read on public.balance_checkins for select to authenticated using(public.is_household_member(household_id));
create policy household_read on public.balance_checkin_shares for select to authenticated using(public.is_household_member(household_id));
create policy own_request on public.reconciliation_requests for select to authenticated using(user_id=auth.uid() and public.is_household_member(household_id));
revoke all on public.balance_checkins,public.balance_checkin_shares,public.reconciliation_requests from anon,authenticated;
grant select on public.balance_checkins,public.balance_checkin_shares,public.reconciliation_requests to authenticated;

-- Row locks serialize check-ins with all supported shared-ledger writes, including
-- direct legacy inserts. Only shared contribution tuples signal income changes.
create function public.signal_reconciliation() returns trigger
language plpgsql security definer set search_path='' as $$
declare h uuid;
begin
  if TG_TABLE_NAME='income_occurrences' then
    if (case when TG_OP<>'INSERT' and OLD.shared_amount_minor>0 then
          jsonb_build_array(OLD.shared_on,OLD.shared_amount_minor,OLD.shared_received) else null end)
      is not distinct from
       (case when TG_OP<>'DELETE' and NEW.shared_amount_minor>0 then
          jsonb_build_array(NEW.shared_on,NEW.shared_amount_minor,NEW.shared_received) else null end) then
      return coalesce(NEW,OLD);
    end if;
  end if;
  for h in select distinct v from unnest(array[
      case when TG_OP<>'INSERT' then OLD.household_id end,
      case when TG_OP<>'DELETE' then NEW.household_id end]) v where v is not null order by v loop
    update public.households set reconciliation_revision=reconciliation_revision+1 where id=h;
  end loop;
  return coalesce(NEW,OLD);
end;
$$;
create trigger reconciliation_ledger before insert or update or delete on public.shared_transactions for each row execute function public.signal_reconciliation();
create trigger reconciliation_balance before insert or update or delete on public.cashflow_balances for each row execute function public.signal_reconciliation();
create trigger reconciliation_income before insert or update or delete on public.income_occurrences for each row execute function public.signal_reconciliation();

create function public.reconciliation_expected(p_household_id uuid,p_baseline_on date,p_baseline_minor bigint,p_on date)
returns bigint language sql stable security definer set search_path='' as $$
  select case when p_baseline_on is null then null else
    p_baseline_minor::numeric
    + coalesce((select sum(shared_amount_minor) from public.income_occurrences
      where household_id=p_household_id and shared_received and shared_on>p_baseline_on and shared_on<=p_on),0)
    - coalesce((select sum(amount_minor) from public.shared_transactions
      where household_id=p_household_id and occurred_on>p_baseline_on and occurred_on<=p_on),0) end::bigint;
$$;

create function public.get_reconciliation(p_household_id uuid,p_on date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date; b public.cashflow_balances; c public.balance_checkins; expected bigint;
begin
  today:=public.lock_cashflow(p_household_id);
  p_on:=coalesce(p_on,today);
  if p_on not between today-365 and today then raise exception 'Invalid reconciliation input'; end if;
  select * into b from public.cashflow_balances where household_id=p_household_id;
  select * into c from public.balance_checkins where household_id=p_household_id and status='pending';
  if c.id is not null then expected:=public.reconciliation_expected(p_household_id,c.baseline_on,c.baseline_minor,c.as_of_on); end if;
  return jsonb_build_object(
    'today',today,'revision',(select reconciliation_revision from public.households where id=p_household_id),
    'baseline',case when b.household_id is null then null else to_jsonb(b) end,
    'expected_minor',case when b.as_of_on<=p_on then public.reconciliation_expected(p_household_id,b.as_of_on,b.amount_minor,p_on) end,
    'pending',case when c.id is null then null else to_jsonb(c)||jsonb_build_object(
      'current_expected_minor',expected,'gap_minor',c.actual_minor-expected,
      'baseline_changed',c.baseline_version<>coalesce(b.version,0),
      'shares',coalesce((select jsonb_agg(to_jsonb(s) order by s.user_id) from public.balance_checkin_shares s where s.checkin_id=c.id),'[]'::jsonb)) end,
    'history',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id) from
      (select * from public.balance_checkins where household_id=p_household_id and status<>'pending' order by created_at desc,id limit 10) x),'[]'::jsonb));
end;
$$;

-- One actor-scoped request contract for create/propose/approve/resolve. A retry
-- after a lost response returns its original result without applying money twice.
create function public.apply_reconciliation(p_household_id uuid,p_actor_id uuid,p_request_id uuid,p_revision integer,p_action text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date; revision integer; payload jsonb; prior public.reconciliation_requests;
  b public.cashflow_balances; c public.balance_checkins; expected bigint; gap bigint;
  on_date date; actual bigint; item jsonb; uid uuid; part bigint; total numeric:=0; seen uuid[]:=array[]::uuid[];
  result jsonb;
begin
  today:=public.lock_cashflow(p_household_id);
  if p_actor_id is distinct from auth.uid() then raise exception 'Reconciliation unavailable'; end if;
  if p_request_id is null or p_action is null or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid reconciliation input'; end if;
  payload:=jsonb_build_object('action',p_action,'values',p_values,'revision',p_revision);
  select * into prior from public.reconciliation_requests where user_id=auth.uid() and request_id=p_request_id;
  if prior.request_id is not null then
    if prior.household_id<>p_household_id or prior.payload<>payload then raise exception 'Reconciliation request changed'; end if;
    return prior.result;
  end if;
  select reconciliation_revision into revision from public.households where id=p_household_id;
  if p_revision is distinct from revision then raise exception 'Reconciliation changed'; end if;
  select * into b from public.cashflow_balances where household_id=p_household_id;
  if p_action='check' then
    if (p_values - array['on','actualMinor'])<>'{}'::jsonb or jsonb_typeof(p_values->'on') is distinct from 'string'
      or (p_values->>'on')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or jsonb_typeof(p_values->'actualMinor') is distinct from 'number' or (p_values->>'actualMinor')!~'^-?[0-9]+$' then
      raise exception 'Invalid reconciliation input';
    end if;
    on_date:=(p_values->>'on')::date; actual:=(p_values->>'actualMinor')::bigint;
    if on_date not between today-365 and today or on_date<coalesce(b.as_of_on,on_date) then raise exception 'Invalid reconciliation input'; end if;
    -- A period locked by Money Date must never receive a new reconciliation.
    if exists(select 1 from public.budget_periods where household_id=p_household_id and status='locked' and on_date>=starts_on and on_date<ends_on) then raise exception 'Reconciliation period locked'; end if;
    expected:=public.reconciliation_expected(p_household_id,b.as_of_on,b.amount_minor,on_date);
    update public.balance_checkins set status='superseded' where household_id=p_household_id and status='pending';
    insert into public.balance_checkins(household_id,checked_by,as_of_on,actual_minor,baseline_on,baseline_minor,baseline_version,expected_minor,status)
      values(p_household_id,auth.uid(),on_date,actual,b.as_of_on,b.amount_minor,coalesce(b.version,0),expected,'pending') returning * into c;
    if expected is null or expected=actual then
      c.resolution:=case when expected is null then 'opening' else 'matched' end;
    end if;
  else
    if not (p_action=any(array['match','correction','allocate','approve','cancel-shares']))
      or (p_values-array['id','shares'])<>'{}'::jsonb then raise exception 'Invalid reconciliation input'; end if;
    select * into c from public.balance_checkins where id=(p_values->>'id')::uuid and household_id=p_household_id and status='pending';
    if c.id is null then raise exception 'Reconciliation unavailable'; end if;
    if c.baseline_version<>coalesce(b.version,0) then raise exception 'Reconciliation baseline changed'; end if;
    if exists(select 1 from public.budget_periods where household_id=p_household_id and status='locked' and c.as_of_on>=starts_on and c.as_of_on<ends_on) then raise exception 'Reconciliation period locked'; end if;
    expected:=public.reconciliation_expected(p_household_id,c.baseline_on,c.baseline_minor,c.as_of_on);
    gap:=c.actual_minor-expected;
    if p_action='match' and gap=0 then c.resolution:='matched';
    elsif p_action='correction' and gap>0 then c.resolution:='correction';
    elsif p_action='cancel-shares' then delete from public.balance_checkin_shares where checkin_id=c.id;
    elsif p_action='allocate' and gap<0 then
      if jsonb_typeof(p_values->'shares') is distinct from 'array' or jsonb_array_length(p_values->'shares') not between 1 and 2 then raise exception 'Invalid reconciliation input'; end if;
      delete from public.balance_checkin_shares where checkin_id=c.id;
      for item in select value from jsonb_array_elements(p_values->'shares') loop
        if jsonb_typeof(item) is distinct from 'object' or (item-array['userId','amountMinor'])<>'{}'::jsonb
          or jsonb_typeof(item->'amountMinor') is distinct from 'number' or (item->>'amountMinor')!~'^[0-9]+$' then raise exception 'Invalid reconciliation input'; end if;
        uid:=(item->>'userId')::uuid; part:=(item->>'amountMinor')::bigint;
        if uid is null or uid=any(seen) or not exists(select 1 from public.members where household_id=p_household_id and user_id=uid) then raise exception 'Invalid reconciliation input'; end if;
        total:=total+part; seen:=array_append(seen,uid);
        insert into public.balance_checkin_shares values(p_household_id,c.id,uid,part,case when uid=auth.uid() then now() end);
      end loop;
      if total<>-gap or not(auth.uid()=any(seen)) then raise exception 'Invalid reconciliation input'; end if;
    elsif p_action='approve' and gap<0 then
      if not exists(select 1 from public.balance_checkin_shares where checkin_id=c.id and user_id=auth.uid() and approved_at is null)
        or (select sum(amount_minor) from public.balance_checkin_shares where checkin_id=c.id) is distinct from -gap::numeric then
        raise exception 'Reconciliation changed';
      end if;
      update public.balance_checkin_shares set approved_at=now() where checkin_id=c.id and user_id=auth.uid();
    else raise exception 'Invalid reconciliation input'; end if;
    if p_action in ('allocate','approve') and not exists(select 1 from public.balance_checkin_shares where checkin_id=c.id and approved_at is null) then
      c.resolution:='allowance';
    end if;
  end if;
  if c.resolution is not null then
    if c.resolution<>'allowance' then delete from public.balance_checkin_shares where checkin_id=c.id; end if;
    update public.balance_checkins set status='resolved',resolution=c.resolution,resolved_at=now(),resolved_expected_minor=expected where id=c.id;
    insert into public.cashflow_balances(household_id,as_of_on,amount_minor,low_threshold_minor,version)
      values(p_household_id,c.as_of_on,c.actual_minor,coalesce(b.low_threshold_minor,0),1)
      on conflict(household_id) do update set as_of_on=excluded.as_of_on,amount_minor=excluded.amount_minor,version=public.cashflow_balances.version+1;
  end if;
  update public.households set reconciliation_revision=reconciliation_revision+1 where id=p_household_id;
  result:=jsonb_build_object('id',c.id);
  insert into public.reconciliation_requests values(auth.uid(),p_request_id,p_household_id,payload,result);
  return result;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range or foreign_key_violation then
  raise exception 'Invalid reconciliation input' using errcode='22023';
end;
$$;

-- Preserve the existing aggregate RPC shape. Separately aggregate private rows
-- and consented allocations so joining them cannot multiply either total.
create or replace function public.allowance_balances(p_household_id uuid)
returns table(user_id uuid,display_name text,allowance_minor bigint,spent_minor bigint,remaining_minor bigint)
language sql stable security definer set search_path='' as $$
  with month as (select date_trunc('month',now() at time zone h.timezone)::date starts_on,
    (date_trunc('month',now() at time zone h.timezone)+interval '1 month')::date ends_on
    from public.households h where id=p_household_id),
  totals as (select m.user_id,m.display_name,m.monthly_allowance_minor,m.joined_at,
    coalesce((select sum(p.amount_minor) from public.private_transactions p cross join month
      where p.household_id=m.household_id and p.owner_id=m.user_id and p.occurred_on>=month.starts_on and p.occurred_on<month.ends_on),0)
    + coalesce((select sum(s.amount_minor) from public.balance_checkin_shares s join public.balance_checkins c on c.id=s.checkin_id cross join month
      where s.household_id=m.household_id and s.user_id=m.user_id and c.status='resolved' and c.resolution='allowance' and s.approved_at is not null
        and c.as_of_on>=month.starts_on and c.as_of_on<month.ends_on),0) spent
    from public.members m where m.household_id=p_household_id and public.is_household_member(p_household_id))
  select user_id,display_name,monthly_allowance_minor,spent::bigint,(monthly_allowance_minor-spent)::bigint from totals order by joined_at;
$$;

alter table public.guide_progress drop constraint guide_progress_check;
alter table public.guide_progress add constraint guide_progress_check check(case guide_id
  when 'welcome' then step_id in ('spaces','connect')
  when 'first-visit' then step_id in ('home','shared','private','log')
  when 'quick-log' then step_id in ('space','save')
  when 'payments' then step_id in ('list','create')
  when 'cashflow' then step_id in ('forecast','calendar')
  when 'categories' then step_id in ('spaces','create')
  when 'budget-categories' then step_id in ('plan','assign')
  when 'private-allowance' then step_id in ('balance','privacy')
  when 'reconciliation' then step_id in ('compare','check')
  else false end);
revoke execute on function public.signal_reconciliation(),public.reconciliation_expected(uuid,date,bigint,date) from public,anon,authenticated;
revoke execute on function public.get_reconciliation(uuid,date),public.apply_reconciliation(uuid,uuid,uuid,integer,text,jsonb) from public,anon;
grant execute on function public.get_reconciliation(uuid,date),public.apply_reconciliation(uuid,uuid,uuid,integer,text,jsonb) to authenticated;
-- Refresh uses only the household revision signal. Raw income and private rows
-- are never added to the Realtime publication.
