-- Money Date: recorded monthly plans, joint consent and atomic period close.
-- Private purchases never enter shared review facts or change notifications.
alter table public.budget_periods add column plan_snapshot jsonb;
alter table public.budget_periods add constraint budget_period_household_id unique(household_id,id);
revoke insert,update,delete on public.budget_periods from public,anon,authenticated;
create table public.period_allowances (
  household_id uuid not null, user_id uuid not null, month_on date not null,
  amount_minor bigint not null check(amount_minor between 0 and 1000000000000),
  primary key(household_id,user_id,month_on),
  foreign key(household_id,user_id) references public.members(household_id,user_id) on delete cascade
);
create table public.period_split_overrides (
  household_id uuid not null references public.households(id) on delete cascade,
  month_on date not null, mode public.split_mode not null, primary key(household_id,month_on)
);
create table public.money_dates (
  household_id uuid not null, period_id uuid primary key, version integer not null default 1,
  actual_minor bigint check(actual_minor between -1000000000000 and 1000000000000),
  anchor_on date, anchor_minor bigint,
  gap_shares jsonb not null default '[]', surplus_correction boolean not null default false,
  next_split public.split_mode, drawdowns jsonb not null default '[]',
  foreign key(household_id,period_id) references public.budget_periods(household_id,id) on delete cascade
);
create table public.money_date_approvals (
  household_id uuid not null, period_id uuid not null references public.money_dates(period_id) on delete cascade,
  user_id uuid not null, token text not null, approved_at timestamptz not null default now(),
  primary key(period_id,user_id),
  foreign key(household_id,user_id) references public.members(household_id,user_id) on delete cascade
);
create table public.money_date_requests (
  user_id uuid not null references auth.users(id) on delete cascade, request_id uuid not null,
  household_id uuid not null references public.households(id) on delete cascade,
  payload jsonb not null,result jsonb not null,primary key(user_id,request_id)
);
alter table public.period_allowances enable row level security;
alter table public.period_split_overrides enable row level security;
alter table public.money_dates enable row level security;
alter table public.money_date_approvals enable row level security;
alter table public.money_date_requests enable row level security;
create policy household_read on public.period_allowances for select to authenticated using(public.is_household_member(household_id));
create policy household_read on public.period_split_overrides for select to authenticated using(public.is_household_member(household_id));
create policy household_read on public.money_dates for select to authenticated using(public.is_household_member(household_id));
create policy household_read on public.money_date_approvals for select to authenticated using(public.is_household_member(household_id));
create policy own_request on public.money_date_requests for select to authenticated using(user_id=auth.uid() and public.is_household_member(household_id));
revoke all on public.period_allowances,public.period_split_overrides,public.money_dates,public.money_date_approvals,public.money_date_requests from public,anon,authenticated;
grant select on public.period_allowances,public.period_split_overrides,public.money_dates,public.money_date_approvals,public.money_date_requests to authenticated;

create function public.effective_split_mode(p_household_id uuid,p_on date) returns public.split_mode
language sql stable security definer set search_path='' as $$
  select coalesce((select mode from public.period_split_overrides where household_id=h.id and month_on=date_trunc('month',p_on)::date),h.split_mode)
  from public.households h where id=p_household_id;
$$;
create function public.get_month_split(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date; mode public.split_mode;
begin
  today:=public.lock_cashflow(p_household_id);mode:=public.effective_split_mode(p_household_id,today);
  return jsonb_build_object('month_on',date_trunc('month',today)::date,'mode',mode,'temporary',
    exists(select 1 from public.period_split_overrides where household_id=p_household_id and month_on=date_trunc('month',today)::date));
end;
$$;

-- Only the present month's plan is captured/updated. Missing historic plans stay
-- unknown; reading an old month must never backfill it with today's defaults.
create function public.ensure_money_period(p_household_id uuid,p_month date) returns void
language plpgsql security definer set search_path='' as $$
declare current_month date; plan jsonb;
begin
  select date_trunc('month',now() at time zone timezone)::date into current_month from public.households where id=p_household_id;
  if current_month is null or p_month<>current_month then return; end if;
  select jsonb_build_object('captured_at',now(),'split_mode',public.effective_split_mode(p_household_id,p_month),
    'costs',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'category_id',l.category_id,'category_name',cat.name,'amount_minor',c.amount_minor) order by c.id)
      from public.budget_costs c left join public.cashflow_budget_links l on l.cost_id=c.id left join public.categories cat on cat.id=l.category_id
      where c.household_id=p_household_id),'[]'::jsonb),
    'members',coalesce((select jsonb_agg(jsonb_build_object('user_id',m.user_id,'display_name',m.display_name,'income_minor',m.monthly_income_minor,
      'allowance_minor',m.monthly_allowance_minor,'setup_step',m.budget_setup_step) order by m.user_id) from public.members m where m.household_id=p_household_id),'[]'::jsonb)) into plan;
  insert into public.budget_periods(household_id,starts_on,ends_on,plan_snapshot) values(p_household_id,p_month,(p_month+interval '1 month')::date,plan)
    on conflict(household_id,starts_on) do update set plan_snapshot=excluded.plan_snapshot
    where public.budget_periods.status<>'locked' and public.budget_periods.ends_on=excluded.ends_on
      and (public.budget_periods.plan_snapshot-'captured_at') is distinct from (excluded.plan_snapshot-'captured_at');
  insert into public.period_allowances select household_id,user_id,p_month,monthly_allowance_minor from public.members where household_id=p_household_id
    on conflict do nothing;
