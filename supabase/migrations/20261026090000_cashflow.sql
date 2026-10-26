-- Cash-flow projections: private income stays owner-only; only approved daily
-- shared contributions cross the household boundary. No bank balance is guessed.
alter table public.households add column cashflow_revision integer not null default 0;
alter table public.income_sources
  add column shared_amount_minor bigint not null default 0 check (shared_amount_minor between 0 and 1000000000000),
  add column shared_delay_days integer not null default 0 check (shared_delay_days between 0 and 31),
  add column version integer not null default 1;

create table public.income_occurrences (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null, source_id uuid references public.income_sources(id) on delete set null,
  source_ref uuid, original_on date, overridden boolean not null default false,
  name text not null check (length(trim(name)) between 1 and 80),
  expected_on date, expected_amount_minor bigint check (expected_amount_minor between 0 and 1000000000000),
  status text not null default 'expected' check (status in ('expected','received','dismissed')),
  actual_on date, actual_amount_minor bigint check (actual_amount_minor between 0 and 1000000000000),
  shared_on date, shared_amount_minor bigint not null default 0 check (shared_amount_minor between 0 and 1000000000000),
  shared_received boolean not null default false, version integer not null default 1,
  foreign key (household_id, owner_id) references public.members(household_id,user_id) on delete cascade,
  unique(source_ref,original_on),
  check (case when status='received' then actual_on is not null and actual_amount_minor is not null else actual_on is null and actual_amount_minor is null end),
  check (shared_amount_minor = 0 or shared_on is not null),
  check (not shared_received or status = 'received'),
  check (status <> 'dismissed' or shared_amount_minor = 0),
  check (shared_amount_minor <= coalesce(case when status = 'received' then actual_amount_minor else expected_amount_minor end,1000000000000))
);
create index on public.income_occurrences(household_id,shared_on);
create index on public.income_occurrences(owner_id,expected_on);
create table public.cashflow_balances (
  household_id uuid primary key references public.households(id) on delete cascade,
  as_of_on date not null, amount_minor bigint not null check (amount_minor between -1000000000000 and 1000000000000),
  low_threshold_minor bigint not null default 0 check (low_threshold_minor between 0 and 1000000000000),
  version integer not null default 1
);
create table public.cashflow_budget_links (
  cost_id uuid primary key references public.budget_costs(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  category_id uuid not null references public.categories(id), version integer not null default 1
);
-- Forecast reservations only. Savings balances and progress belong to Phase 2.
create table public.cashflow_goal_plans (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80), category_id uuid not null references public.categories(id),
  due_on date not null, amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
  version integer not null default 1
);
create table public.cashflow_overrides (
  household_id uuid not null references public.households(id) on delete cascade,
  item_key text not null check (length(item_key) < 120), due_on date,
  amount_minor bigint check (amount_minor between 0 and 1000000000000), dismissed boolean not null default false,
  version integer not null default 1, primary key(household_id,item_key)
);
alter table public.income_occurrences enable row level security;
create policy own_income on public.income_occurrences for select to authenticated
  using (owner_id = auth.uid() and public.is_household_member(household_id));
alter table public.cashflow_balances enable row level security;
alter table public.cashflow_budget_links enable row level security;
alter table public.cashflow_goal_plans enable row level security;
alter table public.cashflow_overrides enable row level security;
create policy household_read on public.cashflow_balances for select to authenticated using (public.is_household_member(household_id));
create policy household_read on public.cashflow_budget_links for select to authenticated using (public.is_household_member(household_id));
create policy household_read on public.cashflow_goal_plans for select to authenticated using (public.is_household_member(household_id));
create policy household_read on public.cashflow_overrides for select to authenticated using (public.is_household_member(household_id));
revoke all on public.income_occurrences, public.cashflow_balances, public.cashflow_budget_links, public.cashflow_goal_plans, public.cashflow_overrides from anon, authenticated;
grant select on public.income_occurrences, public.cashflow_balances, public.cashflow_budget_links, public.cashflow_goal_plans, public.cashflow_overrides to authenticated;

create function public.lock_cashflow(p_household_id uuid) returns date
language plpgsql security definer set search_path = '' as $$
declare today date;
begin
  if not public.is_household_member(p_household_id) then raise exception 'Forecast unavailable' using errcode='42501'; end if;
  select (now() at time zone timezone)::date into today from public.households where id=p_household_id for update;
  return today;
