-- Shared savings are earmarks within tracked shared funds, not expenses or bank
-- transfers. Only explicit, actor-checked contributions change a goal balance.
alter table public.households add column goals_revision integer not null default 0;
create table public.goals (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references public.households(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 80),
  target_minor bigint not null check(target_minor between 1 and 1000000000000),
  deadline_on date not null, starts_on date not null,
  category_id uuid not null, archived boolean not null default false, version integer not null default 1,
  replaced_forecast_id uuid, created_at timestamptz not null default now(),
  unique(household_id,id), foreign key(household_id,category_id) references public.categories(household_id,id) deferrable initially deferred,
  check(deadline_on>=starts_on)
);
create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(), household_id uuid not null, goal_id uuid not null,
  contributor_id uuid not null, amount_minor bigint not null check(amount_minor<>0 and amount_minor between -1000000000000 and 1000000000000),
  source text not null check(source in ('scheduled','booster','gift','variance')),
  occurred_on date not null, reverses_id uuid unique, created_at timestamptz not null default now(),
  unique(household_id,goal_id,id),
  foreign key(household_id,goal_id) references public.goals(household_id,id) on delete cascade,
  foreign key(household_id,contributor_id) references public.members(household_id,user_id) deferrable initially deferred,
  foreign key(household_id,goal_id,reverses_id) references public.goal_contributions(household_id,goal_id,id) deferrable initially deferred,
  check((amount_minor<0)=(reverses_id is not null))
);
create index on public.goal_contributions(goal_id,occurred_on);
create index on public.goal_contributions(goal_id,created_at desc,id desc);
-- Monthly targets are snapshots: later contributions do not shrink the target
-- a partner is being measured against. Editing/replanning explicitly replaces
-- only this month's plan; earlier monthly agreements remain intact.
create table public.goal_months (
  household_id uuid not null, goal_id uuid not null, month_on date not null,
  target_minor bigint not null check(target_minor between 0 and 1000000000000),
  due_on date not null, split_mode public.split_mode not null, split_ready boolean not null,
  shares jsonb not null, primary key(goal_id,month_on),
  foreign key(household_id,goal_id) references public.goals(household_id,id) on delete cascade
);
create table public.goal_requests (
  user_id uuid not null references auth.users(id) on delete cascade, request_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  payload jsonb not null, result jsonb not null, primary key(user_id,request_id)
);
alter table public.goals enable row level security;
alter table public.goal_contributions enable row level security;
alter table public.goal_months enable row level security;
alter table public.goal_requests enable row level security;
create policy household_read on public.goals for select to authenticated using(public.is_household_member(household_id));
create policy household_read on public.goal_contributions for select to authenticated using(public.is_household_member(household_id));
create policy household_read on public.goal_months for select to authenticated using(public.is_household_member(household_id));
create policy own_request on public.goal_requests for select to authenticated using(user_id=auth.uid() and public.is_household_member(household_id));
revoke all on public.goals,public.goal_contributions,public.goal_months,public.goal_requests from anon,authenticated;
grant select on public.goals,public.goal_contributions,public.goal_months,public.goal_requests to authenticated;

create function public.signal_goals() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if TG_TABLE_NAME='members' and TG_OP='UPDATE' then
    if (OLD.monthly_income_minor,OLD.budget_setup_step,OLD.display_name) is not distinct from
      (NEW.monthly_income_minor,NEW.budget_setup_step,NEW.display_name) then return NEW; end if;
  end if;
  update public.households set goals_revision=goals_revision+1 where id=coalesce(NEW.household_id,OLD.household_id);
  return coalesce(NEW,OLD);
end;
$$;
create trigger goals_revision after insert or update or delete on public.goals for each row execute function public.signal_goals();
create trigger goal_month_revision after insert or update or delete on public.goal_months for each row execute function public.signal_goals();
create trigger goal_member_revision after insert or update or delete on public.members for each row execute function public.signal_goals();
create trigger goal_forecast_revision after insert or update or delete on public.cashflow_goal_plans for each row execute function public.signal_goals();
create function public.signal_goal_split() returns trigger language plpgsql set search_path='' as $$
begin
  if NEW.split_mode is distinct from OLD.split_mode then NEW.goals_revision:=OLD.goals_revision+1; end if;
  return NEW;
end;
$$;
create trigger goal_split_revision before update of split_mode on public.households for each row execute function public.signal_goal_split();

