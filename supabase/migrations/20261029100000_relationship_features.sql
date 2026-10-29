-- Phase 2: explicit weekly budgets, reviewed earmarks, allowance gifts,
-- dated sinking funds and expense-level contribution plans. No bank transfers.
alter table public.goals add column kind text not null default 'goal' check(kind in ('goal','sinking'));
create table public.relationship_requests (
 user_id uuid not null references auth.users(id) on delete cascade, request_id uuid not null,
 household_id uuid not null references public.households(id) on delete cascade,
 payload jsonb not null, result jsonb not null, primary key(user_id,request_id)
);
create table public.goal_allowance_entries (
 household_id uuid not null, contribution_id uuid primary key references public.goal_contributions(id) on delete cascade,
 user_id uuid not null, amount_minor bigint not null check(amount_minor<>0), occurred_on date not null,
 foreign key(household_id,user_id) references public.members(household_id,user_id) deferrable initially deferred
);
create index on public.goal_allowance_entries(household_id,user_id,occurred_on);
create table public.weekly_goal_budgets (
 household_id uuid not null references public.households(id) on delete cascade, category_id uuid not null,
 starts_on date not null check(extract(isodow from starts_on)=1), amount_minor bigint not null check(amount_minor between 0 and 1000000000000),
 version integer not null default 1, primary key(household_id,category_id,starts_on),
 foreign key(household_id,category_id) references public.categories(household_id,id) deferrable initially deferred
);
create table public.booster_claims (
 household_id uuid not null, contribution_id uuid primary key references public.goal_contributions(id) on delete cascade,
 category_id uuid not null, week_on date not null,
 foreign key(household_id,category_id) references public.categories(household_id,id) deferrable initially deferred
);
create index on public.booster_claims(household_id,category_id,week_on);
alter table public.relationship_requests enable row level security;
alter table public.goal_allowance_entries enable row level security;
alter table public.weekly_goal_budgets enable row level security;
alter table public.booster_claims enable row level security;
create policy own_request on public.relationship_requests for select to authenticated using(user_id=auth.uid() and public.is_household_member(household_id));
create policy own_allowance on public.goal_allowance_entries for select to authenticated using(user_id=auth.uid() and public.is_household_member(household_id));
create policy household_read on public.weekly_goal_budgets for select to authenticated using(public.is_household_member(household_id));
create policy household_read on public.booster_claims for select to authenticated using(public.is_household_member(household_id));
revoke all on public.relationship_requests,public.goal_allowance_entries,public.weekly_goal_budgets,public.booster_claims from public,anon,authenticated;
grant select on public.relationship_requests,public.goal_allowance_entries,public.weekly_goal_budgets,public.booster_claims to authenticated;
create trigger closed_goal_allowance before insert or update or delete on public.goal_allowance_entries for each row execute function public.guard_closed_money();

alter function public.allowance_balances(uuid) rename to allowance_balances_before_gifts;
revoke execute on function public.allowance_balances_before_gifts(uuid) from public,anon,authenticated;
create function public.allowance_balances(p_household_id uuid)
returns table(user_id uuid,display_name text,allowance_minor bigint,spent_minor bigint,remaining_minor bigint)
language sql stable security definer set search_path='' as $$
 select a.user_id,a.display_name,a.allowance_minor,(a.spent_minor+g.amount)::bigint,(a.remaining_minor-g.amount)::bigint
 from public.allowance_balances_before_gifts(p_household_id) a
 cross join lateral(select coalesce(sum(e.amount_minor),0) amount from public.goal_allowance_entries e join public.households h on h.id=e.household_id
  where e.household_id=p_household_id and e.user_id=a.user_id
  and e.occurred_on>=date_trunc('month',now() at time zone h.timezone)::date
  and e.occurred_on<(date_trunc('month',now() at time zone h.timezone)+interval '1 month')::date) g;
$$;