end;
$$;
create function public.capture_money_plan() returns trigger language plpgsql security definer set search_path='' as $$
declare h uuid; captured_month date;
begin
  if TG_TABLE_NAME='households' then
    if OLD.split_mode is not distinct from NEW.split_mode then return NEW; end if;
    h:=NEW.id;
  else h:=coalesce(NEW.household_id,OLD.household_id); end if;
  select date_trunc('month',now() at time zone timezone)::date into captured_month from public.households where id=h;
  perform public.ensure_money_period(h,captured_month);
  if TG_TABLE_NAME='members' and TG_OP='UPDATE' then
    if OLD.monthly_allowance_minor is distinct from NEW.monthly_allowance_minor then
      update public.period_allowances set amount_minor=NEW.monthly_allowance_minor where household_id=h and user_id=NEW.user_id and period_allowances.month_on=captured_month
        and not exists(select 1 from public.budget_periods where household_id=h and starts_on=captured_month and status='locked');
    end if;
  end if;
  return coalesce(NEW,OLD);
end;
$$;
create trigger money_plan_cost after insert or update or delete on public.budget_costs for each row execute function public.capture_money_plan();
create trigger money_plan_link after insert or update or delete on public.cashflow_budget_links for each row execute function public.capture_money_plan();
create trigger money_plan_member after insert or update or delete on public.members for each row execute function public.capture_money_plan();
create trigger money_plan_split after update of split_mode on public.households for each row execute function public.capture_money_plan();
do $$ declare h record; begin for h in select id,date_trunc('month',now() at time zone timezone)::date month_on from public.households loop
 perform public.ensure_money_period(h.id,h.month_on);end loop;end $$;