create function public.prepare_goal_month(p_household_id uuid,p_id uuid,p_force boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare g public.goals; today date; month_start date; months integer; saved numeric; contributed numeric;
  quota bigint; ready boolean; mode public.split_mode; shares jsonb;
begin
  select * into g from public.goals where id=p_id and household_id=p_household_id;
  select (now() at time zone timezone)::date,split_mode into today,mode from public.households where id=p_household_id;
  month_start:=date_trunc('month',today)::date;
  if not p_force and exists(select 1 from public.goal_months m where m.goal_id=g.id and m.month_on=month_start) then return; end if;
  select coalesce(sum(amount_minor),0),coalesce(sum(amount_minor) filter(where occurred_on>=month_start and occurred_on<month_start+interval '1 month'),0)
    into saved,contributed from public.goal_contributions where goal_id=g.id;
  months:=greatest(1,(extract(year from g.deadline_on)::integer-extract(year from today)::integer)*12+extract(month from g.deadline_on)::integer-extract(month from today)::integer+1);
  quota:=ceil(greatest(0,g.target_minor-saved+contributed)/months)::bigint;
  select count(*)=2 and (mode='equal' or (bool_and(budget_setup_step>=1) and sum(monthly_income_minor)>0)) into ready
    from public.members where household_id=p_household_id;
  -- Numeric products and largest remainders avoid floating-point rounding, even
  -- when target and income are each 10^12 minor units. Ties follow join order/id.
  with weights as (select user_id,joined_at,case when mode='equal' then 1::numeric else monthly_income_minor::numeric end weight
      from public.members where household_id=p_household_id),
    exact as (select *,quota*weight/nullif(sum(weight) over(),0) value from weights),
    parts as (select *,floor(value) base,value-floor(value) fraction from exact),
    ranked as (select *,row_number() over(order by fraction desc,joined_at,user_id) rank,
      quota-coalesce(sum(base) over(),0) leftover from parts)
  select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'target_minor',case when ready then base+case when rank<=leftover then 1 else 0 end end)
    order by joined_at,user_id),'[]'::jsonb) into shares from ranked;
  insert into public.goal_months values(p_household_id,g.id,month_start,quota,least((month_start+interval '1 month' - interval '1 day')::date,g.deadline_on),mode,ready,shares)
    on conflict(goal_id,month_on) do update set target_minor=excluded.target_minor,due_on=excluded.due_on,
      split_mode=excluded.split_mode,split_ready=excluded.split_ready,shares=excluded.shares;
end;
$$;

create function public.get_goals(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date; first_on date; current_goal public.goals;
begin
  today:=public.lock_cashflow(p_household_id);first_on:=date_trunc('month',today)::date;
  for current_goal in select * from public.goals where household_id=p_household_id loop
    perform public.prepare_goal_month(p_household_id,current_goal.id);
  end loop;
  return jsonb_build_object('today',today,'revision',(select goals_revision from public.households where id=p_household_id),
    'categories',coalesce((select jsonb_agg(to_jsonb(c) order by sort_order,id) from public.categories c where household_id=p_household_id and visibility='shared'),'[]'::jsonb),
    'forecast_plans',coalesce((select jsonb_agg(to_jsonb(p) order by due_on,id) from public.cashflow_goal_plans p where household_id=p_household_id),'[]'::jsonb),
    'goals',coalesce((select jsonb_agg(to_jsonb(g)||jsonb_build_object(
      'saved_minor',(select coalesce(sum(amount_minor),0) from public.goal_contributions where goal_id=g.id),
      'month',(select to_jsonb(m)||jsonb_build_object('shares',coalesce((select jsonb_agg(s||jsonb_build_object('contributed_minor',
        (select coalesce(sum(amount_minor),0) from public.goal_contributions where goal_id=g.id and contributor_id=(s->>'user_id')::uuid and occurred_on>=first_on and occurred_on<first_on+interval '1 month')))
        from jsonb_array_elements(m.shares) s),'[]'::jsonb)) from public.goal_months m where m.goal_id=g.id and m.month_on=first_on),
      'series',coalesce((select jsonb_agg(to_jsonb(x) order by month_on) from (select date_trunc('month',occurred_on)::date month_on,sum(amount_minor)::bigint amount_minor
        from public.goal_contributions where goal_id=g.id and occurred_on>=(first_on-interval '5 months')::date group by 1) x),'[]'::jsonb))
      order by g.archived,g.created_at,g.id) from public.goals g where g.household_id=p_household_id),'[]'::jsonb));
end;
$$;

create function public.get_goal_history(p_household_id uuid,p_goal_id uuid,p_before_time timestamptz default null,p_before_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform public.lock_cashflow(p_household_id);
  if not exists(select 1 from public.goals where id=p_goal_id and household_id=p_household_id) then raise exception 'Goal unavailable'; end if;
  if (p_before_time is null)<>(p_before_id is null) then raise exception 'Invalid goal input'; end if;
  return coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('reversed',exists(select 1 from public.goal_contributions r where r.reverses_id=c.id)) order by created_at desc,id desc)
    from (select * from public.goal_contributions where goal_id=p_goal_id and (p_before_time is null or (created_at,id)<(p_before_time,p_before_id))
      order by created_at desc,id desc limit 50) c),'[]'::jsonb);