end;
$$;
-- Signal ONLY public contribution changes, never gross pay, employer, raw status or source edits.
create function public.signal_shared_income() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_public jsonb; new_public jsonb;
begin
  if TG_OP <> 'INSERT' and OLD.shared_amount_minor > 0 then
    old_public := jsonb_build_array(OLD.shared_on,OLD.shared_amount_minor,OLD.shared_received);
  end if;
  if TG_OP <> 'DELETE' and NEW.shared_amount_minor > 0 then
    new_public := jsonb_build_array(NEW.shared_on,NEW.shared_amount_minor,NEW.shared_received);
  end if;
  if old_public is distinct from new_public then
    -- A daily-total correction is only valid for that exact pending aggregate.
    -- Confirmation, dismissal or source changes invalidate it before projection.
    delete from public.cashflow_overrides where household_id=coalesce(NEW.household_id,OLD.household_id)
      and item_key in ('income:'||OLD.shared_on::text,'income:'||NEW.shared_on::text);
    update public.households set cashflow_revision=cashflow_revision+1 where id=coalesce(NEW.household_id,OLD.household_id);
  end if;
  return null;
end;
$$;
create trigger signal_shared_income after insert or update or delete on public.income_occurrences
  for each row execute function public.signal_shared_income();
-- Retain individual corrections and confirmed history when an original source changes/disappears.
create or replace function public.clear_future_income() returns trigger language plpgsql security definer set search_path = '' as $$
declare today date;
begin
  select (now() at time zone timezone)::date into today from public.households where id=OLD.household_id;
  if TG_OP='DELETE' then
    delete from public.income_occurrences where source_id=OLD.id and not overridden and status='expected';
    return OLD;
  elsif (NEW.cadence,NEW.next_payday) is distinct from (OLD.cadence,OLD.next_payday) then
    delete from public.income_occurrences where source_id=OLD.id and not overridden and status='expected' and original_on>=today;
  else
    -- Keep IDs and the public tuple stable on private name/gross-pay edits.
    update public.income_occurrences set name=NEW.name,expected_amount_minor=NEW.amount_minor,
      shared_amount_minor=NEW.shared_amount_minor,shared_on=original_on+NEW.shared_delay_days,version=version+1
      where source_id=OLD.id and not overridden and status='expected' and original_on>=today
        and (name,expected_amount_minor,shared_amount_minor,shared_on) is distinct from
          (NEW.name,NEW.amount_minor,NEW.shared_amount_minor,original_on+NEW.shared_delay_days);
  end if;
  return NEW;
end;
$$;

create trigger clear_future_income before delete or update on public.income_sources
  for each row execute function public.clear_future_income();