-- Stable canonical review hashes. Array order is presentation, not a new review.
create function public.money_date_canonical(p_value jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare result jsonb;
begin
 if jsonb_typeof(p_value)='array' then
  select coalesce(jsonb_agg(v order by v::text),'[]'::jsonb) into result from(select public.money_date_canonical(value) v from jsonb_array_elements(p_value)) s;
 elsif jsonb_typeof(p_value)='object' then
  select coalesce(jsonb_object_agg(key,public.money_date_canonical(value)),'{}'::jsonb) into result from jsonb_each(p_value);
 else result:=p_value;end if;return result;
end;
$$;

-- One comparison contract for opening and refreshing a closing observation.
create function public.money_date_anchor(p_household_id uuid,p_end date) returns table(on_date date,amount_minor bigint)
language sql stable security definer set search_path='' as $$
 select a.on_date,a.amount_minor from (
   select as_of_on on_date,amount_minor,1 priority,now() created_at from public.cashflow_balances where household_id=p_household_id and as_of_on<p_end
   union all select as_of_on,actual_minor,0,created_at from public.balance_checkins where household_id=p_household_id and status='resolved' and as_of_on<p_end
 ) a order by on_date desc,priority desc,created_at desc limit 1;
$$;
create function public.get_money_date(p_household_id uuid,p_month date default null) returns jsonb
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

alter table public.goal_contributions add column money_date_period_id uuid;
alter table public.goal_contributions add foreign key(household_id,money_date_period_id) references public.budget_periods(household_id,id) deferrable initially deferred;
alter table public.goal_contributions add unique(goal_id,money_date_period_id);
alter table public.goal_contributions drop constraint goal_contributions_check;
alter table public.goal_contributions add constraint goal_contribution_direction check(
 (money_date_period_id is null and ((amount_minor<0)=(reverses_id is not null))) or
 (money_date_period_id is not null and source='variance' and amount_minor<0 and reverses_id is null));

create function public.apply_money_date(p_household_id uuid,p_actor_id uuid,p_request_id uuid,p_month date,p_token text,p_action text,p_values jsonb)
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

-- Serialize private writes with closing WITHOUT publishing private activity.
create function public.guard_closed_money() returns trigger language plpgsql security definer set search_path='' as $$
declare old_row jsonb:=case when TG_OP<>'INSERT' then to_jsonb(OLD) end;new_row jsonb:=case when TG_OP<>'DELETE' then to_jsonb(NEW) end;
 h uuid; old_on date; new_on date;
begin
 if TG_TABLE_NAME in ('shared_transactions','private_transactions') then
  if TG_OP='UPDATE' and (old_row->'household_id',old_row->'owner_id',old_row->'paid_by',old_row->'created_by',old_row->'amount_minor',old_row->'occurred_on',old_row->'original_currency',old_row->'original_amount_minor',old_row->'fx_rate')
    is not distinct from (new_row->'household_id',new_row->'owner_id',new_row->'paid_by',new_row->'created_by',new_row->'amount_minor',new_row->'occurred_on',new_row->'original_currency',new_row->'original_amount_minor',new_row->'fx_rate') then return NEW;end if;
  old_on:=(old_row->>'occurred_on')::date;new_on:=(new_row->>'occurred_on')::date;
 elsif TG_TABLE_NAME='income_occurrences' then
  if (case when (old_row->>'shared_received')::boolean and (old_row->>'shared_amount_minor')::bigint>0 then jsonb_build_array(old_row->'shared_on',old_row->'shared_amount_minor',old_row->'household_id') end)
    is not distinct from (case when (new_row->>'shared_received')::boolean and (new_row->>'shared_amount_minor')::bigint>0 then jsonb_build_array(new_row->'shared_on',new_row->'shared_amount_minor',new_row->'household_id') end) then return coalesce(NEW,OLD);end if;
  if (old_row->>'shared_received')::boolean then old_on:=(old_row->>'shared_on')::date;end if;
  if (new_row->>'shared_received')::boolean then new_on:=(new_row->>'shared_on')::date;end if;
 elsif TG_TABLE_NAME='payment_records' then old_on:=(old_row->>'paid_on')::date;new_on:=(new_row->>'paid_on')::date;
 elsif TG_TABLE_NAME='cashflow_balances' then
  if TG_OP='UPDATE' and (old_row->'amount_minor',old_row->'as_of_on',old_row->'household_id') is not distinct from (new_row->'amount_minor',new_row->'as_of_on',new_row->'household_id') then return NEW;end if;
  -- Advancing the live checkpoint never edits the historical snapshot.
  if TG_OP='UPDATE' and (new_row->>'as_of_on')::date>(old_row->>'as_of_on')::date then old_on:=null;else old_on:=(old_row->>'as_of_on')::date;end if;
  new_on:=(new_row->>'as_of_on')::date;
 else old_on:=(old_row->>'occurred_on')::date;new_on:=(new_row->>'occurred_on')::date;end if;
 for h in select distinct v::uuid from unnest(array[old_row->>'household_id',new_row->>'household_id']) v where v is not null order by 1 loop
  perform 1 from public.households where id=h for update;
  -- Parent cascades are allowed; clients cannot delete households.
  if found and exists(select 1 from public.budget_periods where household_id=h and status='locked' and ((old_on>=starts_on and old_on<ends_on) or (new_on>=starts_on and new_on<ends_on))) then
   raise exception 'Budget period locked' using errcode='22023';end if;
 end loop;
 if TG_TABLE_NAME='goal_contributions' and TG_OP='INSERT' then
  if NEW.amount_minor<0 and (select coalesce(sum(amount_minor),0) from public.goal_contributions where goal_id=NEW.goal_id)+NEW.amount_minor<0 then
   raise exception 'Goal balance below correction';end if;
 end if;
 return coalesce(NEW,OLD);
end;
$$;
create trigger closed_shared before insert or update or delete on public.shared_transactions for each row execute function public.guard_closed_money();
create trigger closed_private before insert or update or delete on public.private_transactions for each row execute function public.guard_closed_money();
create trigger closed_income before insert or update or delete on public.income_occurrences for each row execute function public.guard_closed_money();
create trigger closed_goal before insert or update or delete on public.goal_contributions for each row execute function public.guard_closed_money();
create trigger closed_payment before insert or update or delete on public.payment_records for each row execute function public.guard_closed_money();
create trigger closed_balance before insert or update or delete on public.cashflow_balances for each row execute function public.guard_closed_money();

-- Drawdowns reduce held savings but never subtract from a partner's fair-share credit.
create or replace function public.prepare_goal_month(p_household_id uuid,p_id uuid,p_force boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare g public.goals; today date; month_start date; months integer; saved numeric; contributed numeric;
  quota bigint; ready boolean; mode public.split_mode; shares jsonb;
begin
  select * into g from public.goals where id=p_id and household_id=p_household_id;
  select (now() at time zone timezone)::date,split_mode into today,mode from public.households where id=p_household_id;
  mode:=public.effective_split_mode(p_household_id,today);
  month_start:=date_trunc('month',today)::date;
  if not p_force and exists(select 1 from public.goal_months m where m.goal_id=g.id and m.month_on=month_start) then return; end if;
  select coalesce(sum(amount_minor),0),coalesce(sum(amount_minor) filter(where source<>'variance' and occurred_on>=month_start and occurred_on<month_start+interval '1 month'),0)
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


-- Drawdowns reduce held savings but never subtract from a partner's fair-share credit.
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
        (select coalesce(sum(amount_minor),0) from public.goal_contributions where goal_id=g.id and source<>'variance' and contributor_id=(s->>'user_id')::uuid and occurred_on>=first_on and occurred_on<first_on+interval '1 month')))
        from jsonb_array_elements(m.shares) s),'[]'::jsonb)) from public.goal_months m where m.goal_id=g.id and m.month_on=first_on),
      'series',coalesce((select jsonb_agg(to_jsonb(x) order by month_on) from (select date_trunc('month',occurred_on)::date month_on,sum(amount_minor)::bigint amount_minor
        from public.goal_contributions where goal_id=g.id and occurred_on>=(first_on-interval '5 months')::date group by 1) x),'[]'::jsonb))
      order by g.archived,g.created_at,g.id) from public.goals g where g.household_id=p_household_id),'[]'::jsonb));