end;
$$;

create function public.apply_goal(p_household_id uuid,p_actor_id uuid,p_request_id uuid,p_revision integer,p_action text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date; payload jsonb; prior public.goal_requests; g public.goals; c public.goal_contributions;
  saved bigint; amount bigint; target bigint; on_date date; deadline date; category uuid; plan public.cashflow_goal_plans; result jsonb;
begin
  today:=public.lock_cashflow(p_household_id);
  if p_actor_id is distinct from auth.uid() then raise exception 'Goal unavailable'; end if;
  if p_request_id is null or p_action is null or jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid goal input'; end if;
  payload:=jsonb_build_object('action',p_action,'values',p_values,'revision',p_revision);
  select * into prior from public.goal_requests where user_id=auth.uid() and request_id=p_request_id;
  if prior.request_id is not null then
    if prior.household_id<>p_household_id or prior.payload<>payload then raise exception 'Goal request changed'; end if;
    return prior.result;
  end if;
  if p_revision is distinct from (select goals_revision from public.households where id=p_household_id) then raise exception 'Goal changed'; end if;
  if exists(select 1 from public.budget_periods where household_id=p_household_id and status='locked' and today>=starts_on and today<ends_on) then raise exception 'Goal period locked'; end if;
  if p_action='save' then
    if (p_values-array['id','version','name','targetMinor','deadlineOn','categoryId','replacePlanId','replacePlanVersion'])<>'{}'::jsonb
      or jsonb_typeof(p_values->'name') is distinct from 'string'
      or jsonb_typeof(p_values->'targetMinor') is distinct from 'number' or (p_values->>'targetMinor')!~'^[0-9]+$'
      or (p_values->>'deadlineOn') is null or (p_values->>'deadlineOn')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid goal input'; end if;
    target:=(p_values->>'targetMinor')::bigint;deadline:=(p_values->>'deadlineOn')::date;category:=(p_values->>'categoryId')::uuid;
    if not exists(select 1 from public.categories where id=category and household_id=p_household_id and visibility='shared' and not archived)
      or deadline>today+interval '10 years' then raise exception 'Invalid goal input'; end if;
    if p_values->>'id' is null then
      if deadline<today or (p_values->>'version')::integer is distinct from 0 then raise exception 'Invalid goal input'; end if;
      if (select count(*) from public.goals where household_id=p_household_id)>=100 then raise exception 'Goal limit reached'; end if;
      if p_values->>'replacePlanId' is not null then
        select * into plan from public.cashflow_goal_plans where id=(p_values->>'replacePlanId')::uuid and household_id=p_household_id;
        if plan.id is null or plan.version is distinct from (p_values->>'replacePlanVersion')::integer then raise exception 'Goal changed'; end if;
        delete from public.cashflow_overrides where household_id=p_household_id and item_key='goal:'||plan.id::text;
        delete from public.cashflow_goal_plans where id=plan.id;
      end if;
      insert into public.goals(household_id,name,target_minor,deadline_on,starts_on,category_id,replaced_forecast_id)
        values(p_household_id,trim(p_values->>'name'),target,deadline,today,category,plan.id) returning * into g;
    else
      select * into g from public.goals where id=(p_values->>'id')::uuid and household_id=p_household_id;
      if g.id is null then raise exception 'Goal unavailable'; end if;
      if g.version is distinct from (p_values->>'version')::integer then raise exception 'Goal changed'; end if;
      if p_values->>'replacePlanId' is not null then raise exception 'Invalid goal input'; end if;
      select coalesce(sum(amount_minor),0) into saved from public.goal_contributions where goal_id=g.id;
      if target<saved then raise exception 'Goal target below saved'; end if;
      update public.goals set name=trim(p_values->>'name'),target_minor=target,deadline_on=deadline,category_id=category,version=version+1 where id=g.id returning * into g;
    end if;
    perform public.prepare_goal_month(p_household_id,g.id,true);
  else
    if (p_values-array['id','version','amountMinor','on','contributionId','archived'])<>'{}'::jsonb then raise exception 'Invalid goal input'; end if;
    select * into g from public.goals where id=(p_values->>'id')::uuid and household_id=p_household_id;
    if g.id is null then raise exception 'Goal unavailable'; end if;
    if g.version is distinct from (p_values->>'version')::integer then raise exception 'Goal changed'; end if;
    perform public.prepare_goal_month(p_household_id,g.id);
    select coalesce(sum(amount_minor),0) into saved from public.goal_contributions where goal_id=g.id;
    if p_action='contribute' then
      if g.archived or jsonb_typeof(p_values->'amountMinor') is distinct from 'number' or (p_values->>'amountMinor')!~'^[0-9]+$'
        or (p_values->>'on') is null or (p_values->>'on')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid goal input'; end if;
      amount:=(p_values->>'amountMinor')::bigint;on_date:=(p_values->>'on')::date;
      if amount<1 or amount>g.target_minor-saved or on_date<greatest(g.starts_on,today-365) or on_date>today then raise exception 'Invalid goal input'; end if;
      if exists(select 1 from public.budget_periods where household_id=p_household_id and status='locked' and on_date>=starts_on and on_date<ends_on) then raise exception 'Goal period locked'; end if;
      insert into public.goal_contributions(household_id,goal_id,contributor_id,amount_minor,source,occurred_on)
        values(p_household_id,g.id,auth.uid(),amount,'scheduled',on_date);
      update public.goals set version=version+1 where id=g.id returning * into g;
      if on_date<date_trunc('month',today)::date then perform public.prepare_goal_month(p_household_id,g.id,true); end if;
    elsif p_action='reverse' then
      select * into c from public.goal_contributions where id=(p_values->>'contributionId')::uuid and goal_id=g.id and contributor_id=auth.uid() and amount_minor>0;
      if c.id is null or exists(select 1 from public.goal_contributions where reverses_id=c.id) then raise exception 'Goal contribution unavailable'; end if;
      if exists(select 1 from public.budget_periods where household_id=p_household_id and status='locked' and c.occurred_on>=starts_on and c.occurred_on<ends_on) then raise exception 'Goal period locked'; end if;
      insert into public.goal_contributions(household_id,goal_id,contributor_id,amount_minor,source,occurred_on,reverses_id)
        values(p_household_id,g.id,auth.uid(),-c.amount_minor,c.source,c.occurred_on,c.id);
      update public.goals set version=version+1 where id=g.id returning * into g;
      perform public.prepare_goal_month(p_household_id,g.id,true);
    elsif p_action='archive' then
      if jsonb_typeof(p_values->'archived') is distinct from 'boolean' then raise exception 'Invalid goal input'; end if;
      update public.goals set archived=(p_values->>'archived')::boolean,version=version+1 where id=g.id returning * into g;
      if not g.archived then perform public.prepare_goal_month(p_household_id,g.id,true); end if;
    elsif p_action='replan' then
      perform public.prepare_goal_month(p_household_id,g.id,true);
      update public.goals set version=version+1 where id=g.id returning * into g;
    else raise exception 'Invalid goal input'; end if;
  end if;
  select coalesce(sum(amount_minor),0) into saved from public.goal_contributions where goal_id=g.id;
  result:=jsonb_build_object('id',g.id,'completed',saved>=g.target_minor);
  insert into public.goal_requests values(auth.uid(),p_request_id,p_household_id,payload,result);
  return result;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range or foreign_key_violation then
  raise exception 'Invalid goal input' using errcode='22023';
end;
$$;

-- Extend the existing shared projection without changing reconciliation's cash
-- ledger. Held savings reduce projected availability, not the actual balance.
alter function public.get_cashflow(uuid) rename to get_cashflow_before_goals;
revoke execute on function public.get_cashflow_before_goals(uuid) from public,anon,authenticated;
create function public.get_cashflow(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare base jsonb; today date; first_on date; g public.goals; m public.goal_months;
  held numeric:=0; saved numeric; paid numeric; remaining numeric; quota bigint; due date;
  months integer; offset_month integer; month_on date; plans jsonb:='[]'::jsonb; used jsonb;
begin
  base:=public.get_cashflow_before_goals(p_household_id);today:=(base->>'today')::date;first_on:=date_trunc('month',today)::date;
  for g in select * from public.goals where household_id=p_household_id loop
    perform public.prepare_goal_month(p_household_id,g.id);
    select coalesce(sum(amount_minor),0),coalesce(sum(amount_minor) filter(where occurred_on>=first_on and occurred_on<first_on+interval '1 month'),0)
      into saved,paid from public.goal_contributions where goal_id=g.id;
    held:=held+saved;
    if g.archived then continue; end if;
    select * into m from public.goal_months where goal_id=g.id and goal_months.month_on=first_on;
    remaining:=greatest(0,g.target_minor-saved);
    for offset_month in 0..6 loop
      month_on:=(first_on+make_interval(months=>offset_month))::date;
      if month_on>today+180 or (offset_month>0 and month_on>g.deadline_on) or remaining<=0 then exit; end if;
      if offset_month=0 then quota:=least(remaining,greatest(0,m.target_minor-paid));due:=m.due_on;
      else
        months:=greatest(1,(extract(year from g.deadline_on)::integer-extract(year from month_on)::integer)*12+extract(month from g.deadline_on)::integer-extract(month from month_on)::integer+1);
        quota:=ceil(remaining/months)::bigint;due:=least((month_on+interval '1 month' - interval '1 day')::date,g.deadline_on);
      end if;
      if quota>0 then plans:=plans||jsonb_build_array(jsonb_build_object('id',g.id,'month_on',month_on,'name',g.name,'category_id',g.category_id,'due_on',due,'amount_minor',quota)); end if;
      remaining:=remaining-quota;
    end loop;
  end loop;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]'::jsonb) into used from (select goal_row.category_id,sum(c.amount_minor)::bigint amount_minor
    from public.goal_contributions c join public.goals goal_row on goal_row.id=c.goal_id where goal_row.household_id=p_household_id and c.occurred_on>=first_on and c.occurred_on<first_on+interval '1 month'
    group by goal_row.category_id) x;
  return base||jsonb_build_object('savings',jsonb_build_object('reserved_minor',held,'month_allocations',used,'plans',plans));