-- Only shared budget/ledger facts are returned. No private remainder is included.
create function public.get_boosters(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date; monday date; candidates jsonb; budgets jsonb;
begin
 today:=public.lock_cashflow(p_household_id);monday:=date_trunc('week',today)::date;
 with weeks as (select monday-(n*7)::integer week_on from generate_series(1,8) n),
 lines as (select c.id category_id,c.name,c.starter_key,w.week_on,b.amount_minor,
   coalesce((select sum(t.amount_minor) from public.shared_transactions t where t.household_id=p_household_id and t.category_id=c.id and t.occurred_on>=w.week_on and t.occurred_on<w.week_on+7),0) spent_minor,
   coalesce((select sum(g.amount_minor) from public.booster_claims q join public.goal_contributions g on g.id=q.contribution_id
    where q.household_id=p_household_id and q.category_id=c.id and q.week_on=w.week_on),0) claimed_minor
  from weeks w cross join public.categories c cross join lateral(
   select amount_minor from public.weekly_goal_budgets b where b.household_id=p_household_id and b.category_id=c.id and b.starts_on<=w.week_on order by b.starts_on desc limit 1) b
  where c.household_id=p_household_id and c.visibility='shared' and not c.archived and b.amount_minor>0),
 available as (select *,greatest(0,amount_minor-greatest(0,spent_minor)-claimed_minor)::bigint available_minor,exists(select 1 from public.budget_periods p where p.household_id=p_household_id and p.status='locked' and lines.week_on<p.ends_on and lines.week_on+7>p.starts_on) locked from lines)
 select coalesce(jsonb_agg(to_jsonb(x) order by week_on desc,name),'[]'::jsonb) into candidates from available x;
 select coalesce(jsonb_agg(to_jsonb(b) order by b.starts_on desc,b.category_id),'[]'::jsonb) into budgets from public.weekly_goal_budgets b where b.household_id=p_household_id and (b.starts_on>=monday-56 or b.starts_on=(select max(prior.starts_on) from public.weekly_goal_budgets prior where prior.household_id=b.household_id and prior.category_id=b.category_id and prior.starts_on<=monday));
 return jsonb_build_object('today',today,'next_week_on',monday+7,'candidates',candidates,'budgets',budgets,
   'token',md5(jsonb_build_object('today',today,'candidates',candidates,'budgets',budgets)::text));
end;
$$;

create function public.apply_booster(p_household_id uuid,p_actor_id uuid,p_request_id uuid,p_token text,p_action text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date; w jsonb; payload jsonb; prior public.relationship_requests; result jsonb;
 category uuid; week_on date; amount bigint; b public.weekly_goal_budgets; g public.goals; c public.goal_contributions; available bigint;
begin
 today:=public.lock_cashflow(p_household_id);
 if auth.uid() is distinct from p_actor_id or p_request_id is null then raise exception 'Goal unavailable';end if;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid goal input';end if;
 payload:=jsonb_build_object('kind','booster','token',p_token,'action',p_action,'values',p_values);
 select * into prior from public.relationship_requests where user_id=auth.uid() and request_id=p_request_id;
 if found then if prior.household_id<>p_household_id or prior.payload<>payload then raise exception 'Goal request changed';end if;return prior.result;end if;
 w:=public.get_boosters(p_household_id);
 if p_token is distinct from w->>'token' then raise exception 'Goal changed';end if;
 if (p_values-array['categoryId','weekOn','amountMinor','version','goalId','goalVersion'])<>'{}'::jsonb
   or jsonb_typeof(p_values->'amountMinor') is distinct from 'number' or (p_values->>'amountMinor')!~'^[0-9]+$'
   or (p_values->>'weekOn') is null or (p_values->>'weekOn')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid goal input';end if;
 category:=(p_values->>'categoryId')::uuid;week_on:=(p_values->>'weekOn')::date;amount:=(p_values->>'amountMinor')::bigint;
 if amount>1000000000000 or extract(isodow from week_on)<>1 or not exists(select 1 from public.categories where household_id=p_household_id and id=category and visibility='shared' and not archived) then raise exception 'Invalid goal input';end if;
 if p_action='budget' then
  if week_on<date_trunc('week',today)::date+7 or week_on>today+365 then raise exception 'Invalid goal input';end if;
  select * into b from public.weekly_goal_budgets where household_id=p_household_id and category_id=category and starts_on=week_on;
  if coalesce(b.version,0) is distinct from (p_values->>'version')::integer then raise exception 'Goal changed';end if;
  insert into public.weekly_goal_budgets values(p_household_id,category,week_on,amount,1)
   on conflict(household_id,category_id,starts_on) do update set amount_minor=excluded.amount_minor,version=public.weekly_goal_budgets.version+1;
  result:=jsonb_build_object('saved',true);
 elsif p_action='boost' then
  if amount<1 or not exists(select 1 from jsonb_array_elements(w->'candidates') x where (x->>'category_id')::uuid=category and (x->>'week_on')::date=week_on and (x->>'available_minor')::bigint>=amount) then raise exception 'Invalid goal input';end if;
  if exists(select 1 from public.budget_periods where household_id=p_household_id and status='locked' and (today>=starts_on and today<ends_on or week_on<ends_on and week_on+7>starts_on)) then raise exception 'Goal period locked';end if;
  select * into g from public.goals where household_id=p_household_id and id=(p_values->>'goalId')::uuid;
  if g.id is null or g.archived then raise exception 'Goal unavailable';end if;
  if g.version is distinct from (p_values->>'goalVersion')::integer then raise exception 'Goal changed';end if;
  select g.target_minor-coalesce(sum(amount_minor),0) into available from public.goal_contributions where goal_id=g.id;
  if amount>available then raise exception 'Invalid goal input';end if;
  perform public.prepare_goal_month(p_household_id,g.id);
  insert into public.goal_contributions(household_id,goal_id,contributor_id,amount_minor,source,occurred_on)
   values(p_household_id,g.id,auth.uid(),amount,'booster',today) returning * into c;
  insert into public.booster_claims values(p_household_id,c.id,category,week_on);
  update public.goals set version=version+1 where id=g.id;
  result:=jsonb_build_object('saved',true,'id',g.id,'completed',amount=available);
 else raise exception 'Invalid goal input';end if;
 insert into public.relationship_requests values(auth.uid(),p_request_id,p_household_id,payload,result);return result;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range or foreign_key_violation then
 raise exception 'Invalid goal input' using errcode='22023';
end;
$$;

alter function public.apply_goal(uuid,uuid,uuid,integer,text,jsonb) rename to apply_goal_before_relationships;
revoke execute on function public.apply_goal_before_relationships(uuid,uuid,uuid,integer,text,jsonb) from public,anon,authenticated;
create function public.apply_goal(p_household_id uuid,p_actor_id uuid,p_request_id uuid,p_revision integer,p_action text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date; prior public.relationship_requests; payload jsonb; result jsonb; g public.goals;
 c public.goal_contributions; reverse_entry public.goal_contributions; amount bigint; available bigint; saved bigint; v_kind text;
begin
 today:=public.lock_cashflow(p_household_id);
 if p_actor_id is distinct from auth.uid() or p_request_id is null then raise exception 'Goal unavailable';end if;
 if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid goal input';end if;
 payload:=jsonb_build_object('kind','goal','revision',p_revision,'action',p_action,'values',p_values);
 select * into prior from public.relationship_requests where user_id=auth.uid() and request_id=p_request_id;
 if found then if prior.household_id<>p_household_id or prior.payload<>payload then raise exception 'Goal request changed';end if;return prior.result;end if;
 if p_action='gift' then
  if p_revision is distinct from (select goals_revision from public.households where id=p_household_id) then raise exception 'Goal changed';end if;
  if (p_values-array['id','version','amountMinor'])<>'{}'::jsonb or jsonb_typeof(p_values->'amountMinor') is distinct from 'number' or (p_values->>'amountMinor')!~'^[0-9]+$' then raise exception 'Invalid goal input';end if;
  amount:=(p_values->>'amountMinor')::bigint;
  select * into g from public.goals where household_id=p_household_id and id=(p_values->>'id')::uuid;
  if g.id is null or g.archived then raise exception 'Goal unavailable';end if;
  if g.version is distinct from (p_values->>'version')::integer then raise exception 'Goal changed';end if;
  select remaining_minor into available from public.allowance_balances(p_household_id) where user_id=auth.uid();
  select coalesce(sum(amount_minor),0) into saved from public.goal_contributions where goal_id=g.id;
  if amount<1 or amount>1000000000000 or available is null or amount>available or amount>g.target_minor-saved then raise exception 'Gift exceeds allowance';end if;
  perform public.prepare_goal_month(p_household_id,g.id);
  insert into public.goal_contributions(household_id,goal_id,contributor_id,amount_minor,source,occurred_on)
   values(p_household_id,g.id,auth.uid(),amount,'gift',today) returning * into c;
  insert into public.goal_allowance_entries values(p_household_id,c.id,auth.uid(),amount,today);
  update public.goals set version=version+1 where id=g.id;
  result:=jsonb_build_object('id',g.id,'completed',saved+amount=g.target_minor);
 else
  if p_action='reverse' then
   select * into c from public.goal_contributions where household_id=p_household_id and goal_id=(p_values->>'id')::uuid and id=(p_values->>'contributionId')::uuid;
   -- A reversed booster cannot reopen a closed budget week.
   if c.source='booster' and exists(select 1 from public.booster_claims q join public.budget_periods p on p.household_id=q.household_id and p.status='locked' and q.week_on<p.ends_on and q.week_on+7>p.starts_on where q.contribution_id=c.id) then raise exception 'Goal period locked';end if;
  end if;
  if p_action='save' then
   v_kind:=coalesce(p_values->>'kind','goal');if v_kind not in ('goal','sinking') then raise exception 'Invalid goal input';end if;
  end if;
  result:=public.apply_goal_before_relationships(p_household_id,p_actor_id,p_request_id,p_revision,p_action,case when p_action='save' then p_values-'kind' else p_values end);
  if p_action='save' then update public.goals set kind=v_kind where id=(result->>'id')::uuid;end if;
  if p_action='reverse' and c.source in ('gift','booster') then
   select * into reverse_entry from public.goal_contributions where reverses_id=c.id;
   if c.source='gift' then insert into public.goal_allowance_entries values(p_household_id,reverse_entry.id,auth.uid(),-c.amount_minor,c.occurred_on);
   else insert into public.booster_claims select household_id,reverse_entry.id,category_id,week_on from public.booster_claims where contribution_id=c.id;end if;
  end if;
 end if;
 insert into public.relationship_requests values(auth.uid(),p_request_id,p_household_id,payload,result);return result;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range or foreign_key_violation then
 raise exception 'Invalid goal input' using errcode='22023';
end;
$$;

-- Frozen month totals include allowance gifts without private purchase rows.
create or replace function public.apply_money_date(p_household_id uuid,p_actor_id uuid,p_request_id uuid,p_month date,p_token text,p_action text,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date; payload jsonb; prior public.money_date_requests; w jsonb; p public.budget_periods; d public.money_dates;
 item jsonb; uid uuid; seen uuid[]:='{}'; amount bigint; gap bigint; g public.goals; saved bigint; check_id uuid; result jsonb;
 b public.cashflow_balances; new_anchor_on date; new_anchor_minor bigint; allowances jsonb;
begin
 today:=public.lock_cashflow(p_household_id);
 if p_actor_id is distinct from auth.uid() or p_request_id is null then raise exception 'Money Date unavailable';end if;
 payload:=jsonb_build_object('household',p_household_id,'month',p_month,'token',p_token,'action',p_action,'values',p_values);
 select * into prior from public.money_date_requests where user_id=auth.uid() and request_id=p_request_id;
 if found then if prior.payload is distinct from payload then raise exception 'Money Date request changed';end if;return prior.result;end if;
 w:=public.get_money_date(p_household_id,p_month);
 select * into p from public.budget_periods where id=(w->'period'->>'id')::uuid;
 if p.status='locked' then raise exception 'Budget period locked' using errcode='22023';end if;
 if w->>'token' is distinct from p_token then raise exception 'Money Date changed';end if;
 select * into d from public.money_dates where period_id=p.id;
 if jsonb_typeof(p_values)<>'object' or p_values is null then raise exception 'Invalid Money Date input';end if;
 if p_action='check' then
  if p.ends_on>today or jsonb_typeof(p_values->'actualMinor') is distinct from 'number' or (p_values->>'actualMinor')::numeric<>trunc((p_values->>'actualMinor')::numeric)
    or abs((p_values->>'actualMinor')::numeric)>1000000000000 then raise exception 'Invalid Money Date input';end if;
  -- The most recent known observation at/before month end is the anchor.
  select on_date,amount_minor into new_anchor_on,new_anchor_minor from public.money_date_anchor(p_household_id,p.ends_on);
  update public.balance_checkins set status='superseded' where household_id=p_household_id and status='pending' and as_of_on>=p.starts_on and as_of_on<p.ends_on;
  update public.money_dates set actual_minor=(p_values->>'actualMinor')::bigint,anchor_on=new_anchor_on,anchor_minor=new_anchor_minor,gap_shares='[]',surplus_correction=false,version=version+1 where period_id=p.id;
 elsif p_action='options' then
  if jsonb_typeof(p_values->'shares') is distinct from 'array' or jsonb_array_length(p_values->'shares')>2
    or jsonb_typeof(p_values->'drawdowns') is distinct from 'array' or jsonb_array_length(p_values->'drawdowns')>20
    or jsonb_typeof(p_values->'surplusCorrection') is distinct from 'boolean' then raise exception 'Invalid Money Date input';end if;
  if p_values->>'nextSplit' is not null and p_values->>'nextSplit' not in ('equal','proportional','combined') then raise exception 'Invalid Money Date input';end if;
  for item in select * from jsonb_array_elements(p_values->'shares') loop
    uid:=(item->>'user_id')::uuid;
    if uid is null or uid=any(seen) or not exists(select 1 from public.members where household_id=p_household_id and user_id=uid)
      or jsonb_typeof(item->'amount_minor') is distinct from 'number' or (item->>'amount_minor')::numeric<>trunc((item->>'amount_minor')::numeric)
      or (item->>'amount_minor')::numeric not between 1 and 1000000000000 then raise exception 'Invalid Money Date input';end if;
    seen:=array_append(seen,uid);
  end loop;
  gap:=(w->'facts'->>'gap_minor')::bigint;
  if jsonb_array_length(p_values->'shares')>0 and (gap>=0 or gap is null or (select sum((s->>'amount_minor')::bigint) from jsonb_array_elements(p_values->'shares') s)<>-gap) then raise exception 'Invalid Money Date input';end if;
  seen:='{}';
  for item in select * from jsonb_array_elements(p_values->'drawdowns') loop
    uid:=(item->>'goal_id')::uuid;
    select * into g from public.goals where id=uid and household_id=p_household_id;
    select coalesce(sum(amount_minor),0) into saved from public.goal_contributions where goal_id=uid;
    if g.id is null or uid=any(seen) or jsonb_typeof(item->'amount_minor') is distinct from 'number' or (item->>'amount_minor')::numeric<>trunc((item->>'amount_minor')::numeric)
      or (item->>'amount_minor')::numeric not between 1 and least(saved,1000000000000) then raise exception 'Invalid Money Date input';end if;
    seen:=array_append(seen,uid);
  end loop;
  update public.money_dates set gap_shares=p_values->'shares',surplus_correction=(p_values->>'surplusCorrection')::boolean,next_split=(p_values->>'nextSplit')::public.split_mode,
    drawdowns=p_values->'drawdowns',version=version+1 where period_id=p.id;
 elsif p_action='approve' then
  if not (w->>'ready')::boolean or p_values->'synced' is distinct from 'true'::jsonb then raise exception 'Money Date not ready';end if;
  insert into public.money_date_approvals values(p_household_id,p.id,auth.uid(),p_token,now()) on conflict(period_id,user_id) do update set token=excluded.token,approved_at=excluded.approved_at;
 elsif p_action='withdraw' then
  delete from public.money_date_approvals where period_id=p.id and user_id=auth.uid();
 elsif p_action='lock' then
  if not (w->>'ready')::boolean or (select count(*) from public.money_date_approvals where period_id=p.id and token=p_token)<>2
   or exists(select 1 from public.budget_periods where household_id=p_household_id and starts_on<p.starts_on and ends_on<=p.starts_on and plan_snapshot is not null and status<>'locked')
   then raise exception 'Money Date not ready';end if;
  -- Validate releases again at commit. They only release earmarks: no bank
  -- transfer, private debit or shared expense is fabricated.
  for item in select * from jsonb_array_elements(d.drawdowns) loop
    uid:=(item->>'goal_id')::uuid;amount:=(item->>'amount_minor')::bigint;
    select coalesce(sum(amount_minor),0) into saved from public.goal_contributions where goal_id=uid and household_id=p_household_id;
    if saved<amount or exists(select 1 from public.budget_periods where household_id=p_household_id and status='locked' and today>=starts_on and today<ends_on) then raise exception 'Money Date changed';end if;
    insert into public.goal_contributions(household_id,goal_id,contributor_id,amount_minor,source,occurred_on,money_date_period_id)
      values(p_household_id,uid,auth.uid(),-amount,'variance',today,p.id);
    update public.goals set version=version+1 where id=uid;
  end loop;
  if d.next_split is not null then
    insert into public.period_split_overrides values(p_household_id,p.ends_on,d.next_split) on conflict(household_id,month_on) do update set mode=excluded.mode;
  end if;
  for g in select * from public.goals where household_id=p_household_id loop perform public.prepare_goal_month(p_household_id,g.id,true);end loop;
  gap:=(w->'facts'->>'gap_minor')::bigint;
  insert into public.balance_checkins(household_id,checked_by,as_of_on,actual_minor,baseline_on,baseline_minor,baseline_version,expected_minor,status,resolution,resolved_expected_minor,resolved_at)
    values(p_household_id,auth.uid(),p.ends_on-1,d.actual_minor,d.anchor_on,d.anchor_minor,0,(w->'facts'->>'expected_minor')::bigint,'resolved',
    case when gap is null then 'opening' when gap=0 then 'matched' when gap<0 then 'allowance' else 'correction' end,(w->'facts'->>'expected_minor')::bigint,now()) returning id into check_id;
  if gap<0 then
    for item in select * from jsonb_array_elements(d.gap_shares) loop
      insert into public.balance_checkin_shares values(p_household_id,check_id,(item->>'user_id')::uuid,(item->>'amount_minor')::bigint,now());
    end loop;
  end if;
  select * into b from public.cashflow_balances where household_id=p_household_id;
  if b.household_id is null or b.as_of_on<p.ends_on then
    insert into public.cashflow_balances(household_id,as_of_on,amount_minor,low_threshold_minor,version) values(p_household_id,p.ends_on-1,d.actual_minor,coalesce(b.low_threshold_minor,0),1)
    on conflict(household_id) do update set as_of_on=excluded.as_of_on,amount_minor=excluded.amount_minor,version=public.cashflow_balances.version+1;
  end if;
  insert into public.period_allowances select m.household_id,m.user_id,p.ends_on,(a->>'amount_minor')::bigint
    from jsonb_array_elements(w->'facts'->'next_allowances') a join public.members m on m.user_id=(a->>'user_id')::uuid and m.household_id=p_household_id on conflict do nothing;
  -- Only aggregate private amounts are snapshotted. Raw purchases, category
  -- labels, notes, sources and receipts are never selected into shared JSON.
  select jsonb_agg(jsonb_build_object('user_id',m.user_id,'allowance_minor',coalesce(a.amount_minor,(pm->>'allowance_minor')::bigint),'spent_minor',
    coalesce((select sum(amount_minor) from public.private_transactions where household_id=p_household_id and owner_id=m.user_id and occurred_on>=p.starts_on and occurred_on<p.ends_on),0)
    +coalesce((select sum(e.amount_minor) from public.goal_allowance_entries e where e.household_id=p_household_id and e.user_id=m.user_id and e.occurred_on>=p.starts_on and e.occurred_on<p.ends_on),0)
    +coalesce((select sum(s.amount_minor) from public.balance_checkin_shares s join public.balance_checkins c on c.id=s.checkin_id where s.household_id=p_household_id and s.user_id=m.user_id and c.status='resolved' and s.approved_at is not null and c.as_of_on>=p.starts_on and c.as_of_on<p.ends_on),0)) order by m.user_id)
    into allowances from public.members m left join lateral(select value pm from jsonb_array_elements(p.plan_snapshot->'members') where value->>'user_id'=m.user_id::text) old on true
    left join public.period_allowances a on a.household_id=m.household_id and a.user_id=m.user_id and a.month_on=p.starts_on where m.household_id=p_household_id;
  update public.budget_periods set status='locked',snapshot=jsonb_build_object('facts',w->'facts','allowances',coalesce(allowances,'[]'::jsonb),'approvals',w->'approvals','closed_at',now(),'checkin_id',check_id) where id=p.id;
  perform public.ensure_money_period(p_household_id,date_trunc('month',today)::date);
 else raise exception 'Invalid Money Date input';end if;
 update public.households set goals_revision=goals_revision+1 where id=p_household_id;
 result:=jsonb_build_object('period_id',p.id,'locked',p_action='lock');
 insert into public.money_date_requests values(auth.uid(),p_request_id,p_household_id,payload,result);
 return result;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range or foreign_key_violation then
 raise exception 'Invalid Money Date input' using errcode='22023';
end;
$$;

-- A split is a contribution agreement, never a charge, payment or bank transfer.
create table public.expense_splits (
 household_id uuid not null references public.households(id) on delete cascade,
 transaction_id uuid primary key references public.shared_transactions(id) on delete cascade,
 mode text not null check(mode in ('equal','income','percentage','fixed','custom')),
 weights jsonb not null, shares jsonb not null, amount_minor bigint not null, occurred_on date not null,
 version integer not null default 1, updated_by uuid not null references auth.users(id), updated_at timestamptz not null default now()
);
alter table public.expense_splits enable row level security;
create policy household_read on public.expense_splits for select to authenticated using(public.is_household_member(household_id));
revoke all on public.expense_splits from public,anon,authenticated;
grant select on public.expense_splits to authenticated;
create trigger closed_expense_split before insert or update or delete on public.expense_splits for each row execute function public.guard_closed_money();
create trigger expense_split_revision after insert or update or delete on public.expense_splits for each row execute function public.signal_goals();

create function public.allocate_expense_split(p_total bigint,p_weights jsonb) returns jsonb
language sql immutable security definer set search_path='' as $$
 with w as (select (v->>'userId')::uuid user_id,(v->>'weight')::numeric weight,i from jsonb_array_elements(p_weights) with ordinality x(v,i)),
 exact as (select *,abs(p_total::numeric)*weight/nullif(sum(weight) over(),0) n from w),
 parts as (select *,floor(n) base,n-floor(n) fraction from exact),
 ranked as (select *,row_number() over(order by fraction desc,i) rank,abs(p_total::numeric)-sum(base) over() remainder from parts)
 select coalesce(jsonb_agg(jsonb_build_object('user_id',user_id,'amount_minor',sign(p_total)*(base+case when rank<=remainder then 1 else 0 end)) order by i),'[]'::jsonb) from ranked;
$$;
create function public.get_expense_split(p_household_id uuid,p_transaction_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date; e public.shared_transactions; s public.expense_splits; members jsonb; weights jsonb; mode text; ready boolean;
begin
 today:=public.lock_cashflow(p_household_id);
 select * into e from public.shared_transactions where id=p_transaction_id and household_id=p_household_id;
 if e.id is null then raise exception 'Expense unavailable';end if;
 select * into s from public.expense_splits where transaction_id=e.id and household_id=p_household_id;
 select jsonb_agg(jsonb_build_object('user_id',user_id,'display_name',display_name,'income_minor',monthly_income_minor,'setup_step',budget_setup_step) order by joined_at,user_id)
 into members from public.members where household_id=p_household_id;
 mode:=case when public.effective_split_mode(p_household_id,e.occurred_on)='equal' then 'equal' else 'income' end;
 select count(*)=2 and (mode='equal' or (bool_and(budget_setup_step>=1) and sum(monthly_income_minor)>0)) into ready from public.members where household_id=p_household_id;
 select jsonb_agg(jsonb_build_object('userId',user_id,'weight',case when mode='equal' then 1 else monthly_income_minor end) order by joined_at,user_id)
 into weights from public.members where household_id=p_household_id;
 return jsonb_build_object('today',today,'expense',jsonb_build_object('id',e.id,'description',e.description,'amount_minor',e.amount_minor,'occurred_on',e.occurred_on,'paid_by',e.paid_by),
  'members',members,'saved',case when s.transaction_id is not null then to_jsonb(s) end,'default_mode',mode,'default_ready',ready,
  'default_shares',case when ready then public.allocate_expense_split(e.amount_minor,weights) else '[]'::jsonb end,
  'stale',s.transaction_id is not null and (s.amount_minor,s.occurred_on) is distinct from (e.amount_minor,e.occurred_on),
  'locked',exists(select 1 from public.budget_periods where household_id=p_household_id and status='locked' and e.occurred_on>=starts_on and e.occurred_on<ends_on),
  'token',md5(jsonb_build_object('expense',jsonb_build_array(e.id,e.amount_minor,e.occurred_on,e.version),'split',to_jsonb(s),'members',members,'mode',mode)::text));
end;
$$;
create function public.save_expense_split(p_household_id uuid,p_actor_id uuid,p_request_id uuid,p_transaction_id uuid,p_token text,p_mode text,p_weights jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date; w jsonb; prior public.relationship_requests; payload jsonb; weights jsonb; shares jsonb; result jsonb; e public.shared_transactions;
 n integer; total numeric; mode text;
begin
 today:=public.lock_cashflow(p_household_id);
 if auth.uid() is distinct from p_actor_id or p_request_id is null then raise exception 'Expense unavailable';end if;
 payload:=jsonb_build_object('kind','split','transaction',p_transaction_id,'token',p_token,'mode',p_mode,'weights',p_weights);
 select * into prior from public.relationship_requests where user_id=auth.uid() and request_id=p_request_id;
 if found then if prior.household_id<>p_household_id or prior.payload<>payload then raise exception 'Goal request changed';end if;return prior.result;end if;
 w:=public.get_expense_split(p_household_id,p_transaction_id);
 if p_token is distinct from w->>'token' then raise exception 'Expense split changed';end if;
 if (w->>'locked')::boolean then raise exception 'Budget period locked';end if;
 if p_mode is null or p_mode not in ('equal','income','percentage','fixed','custom') then raise exception 'Invalid expense split';end if;
 select * into e from public.shared_transactions where id=p_transaction_id and household_id=p_household_id;
 select count(*) into n from public.members where household_id=p_household_id;
 if n<>2 then raise exception 'Expense split needs partner';end if;
 if p_mode in ('equal','income') then
  if p_weights is distinct from '[]'::jsonb then raise exception 'Invalid expense split';end if;
  if p_mode='income' and not (select bool_and(budget_setup_step>=1) and sum(monthly_income_minor)>0 from public.members where household_id=p_household_id) then raise exception 'Expense split needs income';end if;
  select jsonb_agg(jsonb_build_object('userId',user_id,'weight',case when p_mode='equal' then 1 else monthly_income_minor end) order by joined_at,user_id)
  into weights from public.members where household_id=p_household_id;
 else
  if jsonb_typeof(p_weights) is distinct from 'array' or jsonb_array_length(p_weights)<>n then raise exception 'Invalid expense split';end if;
  if exists(select 1 from jsonb_array_elements(p_weights) x where jsonb_typeof(x) is distinct from 'object' or (x-array['userId','weight'])<>'{}'::jsonb or jsonb_typeof(x->'weight') is distinct from 'number' or (x->>'weight')!~'^[0-9]+$' or (x->>'weight')::numeric>1000000000000 or not exists(select 1 from public.members m where m.household_id=p_household_id and m.user_id=(x->>'userId')::uuid)) then raise exception 'Invalid expense split';end if;
  if (select count(distinct x->>'userId') from jsonb_array_elements(p_weights) x)<>n then raise exception 'Invalid expense split';end if;
  select sum((x->>'weight')::numeric) into total from jsonb_array_elements(p_weights) x;
  if total is null or total<=0 or p_mode='percentage' and total<>10000 or p_mode='fixed' and total<>abs(e.amount_minor::numeric) then raise exception 'Invalid expense split';end if;
  select jsonb_agg(x order by m.joined_at,m.user_id) into weights from jsonb_array_elements(p_weights) x join public.members m on m.user_id=(x->>'userId')::uuid and m.household_id=p_household_id;
 end if;
 shares:=public.allocate_expense_split(e.amount_minor,weights);
 insert into public.expense_splits(household_id,transaction_id,mode,weights,shares,amount_minor,occurred_on,updated_by)
 values(p_household_id,e.id,p_mode,weights,shares,e.amount_minor,e.occurred_on,auth.uid())
 on conflict(transaction_id) do update set mode=excluded.mode,weights=excluded.weights,shares=excluded.shares,amount_minor=excluded.amount_minor,occurred_on=excluded.occurred_on,version=public.expense_splits.version+1,updated_by=auth.uid(),updated_at=now();
 result:=jsonb_build_object('saved',true,'shares',shares);insert into public.relationship_requests values(auth.uid(),p_request_id,p_household_id,payload,result);return result;
exception when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range or foreign_key_violation then
 raise exception 'Invalid expense split' using errcode='22023';
end;
$$;

revoke execute on function public.allocate_expense_split(bigint,jsonb) from public,anon,authenticated;
revoke execute on function public.allowance_balances(uuid),public.apply_goal(uuid,uuid,uuid,integer,text,jsonb),public.get_boosters(uuid),public.apply_booster(uuid,uuid,uuid,text,text,jsonb),public.get_expense_split(uuid,uuid),public.save_expense_split(uuid,uuid,uuid,uuid,text,text,jsonb) from public,anon;
grant execute on function public.allowance_balances(uuid),public.apply_goal(uuid,uuid,uuid,integer,text,jsonb),public.get_boosters(uuid),public.apply_booster(uuid,uuid,uuid,text,text,jsonb),public.get_expense_split(uuid,uuid),public.save_expense_split(uuid,uuid,uuid,uuid,text,text,jsonb) to authenticated;

create or replace function public.get_money_date(p_household_id uuid,p_month date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date; current_month date; p public.budget_periods; d public.money_dates; facts jsonb;
 flow jsonb; goals jsonb; expected bigint; gap bigint; review_token text; ready boolean; periods jsonb; next_mode public.split_mode; latest_anchor record; baseline_changed boolean;
begin
 today:=public.lock_cashflow(p_household_id);current_month:=date_trunc('month',today)::date;
 perform public.ensure_money_period(p_household_id,current_month);
 select coalesce(jsonb_agg(jsonb_build_object('month_on',starts_on,'status',status,'recorded',plan_snapshot is not null) order by starts_on desc),'[]'::jsonb)
 into periods from public.budget_periods where household_id=p_household_id and ends_on=(starts_on+interval '1 month')::date and starts_on=date_trunc('month',starts_on)::date;
 p_month:=coalesce(p_month,(select min(starts_on) from public.budget_periods where household_id=p_household_id and status<>'locked' and plan_snapshot is not null and ends_on<=today),current_month);
 select * into p from public.budget_periods where household_id=p_household_id and starts_on=p_month and starts_on=date_trunc('month',starts_on)::date and ends_on=(starts_on+interval '1 month')::date;
 if p.id is null then raise exception 'Money Date unavailable'; end if;
 if p.status='locked' then return jsonb_build_object('today',today,'periods',periods,'period',to_jsonb(p),'facts',p.snapshot->'facts','token',null,'approvals',p.snapshot->'approvals','ready',false);end if;
 insert into public.money_dates(household_id,period_id) values(p_household_id,p.id) on conflict do nothing;
 select * into d from public.money_dates where period_id=p.id;
 flow:=public.get_cashflow(p_household_id);goals:=public.get_goals(p_household_id);
 expected:=public.reconciliation_expected(p_household_id,d.anchor_on,d.anchor_minor,p.ends_on-1);gap:=d.actual_minor-expected;
 select * into latest_anchor from public.money_date_anchor(p_household_id,p.ends_on);
 baseline_changed:=d.actual_minor is not null and latest_anchor.on_date is not null and (d.anchor_on is null or latest_anchor.on_date>=d.anchor_on) and (d.anchor_on,d.anchor_minor) is distinct from (latest_anchor.on_date,latest_anchor.amount_minor);
 next_mode:=coalesce(d.next_split,public.effective_split_mode(p_household_id,p.ends_on));
 facts:=jsonb_build_object('today',today,'month_on',p.starts_on,'ends_on',p.ends_on,'plan',p.plan_snapshot,'draft',to_jsonb(d),
  'expected_minor',expected,'gap_minor',gap,'baseline_changed',baseline_changed,'default_split',(select split_mode from public.households where id=p_household_id),'next_split',next_mode,
  'members',(select jsonb_agg(jsonb_build_object('user_id',user_id,'display_name',display_name) order by user_id) from public.members where household_id=p_household_id),
  'next_allowances',(select jsonb_agg(jsonb_build_object('user_id',m.user_id,'amount_minor',coalesce(a.amount_minor,m.monthly_allowance_minor)) order by m.user_id)
    from public.members m left join public.period_allowances a on a.household_id=m.household_id and a.user_id=m.user_id and a.month_on=p.ends_on where m.household_id=p_household_id),
  'categories',coalesce((select jsonb_agg(to_jsonb(s) order by category_id) from (
    select grouped.*,coalesce((select sum(t.amount_minor) from public.shared_transactions t where t.household_id=p_household_id and t.category_id=grouped.category_id and t.occurred_on>=p.starts_on and t.occurred_on<p.ends_on),0)::bigint spent_minor
    from (select (c->>'category_id')::uuid category_id,max(c->>'category_name') name,sum((c->>'amount_minor')::bigint)::bigint planned_minor
      from jsonb_array_elements(p.plan_snapshot->'costs') c where c->>'category_id' is not null group by (c->>'category_id')::uuid) grouped) s),'[]'::jsonb),
  'goals',goals->'goals','flow',flow,
  'bill_splits',coalesce((select jsonb_agg(jsonb_build_object('transaction_id',s.transaction_id,'description',t.description,'mode',s.mode,'amount_minor',s.amount_minor,'shares',s.shares,'stale',(s.amount_minor,s.occurred_on) is distinct from (t.amount_minor,t.occurred_on)) order by s.transaction_id)
   from public.expense_splits s join public.shared_transactions t on t.id=s.transaction_id where s.household_id=p_household_id and t.occurred_on>=p.starts_on and t.occurred_on<p.ends_on),'[]'::jsonb),
  'ledger_hash',md5(public.money_date_canonical(jsonb_build_object(
    'expenses',(select jsonb_agg(to_jsonb(t)) from public.shared_transactions t where household_id=p_household_id and occurred_on>=coalesce(d.anchor_on,p.starts_on) and occurred_on<p.ends_on),
    'income',(select jsonb_agg(jsonb_build_array(shared_on,shared_amount_minor,shared_received)) from public.income_occurrences where household_id=p_household_id and shared_on>d.anchor_on and shared_on<p.ends_on and shared_amount_minor>0),
    'checks',(select jsonb_agg(jsonb_build_array(id,status,actual_minor,as_of_on)) from public.balance_checkins where household_id=p_household_id and as_of_on>=p.starts_on and as_of_on<p.ends_on)))::text));
 ready:=not baseline_changed and p.plan_snapshot is not null and p.ends_on<=today and d.actual_minor is not null
   and (select count(*)=2 from public.members where household_id=p_household_id)
   and not exists(select 1 from public.balance_checkins where household_id=p_household_id and status='pending' and as_of_on>=p.starts_on and as_of_on<p.ends_on)
   and (gap is null or gap=0 or (gap>0 and d.surplus_correction) or (gap<0 and (select coalesce(sum((s->>'amount_minor')::bigint),0) from jsonb_array_elements(d.gap_shares) s)=-gap));
 review_token:=md5(public.money_date_canonical(facts)::text);
 return jsonb_build_object('today',today,'periods',periods,'period',to_jsonb(p),'facts',facts,'token',review_token,'ready',ready,
   'approvals',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'approved',coalesce(a.token=review_token,false)) order by m.user_id)
    from public.members m left join public.money_date_approvals a on a.period_id=p.id and a.user_id=m.user_id where m.household_id=p_household_id),'[]'::jsonb));
end;
$$;

create trigger weekly_budget_revision after insert or update or delete on public.weekly_goal_budgets for each row execute function public.signal_goals();

alter table public.guide_progress drop constraint guide_progress_check;
alter table public.guide_progress add constraint guide_progress_check check(case guide_id
 when 'welcome' then step_id in ('spaces','connect') when 'first-visit' then step_id in ('home','shared','private','log')
 when 'quick-log' then step_id in ('space','save') when 'payments' then step_id in ('list','create')
 when 'cashflow' then step_id in ('forecast','calendar') when 'categories' then step_id in ('spaces','create')
 when 'budget-categories' then step_id in ('plan','assign') when 'private-allowance' then step_id in ('balance','privacy')
 when 'reconciliation' then step_id in ('compare','check') when 'goals' then step_id in ('overview','create')
 when 'money-date' then step_id in ('review','close') when 'reminders' then step_id in ('overview','save') when 'boosters' then step_id in ('overview','budget') when 'gift' then step_id='give' when 'sinking-funds' then step_id in ('overview','create') when 'bill-split' then step_id='save' else false end);

-- A pooled weekly leftover credits both monthly shares according to their plan,
-- rather than assigning all relationship progress to the person who tapped Save.
create function public.goal_booster_credit(p_goal_id uuid,p_month date,p_shares jsonb) returns jsonb
language sql stable security definer set search_path='' as $$
 select public.allocate_expense_split(
  coalesce((select sum(amount_minor) from public.goal_contributions where goal_id=p_goal_id and source='booster' and occurred_on>=p_month and occurred_on<(p_month+interval '1 month')::date),0)::bigint,
  (select jsonb_agg(jsonb_build_object('userId',v->>'user_id','weight',case when
    (select coalesce(sum((x->>'target_minor')::numeric),0) from jsonb_array_elements(p_shares) x)>0 then coalesce((v->>'target_minor')::bigint,0) else 1 end) order by i)
   from jsonb_array_elements(p_shares) with ordinality items(v,i)));
$$;
revoke execute on function public.goal_booster_credit(uuid,date,jsonb) from public,anon,authenticated;

create or replace function public.get_goals(p_household_id uuid) returns jsonb
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
        (select coalesce(sum(amount_minor),0) from public.goal_contributions where goal_id=g.id and source not in ('variance','booster') and contributor_id=(s->>'user_id')::uuid and occurred_on>=first_on and occurred_on<first_on+interval '1 month')
        +coalesce((select (credit->>'amount_minor')::bigint from jsonb_array_elements(public.goal_booster_credit(g.id,first_on,m.shares)) credit where credit->>'user_id'=s->>'user_id'),0)))
        from jsonb_array_elements(m.shares) s),'[]'::jsonb)) from public.goal_months m where m.goal_id=g.id and m.month_on=first_on),
      'series',coalesce((select jsonb_agg(to_jsonb(x) order by month_on) from (select date_trunc('month',occurred_on)::date month_on,sum(amount_minor)::bigint amount_minor
        from public.goal_contributions where goal_id=g.id and occurred_on>=(first_on-interval '5 months')::date group by 1) x),'[]'::jsonb))
      order by g.archived,g.created_at,g.id) from public.goals g where g.household_id=p_household_id),'[]'::jsonb));
end;
$$;