end;
$$;


-- Drawdowns reduce held savings but never subtract from a partner's fair-share credit.
create or replace function public.get_cashflow(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare base jsonb; today date; first_on date; g public.goals; m public.goal_months;
  held numeric:=0; saved numeric; paid numeric; remaining numeric; quota bigint; due date;
  months integer; offset_month integer; month_on date; plans jsonb:='[]'::jsonb; used jsonb;
begin
  base:=public.get_cashflow_before_goals(p_household_id);today:=(base->>'today')::date;first_on:=date_trunc('month',today)::date;
  for g in select * from public.goals where household_id=p_household_id loop
    perform public.prepare_goal_month(p_household_id,g.id);
    select coalesce(sum(amount_minor),0),coalesce(sum(amount_minor) filter(where source<>'variance' and occurred_on>=first_on and occurred_on<first_on+interval '1 month'),0)
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
    from public.goal_contributions c join public.goals goal_row on goal_row.id=c.goal_id where goal_row.household_id=p_household_id and c.source<>'variance' and c.occurred_on>=first_on and c.occurred_on<first_on+interval '1 month'
    group by goal_row.category_id) x;
  return base||jsonb_build_object('savings',jsonb_build_object('reserved_minor',held,'month_allocations',used,'plans',plans));
end;
$$;


create or replace function public.allowance_balances(p_household_id uuid)
returns table(user_id uuid,display_name text,allowance_minor bigint,spent_minor bigint,remaining_minor bigint)
language sql stable security definer set search_path='' as $$
  with month as (select date_trunc('month',now() at time zone h.timezone)::date starts_on,
    (date_trunc('month',now() at time zone h.timezone)+interval '1 month')::date ends_on
    from public.households h where id=p_household_id),
  totals as (select m.user_id,m.display_name,coalesce((select a.amount_minor from public.period_allowances a cross join month where a.household_id=m.household_id and a.user_id=m.user_id and a.month_on=month.starts_on),m.monthly_allowance_minor) monthly_allowance_minor,m.joined_at,
    coalesce((select sum(p.amount_minor) from public.private_transactions p cross join month
      where p.household_id=m.household_id and p.owner_id=m.user_id and p.occurred_on>=month.starts_on and p.occurred_on<month.ends_on),0)
    + coalesce((select sum(s.amount_minor) from public.balance_checkin_shares s join public.balance_checkins c on c.id=s.checkin_id cross join month
      where s.household_id=m.household_id and s.user_id=m.user_id and c.status='resolved' and c.resolution='allowance' and s.approved_at is not null
        and c.as_of_on>=month.starts_on and c.as_of_on<month.ends_on),0) spent
    from public.members m where m.household_id=p_household_id and public.is_household_member(p_household_id))
  select user_id,display_name,monthly_allowance_minor,spent::bigint,(monthly_allowance_minor-spent)::bigint from totals order by joined_at;