-- Bounded generation jumps to the requested year/month/week instead of walking from an ancient anchor.
create function public.refresh_income(p_household_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare today date; s public.income_sources; d date; m date; start_index integer; step integer; n integer;
begin
  today := public.lock_cashflow(p_household_id);
  for s in select * from public.income_sources where household_id=p_household_id and next_payday is not null loop
    if s.cadence='monthly' then
      start_index := greatest(0,(extract(year from today-366)::integer-extract(year from s.next_payday)::integer)*12
        +extract(month from today-366)::integer-extract(month from s.next_payday)::integer);
      for n in start_index..start_index+20 loop
        m := (date_trunc('month',s.next_payday)+make_interval(months=>n))::date;
        d := public.payment_date_in_month(m,extract(day from s.next_payday)::integer);
        if d between today-366 and today+180 then
          insert into public.income_occurrences(household_id,owner_id,source_id,source_ref,original_on,name,expected_on,expected_amount_minor,shared_on,shared_amount_minor)
            values(s.household_id,s.owner_id,s.id,s.id,d,s.name,d,s.amount_minor,d+s.shared_delay_days,s.shared_amount_minor)
            on conflict(source_ref,original_on) do nothing;
        end if;
      end loop;
    elsif s.cadence in ('weekly','biweekly') then
      step := case when s.cadence='weekly' then 7 else 14 end;
      start_index := greatest(0,(today-366-s.next_payday)/step);
      for n in start_index..start_index+(550/step)+2 loop
        d := s.next_payday+n*step;
        if d between today-366 and today+180 then
          insert into public.income_occurrences(household_id,owner_id,source_id,source_ref,original_on,name,expected_on,expected_amount_minor,shared_on,shared_amount_minor)
            values(s.household_id,s.owner_id,s.id,s.id,d,s.name,d,s.amount_minor,d+s.shared_delay_days,s.shared_amount_minor)
            on conflict(source_ref,original_on) do nothing;
        end if;
      end loop;
    elsif s.next_payday between today-366 and today+180 then
      insert into public.income_occurrences(household_id,owner_id,source_id,source_ref,original_on,name,expected_on,expected_amount_minor,shared_on,shared_amount_minor)
        values(s.household_id,s.owner_id,s.id,s.id,s.next_payday,s.name,s.next_payday,s.amount_minor,s.next_payday+s.shared_delay_days,s.shared_amount_minor)
        on conflict(source_ref,original_on) do nothing;
    end if;
  end loop;
end;
$$;

create function public.save_income_contribution(p_household_id uuid,p_id uuid,p_version integer,p_amount_minor bigint,p_delay_days integer)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.income_sources;
begin
  perform public.lock_cashflow(p_household_id);
  select * into s from public.income_sources where household_id=p_household_id and id=p_id and owner_id=auth.uid() for update;
  if s.id is null then raise exception 'Income unavailable'; end if;
  if p_version is distinct from s.version then raise exception 'Forecast changed'; end if;
  if p_amount_minor is null or p_amount_minor not between 0 and coalesce(s.amount_minor,1000000000000)
    or p_delay_days is null or p_delay_days not between 0 and 31 then raise exception 'Invalid forecast input'; end if;
  update public.income_sources set shared_amount_minor=p_amount_minor, shared_delay_days=p_delay_days,version=version+1 where id=s.id;
  perform public.refresh_income(p_household_id);
end;
$$;

create function public.save_income_occurrence(p_household_id uuid,p_id uuid,p_version integer,p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare o public.income_occurrences; today date; new_id uuid;
begin
  today := public.lock_cashflow(p_household_id);
  if p_id is not null then
    select * into o from public.income_occurrences where id=p_id and household_id=p_household_id and owner_id=auth.uid() for update;
    if o.id is null then raise exception 'Income unavailable'; end if;
    if p_version is distinct from o.version then raise exception 'Forecast changed'; end if;
  end if;
  if jsonb_typeof(p_values) is distinct from 'object' or p_values->>'status' is null
    or p_values->>'status' not in ('expected','received','dismissed')
    or nullif(trim(p_values->>'name'),'') is null
    or (p_values->>'expectedOn' is not null and (p_values->>'expectedOn')::date not between today-366 and today+180)
    or (p_values->>'sharedOn' is not null and (p_values->>'sharedOn')::date not between today-366 and today+211)
    or (p_values->>'status'='received' and ((p_values->>'actualOn') is null or (p_values->>'actualOn')::date not between today-366 and today))
    or (coalesce((p_values->>'sharedReceived')::boolean,false) and (p_values->>'sharedOn')::date > today)
    then raise exception 'Invalid forecast input'; end if;
  if p_id is null then
    insert into public.income_occurrences(household_id,owner_id,name,expected_on,expected_amount_minor,status,actual_on,actual_amount_minor,shared_on,shared_amount_minor,shared_received,overridden)
      values(p_household_id,auth.uid(),trim(p_values->>'name'),(p_values->>'expectedOn')::date,(p_values->>'expectedAmountMinor')::bigint,
        p_values->>'status',(p_values->>'actualOn')::date,(p_values->>'actualAmountMinor')::bigint,
        (p_values->>'sharedOn')::date,coalesce((p_values->>'sharedAmountMinor')::bigint,0),coalesce((p_values->>'sharedReceived')::boolean,false),true)
      returning id into new_id;
  else
    update public.income_occurrences set name=trim(p_values->>'name'),expected_on=(p_values->>'expectedOn')::date,
      expected_amount_minor=(p_values->>'expectedAmountMinor')::bigint,status=p_values->>'status',actual_on=(p_values->>'actualOn')::date,
      actual_amount_minor=(p_values->>'actualAmountMinor')::bigint,shared_on=(p_values->>'sharedOn')::date,
      shared_amount_minor=coalesce((p_values->>'sharedAmountMinor')::bigint,0),shared_received=coalesce((p_values->>'sharedReceived')::boolean,false),
      overridden=true,version=version+1 where id=o.id returning id into new_id;
  end if;
  return new_id;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow then
  raise exception 'Invalid forecast input' using errcode='22023';
end;
$$;

create function public.get_my_income(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_income(p_household_id);
  return jsonb_build_object('sources',coalesce((select jsonb_agg(to_jsonb(s) order by s.sort_order) from public.income_sources s
      where s.household_id=p_household_id and s.owner_id=auth.uid()),'[]'::jsonb),
    'occurrences',coalesce((select jsonb_agg(to_jsonb(o) order by o.expected_on nulls last,o.id) from public.income_occurrences o
      where o.household_id=p_household_id and o.owner_id=auth.uid()),'[]'::jsonb));
end;
$$;

create function public.save_cashflow_balance(p_household_id uuid,p_version integer,p_as_of_on date,p_amount_minor bigint,p_threshold_minor bigint)
returns void language plpgsql security definer set search_path = '' as $$
declare b public.cashflow_balances; today date;
begin
  today:=public.lock_cashflow(p_household_id);
  select * into b from public.cashflow_balances where household_id=p_household_id for update;
  if p_version is distinct from coalesce(b.version,0) then raise exception 'Forecast changed'; end if;
  if p_as_of_on is null or p_as_of_on not between today-365 and today or p_amount_minor is null or p_threshold_minor is null then
    raise exception 'Invalid forecast input'; end if;
  insert into public.cashflow_balances values(p_household_id,p_as_of_on,p_amount_minor,p_threshold_minor,1)
    on conflict(household_id) do update set as_of_on=excluded.as_of_on,amount_minor=excluded.amount_minor,
      low_threshold_minor=excluded.low_threshold_minor,version=public.cashflow_balances.version+1;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow then
  raise exception 'Invalid forecast input' using errcode='22023';
end;
$$;

create function public.save_cashflow_plan(p_household_id uuid,p_kind text,p_id uuid,p_version integer,p_values jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare row_version integer; today date; cat uuid;
begin
  today:=public.lock_cashflow(p_household_id);
  if p_kind='budget' then
    if not exists(select 1 from public.budget_costs where id=p_id and household_id=p_household_id) then raise exception 'Forecast unavailable'; end if;
    select version into row_version from public.cashflow_budget_links where cost_id=p_id and household_id=p_household_id for update;
  elsif p_kind='goal' then
    select version into row_version from public.cashflow_goal_plans where id=p_id and household_id=p_household_id for update;
    if p_id is not null and row_version is null then raise exception 'Forecast unavailable'; end if;
  else raise exception 'Invalid forecast input'; end if;
  if p_version is distinct from coalesce(row_version,0) then raise exception 'Forecast changed'; end if;
  if p_values is null then
    if p_kind='budget' then delete from public.cashflow_budget_links where cost_id=p_id;
    else delete from public.cashflow_goal_plans where id=p_id; end if;
    return;
  end if;
  cat:=(p_values->>'categoryId')::uuid;
  perform public.validate_expense_category(p_household_id,cat,'shared',auth.uid());
  if p_kind='budget' then
    insert into public.cashflow_budget_links values(p_id,p_household_id,cat,1) on conflict(cost_id)
      do update set category_id=excluded.category_id,version=public.cashflow_budget_links.version+1;
  else
    if (p_values->>'dueOn')::date not between today and today+180 then raise exception 'Invalid forecast input'; end if;
    if p_id is null then
      insert into public.cashflow_goal_plans(household_id,name,category_id,due_on,amount_minor)
        values(p_household_id,trim(p_values->>'name'),cat,(p_values->>'dueOn')::date,(p_values->>'amountMinor')::bigint);
    else
      update public.cashflow_goal_plans set name=trim(p_values->>'name'),category_id=cat,due_on=(p_values->>'dueOn')::date,
        amount_minor=(p_values->>'amountMinor')::bigint,version=version+1 where id=p_id;
    end if;
  end if;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow then
  raise exception 'Invalid forecast input' using errcode='22023';
end;
$$;

create function public.save_cashflow_override(p_household_id uuid,p_key text,p_version integer,p_values jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare today date; v integer; target uuid; d date; s public.scheduled_payments; valid boolean:=false;
begin
  today:=public.lock_cashflow(p_household_id);
  -- Validate against public targets. A private ID is indistinguishable from a nonexistent one.
  if p_key ~ '^payment:[0-9a-f-]{36}:[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    target:=split_part(p_key,':',2)::uuid; d:=split_part(p_key,':',3)::date;
    select * into s from public.scheduled_payments where id=target and household_id=p_household_id and visibility='shared' and status='active';
    valid:=s.id is not null and d>=s.due_start and d<=today+180 and (d=s.due_start or
      (s.recurrence='monthly' and d=public.payment_date_in_month(d,s.anchor_start_day)));
  elsif p_key ~ '^goal:[0-9a-f-]{36}$' then
    valid:=exists(select 1 from public.cashflow_goal_plans where id=split_part(p_key,':',2)::uuid and household_id=p_household_id);
  elsif p_key ~ '^budget:[0-9a-f-]{36}:[0-9]{4}-[0-9]{2}$' then
    d:=(split_part(p_key,':',3)||'-01')::date;
    valid:=d between date_trunc('month',today)::date and today+180 and exists(select 1 from public.cashflow_budget_links
      where household_id=p_household_id and category_id=split_part(p_key,':',2)::uuid);
  elsif p_key ~ '^income:[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    d:=split_part(p_key,':',2)::date;
    valid:=exists(select 1 from public.income_occurrences where household_id=p_household_id and shared_on=d and shared_amount_minor>0 and not shared_received);
  end if;
  if not coalesce(valid,false) then raise exception 'Forecast unavailable'; end if;
  select version into v from public.cashflow_overrides where household_id=p_household_id and item_key=p_key for update;
  if p_version is distinct from coalesce(v,0) then raise exception 'Forecast changed'; end if;
  if p_values is null then delete from public.cashflow_overrides where household_id=p_household_id and item_key=p_key; return; end if;
  if (p_values->>'dueOn') is not null and (p_values->>'dueOn')::date not between today and today+180 then raise exception 'Invalid forecast input'; end if;
  insert into public.cashflow_overrides values(p_household_id,p_key,(p_values->>'dueOn')::date,(p_values->>'amountMinor')::bigint,
    coalesce((p_values->>'dismissed')::boolean,false),1)
    on conflict(household_id,item_key) do update set due_on=excluded.due_on,amount_minor=excluded.amount_minor,
      dismissed=excluded.dismissed,version=public.cashflow_overrides.version+1;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow then
  raise exception 'Invalid forecast input' using errcode='22023';
end;
$$;

-- This projection is deliberately separate from owner-only get_my_income.
create function public.get_cashflow(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare today date; first_on date;
begin
  perform public.refresh_income(p_household_id);
  select (now() at time zone timezone)::date into today from public.households where id=p_household_id;
  select least(date_trunc('month',as_of_on)::date,date_trunc('month',today)::date) into first_on
    from public.cashflow_balances where household_id=p_household_id;
  first_on:=greatest(coalesce(first_on,today-31),today-366);
  return jsonb_build_object('today',today,
    'balance',(select to_jsonb(b) from public.cashflow_balances b where household_id=p_household_id),
    'income',coalesce((select jsonb_agg(to_jsonb(i) order by i.on_date) from
      (select shared_on as on_date,shared_received as confirmed,sum(shared_amount_minor)::bigint as amount_minor
        from public.income_occurrences where household_id=p_household_id and shared_amount_minor>0
          and shared_on between first_on and today+180 group by shared_on,shared_received) i),'[]'::jsonb),
    'payments',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('estimate_minor',coalesce(s.expected_amount_minor,
      (select round(avg(r.amount_minor))::bigint from (select amount_minor from public.payment_records
        where schedule_ref=s.id order by paid_on desc,created_at desc limit 3) r))))
      from public.scheduled_payments s where s.household_id=p_household_id and s.visibility='shared' and s.status='active'),'[]'::jsonb),
    'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'on_date',occurred_on,'amount_minor',amount_minor,
      'category_id',category_id,'name',description)) from public.shared_transactions where household_id=p_household_id
      and occurred_on between first_on and today+180),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.sort_order,c.id) from public.categories c
      where c.household_id=p_household_id and c.visibility='shared'),'[]'::jsonb),
    'budgets',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('category_id',l.category_id,'version',coalesce(l.version,0)))
      from public.budget_costs c left join public.cashflow_budget_links l on l.cost_id=c.id where c.household_id=p_household_id),'[]'::jsonb),
    'goals',coalesce((select jsonb_agg(to_jsonb(g)) from public.cashflow_goal_plans g where g.household_id=p_household_id),'[]'::jsonb),
    'overrides',coalesce((select jsonb_agg(to_jsonb(o)) from public.cashflow_overrides o where o.household_id=p_household_id),'[]'::jsonb));