end;
$$;

-- Category archive continues to reassign every shared goal atomically.
alter function public.archive_category(uuid,integer,uuid) rename to archive_category_before_goals;
revoke execute on function public.archive_category_before_goals(uuid,integer,uuid) from public,anon,authenticated;
create function public.archive_category(p_id uuid,p_version integer,p_replacement_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.archive_category_before_goals(p_id,p_version,p_replacement_id);
  update public.goals set category_id=p_replacement_id,version=version+1 where category_id=p_id;
end;
$$;
alter table public.guide_progress drop constraint guide_progress_check;
alter table public.guide_progress add constraint guide_progress_check check(case guide_id
  when 'welcome' then step_id in ('spaces','connect') when 'first-visit' then step_id in ('home','shared','private','log')
  when 'quick-log' then step_id in ('space','save') when 'payments' then step_id in ('list','create')
  when 'cashflow' then step_id in ('forecast','calendar') when 'categories' then step_id in ('spaces','create')
  when 'budget-categories' then step_id in ('plan','assign') when 'private-allowance' then step_id in ('balance','privacy')
  when 'reconciliation' then step_id in ('compare','check') when 'goals' then step_id in ('overview','create') else false end);
revoke execute on function public.signal_goals(),public.signal_goal_split(),public.prepare_goal_month(uuid,uuid,boolean) from public,anon,authenticated;
revoke execute on function public.get_goals(uuid),public.get_goal_history(uuid,uuid,timestamptz,uuid),public.apply_goal(uuid,uuid,uuid,integer,text,jsonb),public.get_cashflow(uuid),public.archive_category(uuid,integer,uuid) from public,anon;
grant execute on function public.get_goals(uuid),public.get_goal_history(uuid,uuid,timestamptz,uuid),public.apply_goal(uuid,uuid,uuid,integer,text,jsonb),public.get_cashflow(uuid),public.archive_category(uuid,integer,uuid) to authenticated;