$$;


-- Remap open plan categories during archive; locked snapshots keep their labels.
alter function public.archive_category(uuid,integer,uuid) rename to archive_category_before_money_date;
revoke execute on function public.archive_category_before_money_date(uuid,integer,uuid) from public,anon,authenticated;
create function public.archive_category(p_id uuid,p_version integer,p_replacement_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.archive_category_before_money_date(p_id,p_version,p_replacement_id);
 update public.budget_periods p set plan_snapshot=jsonb_set(plan_snapshot,'{costs}',
   (select jsonb_agg(case when c->>'category_id'=p_id::text then c||jsonb_build_object('category_id',p_replacement_id,'category_name',(select name from public.categories where id=p_replacement_id)) else c end)
    from jsonb_array_elements(plan_snapshot->'costs') c))
 where p.status<>'locked' and p.plan_snapshot is not null and exists(select 1 from public.categories where id=p_id and household_id=p.household_id)
   and exists(select 1 from jsonb_array_elements(plan_snapshot->'costs') c where c->>'category_id'=p_id::text);
end;
$$;
alter table public.guide_progress drop constraint guide_progress_check;
alter table public.guide_progress add constraint guide_progress_check check(case guide_id
 when 'welcome' then step_id in ('spaces','connect') when 'first-visit' then step_id in ('home','shared','private','log')
 when 'quick-log' then step_id in ('space','save') when 'payments' then step_id in ('list','create')
 when 'cashflow' then step_id in ('forecast','calendar') when 'categories' then step_id in ('spaces','create')
 when 'budget-categories' then step_id in ('plan','assign') when 'private-allowance' then step_id in ('balance','privacy')
 when 'reconciliation' then step_id in ('compare','check') when 'goals' then step_id in ('overview','create')
 when 'money-date' then step_id in ('review','close') else false end);
revoke execute on function public.effective_split_mode(uuid,date),public.ensure_money_period(uuid,date),public.capture_money_plan(),public.money_date_canonical(jsonb),public.guard_closed_money() from public,anon,authenticated;
revoke execute on function public.get_month_split(uuid),public.get_money_date(uuid,date),public.apply_money_date(uuid,uuid,uuid,date,text,text,jsonb),public.archive_category(uuid,integer,uuid) from public,anon;
grant execute on function public.get_month_split(uuid),public.get_money_date(uuid,date),public.apply_money_date(uuid,uuid,uuid,date,text,text,jsonb),public.archive_category(uuid,integer,uuid) to authenticated;

-- The editor keeps the permanent agreement separate from a calendar override.
alter function public.get_budget_setup(uuid) rename to get_budget_setup_before_money_date;
revoke execute on function public.get_budget_setup_before_money_date(uuid) from public,anon,authenticated;
create function public.get_budget_setup(p_household_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare today date;begin
 if not public.is_household_member(p_household_id) then return null;end if;
 today:=public.lock_cashflow(p_household_id);perform public.ensure_money_period(p_household_id,date_trunc('month',today)::date);
 return public.get_budget_setup_before_money_date(p_household_id)||jsonb_build_object('month_split',public.get_month_split(p_household_id));
end;$$;
revoke execute on function public.get_budget_setup(uuid) from public,anon;
grant execute on function public.get_budget_setup(uuid) to authenticated;

revoke execute on function public.money_date_anchor(uuid,date) from public,anon,authenticated;

-- Reconciliation's editable suggested split follows the check's own month.
alter function public.get_reconciliation(uuid,date) rename to get_reconciliation_before_money_date;
revoke execute on function public.get_reconciliation_before_money_date(uuid,date) from public,anon,authenticated;
create function public.get_reconciliation(p_household_id uuid,p_on date default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb;on_date date;begin
 result:=public.get_reconciliation_before_money_date(p_household_id,p_on);
 on_date:=coalesce((result->'pending'->>'as_of_on')::date,p_on,(result->>'today')::date);
 return result||jsonb_build_object('effective_split',public.effective_split_mode(p_household_id,on_date));
end;$$;
revoke execute on function public.get_reconciliation(uuid,date) from public,anon;
grant execute on function public.get_reconciliation(uuid,date) to authenticated;