end;
$$;

create or replace function public.save_budget_paydays(p_household_id uuid, p_revision integer, p_sources jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare revision integer; item jsonb; position integer := 0; total bigint := 0; amount bigint; source_id uuid; kept uuid[] := array[]::uuid[];
begin
  perform public.lock_budget_setup(p_household_id, p_revision);
  if jsonb_typeof(p_sources) is distinct from 'array' then
    raise exception 'Invalid budget input' using errcode = '22023';
  end if;
  if jsonb_array_length(p_sources) not between 1 and 10 then
    raise exception 'Invalid budget input' using errcode = '22023';
  end if;
  if not exists (select 1 from public.members where household_id = p_household_id
    and user_id = auth.uid() and budget_setup_step >= 3) then
    raise exception 'Complete the earlier budget steps' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_sources) loop
    if jsonb_typeof(item->'name') is distinct from 'string'
      or jsonb_typeof(item->'cadence') is distinct from 'string'
      or (item->'amountMinor' is not null and item->'amountMinor' <> 'null'::jsonb and
        (jsonb_typeof(item->'amountMinor') is distinct from 'number' or (item->>'amountMinor') !~ '^[0-9]+$')) then
      raise exception 'Invalid budget input' using errcode = '22023';
    end if;
    amount := (item->>'amountMinor')::bigint;
    total := total + coalesce(amount, 0);
    if total > 1000000000000 then
      raise exception 'Invalid budget input' using errcode = '22023';
    end if;
    if item->>'nextPayday' is not null and (item->>'nextPayday') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      raise exception 'Invalid budget input' using errcode = '22023';
    end if;
    source_id := (item->>'id')::uuid;
    if source_id is not null then
      if source_id=any(kept) or not exists(select 1 from public.income_sources where id=source_id and household_id=p_household_id and owner_id=auth.uid()) then
        raise exception 'Invalid budget input';
      end if;
      update public.income_sources set name=trim(item->>'name'),cadence=item->>'cadence',amount_minor=amount,
        next_payday=(item->>'nextPayday')::date,sort_order=position,
        shared_amount_minor=least(shared_amount_minor,coalesce(amount,1000000000000)),version=version+1 where id=source_id;
    else
      insert into public.income_sources(household_id,owner_id,name,cadence,amount_minor,next_payday,sort_order)
        values(p_household_id,auth.uid(),trim(item->>'name'),item->>'cadence',amount,(item->>'nextPayday')::date,position)
        returning id into source_id;
    end if;
    kept:=array_append(kept,source_id);
    position := position + 1;
  end loop;
  delete from public.income_sources where household_id=p_household_id and owner_id=auth.uid() and not(id=any(kept));
  update public.members set budget_setup_step = 4, budget_completed_at = now()
    where household_id = p_household_id and user_id = auth.uid();
  update public.households set budget_revision = budget_revision + 1 where id = p_household_id
    returning budget_revision into revision;
  return revision;
end;
$$;


create or replace function public.archive_category(p_id uuid, p_version integer, p_replacement_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.categories; replacement public.categories;
begin
  c := public.lock_category(p_id, p_version);
  -- Always require a replacement, even for an empty category. Neither errors nor
  -- returned counts can reveal whether the partner has private items in it.
  if p_replacement_id is null or p_replacement_id = p_id then
    raise exception 'Choose replacement category' using errcode = '22023';
  end if;
  select * into replacement from public.categories where id = p_replacement_id for update;
  if replacement.id is null or replacement.household_id <> c.household_id or replacement.archived
    or (c.visibility = 'shared' and replacement.visibility <> 'shared')
    or (replacement.visibility = 'private' and replacement.owner_id <> auth.uid()) then
    raise exception 'Category unavailable' using errcode = '22023';
  end if;
  update public.shared_transactions set category_id = replacement.id where household_id = c.household_id and category_id = c.id;
  update public.private_transactions set category_id = replacement.id where household_id = c.household_id and category_id = c.id;
  update public.scheduled_payments set category_id = replacement.id, version = version + 1, updated_at = now()
    where household_id = c.household_id and category_id = c.id;
  update public.cashflow_budget_links set category_id=replacement.id,version=version+1 where household_id=c.household_id and category_id=c.id;
  update public.cashflow_goal_plans set category_id=replacement.id,version=version+1 where household_id=c.household_id and category_id=c.id;
  -- Old category reservations must not survive a move to its replacement.
  delete from public.cashflow_overrides where household_id=c.household_id and item_key like 'budget:'||c.id::text||':%';
  update public.categories set archived = true, version = version + 1 where id = c.id;
end;
$$;


revoke execute on function public.lock_cashflow(uuid), public.refresh_income(uuid),public.signal_shared_income(),public.clear_future_income() from public,anon,authenticated;
revoke execute on function public.save_income_contribution(uuid,uuid,integer,bigint,integer),public.save_income_occurrence(uuid,uuid,integer,jsonb),
  public.get_my_income(uuid),public.save_cashflow_balance(uuid,integer,date,bigint,bigint),public.save_cashflow_plan(uuid,text,uuid,integer,jsonb),
  public.save_cashflow_override(uuid,text,integer,jsonb),public.get_cashflow(uuid) from public,anon;
grant execute on function public.save_income_contribution(uuid,uuid,integer,bigint,integer),public.save_income_occurrence(uuid,uuid,integer,jsonb),
  public.get_my_income(uuid),public.save_cashflow_balance(uuid,integer,date,bigint,bigint),public.save_cashflow_plan(uuid,text,uuid,integer,jsonb),
  public.save_cashflow_override(uuid,text,integer,jsonb),public.get_cashflow(uuid) to authenticated;
do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime') then
    alter publication supabase_realtime add table public.cashflow_balances,public.cashflow_budget_links,public.cashflow_goal_plans,public.cashflow_overrides;
  end if;
end $$;

create or replace function public.save_budget_costs(p_household_id uuid, p_revision integer, p_costs jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare revision integer; item jsonb; position integer := 0; amount bigint; total bigint := 0; cost_id uuid; kept uuid[] := array[]::uuid[];
begin
  perform public.lock_budget_setup(p_household_id, p_revision);
  if not exists (select 1 from public.members where household_id = p_household_id
    and user_id = auth.uid() and budget_setup_step >= 2) then
    raise exception 'Complete the earlier budget steps' using errcode = '22023';
  end if;
  if jsonb_typeof(p_costs) is distinct from 'array' then
    raise exception 'Invalid budget input' using errcode = '22023';
  end if;
  if jsonb_array_length(p_costs) > 50 then
    raise exception 'Invalid budget input' using errcode = '22023';
  end if;
  for item in select value from jsonb_array_elements(p_costs) loop
    if jsonb_typeof(item->'amountMinor') is distinct from 'number'
      or (item->>'amountMinor') !~ '^[0-9]+$'
      or jsonb_typeof(item->'name') is distinct from 'string' then
      raise exception 'Invalid budget input' using errcode = '22023';
    end if;
    amount := (item->>'amountMinor')::bigint;
    total := total + amount;
    if total > 1000000000000 then
      raise exception 'Invalid budget input' using errcode = '22023';
    end if;
    cost_id := (item->>'id')::uuid;
    if cost_id is not null then
      if cost_id=any(kept) or not exists(select 1 from public.budget_costs where id=cost_id and household_id=p_household_id) then
        raise exception 'Invalid budget input';
      end if;
      update public.budget_costs set name=trim(item->>'name'),amount_minor=amount,sort_order=position where id=cost_id;
    else
      insert into public.budget_costs(household_id,name,amount_minor,sort_order)
        values(p_household_id,trim(item->>'name'),amount,position) returning id into cost_id;
    end if;
    kept:=array_append(kept,cost_id);
    position := position + 1;
  end loop;
  delete from public.budget_costs where household_id=p_household_id and not(id=any(kept));
  update public.members set budget_setup_step = greatest(budget_setup_step, 3)
    where household_id = p_household_id and user_id = auth.uid();
  update public.households set budget_revision = budget_revision + 1 where id = p_household_id
    returning budget_revision into revision;
  return revision;
end;
$$;

