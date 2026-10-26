-- Budget setup is resumable per person. Shared edits use a revision so a stale
-- device cannot silently overwrite the other partner's work.
alter table public.households add column budget_revision integer not null default 0;
alter table public.members
  add column budget_setup_step smallint not null default 0 check (budget_setup_step between 0 and 4),
  add column budget_completed_at timestamptz,
  add constraint budget_income_limit check (monthly_income_minor <= 1000000000000),
  add constraint budget_allowance_limit check (monthly_allowance_minor <= 1000000000000);

-- Planned monthly costs, not transactions or scheduled payments. Step 3 of Phase 1
-- will add actual payment schedules without duplicating these budget allocations.
create table public.budget_costs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
  sort_order smallint not null check (sort_order between 0 and 49)
);
create index budget_costs_household on public.budget_costs(household_id);

-- A partner sees the monthly aggregate on members, never employer/source names,
-- individual income amounts or precise payday details.
create table public.income_sources (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  owner_id uuid not null default auth.uid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  cadence text not null check (cadence in ('monthly', 'weekly', 'biweekly', 'irregular')),
  amount_minor bigint check (amount_minor between 0 and 1000000000000),
  next_payday date,
  sort_order smallint not null check (sort_order between 0 and 9),
  foreign key (household_id, owner_id) references public.members(household_id, user_id) on delete cascade,
  check (cadence = 'irregular' or (next_payday is not null and amount_minor is not null))
);
create index income_sources_owner on public.income_sources(household_id, owner_id);

alter table public.budget_costs enable row level security;
alter table public.income_sources enable row level security;
create policy "partners read planned shared costs" on public.budget_costs
  for select to authenticated using (public.is_household_member(household_id));
create policy "owner reads payday sources" on public.income_sources
  for select to authenticated
  using (owner_id = (select auth.uid()) and public.is_household_member(household_id));

-- Writes go through narrow, validated, atomic RPCs. No client may claim someone
-- else's progress or write payday sources on their behalf.
revoke all on public.budget_costs, public.income_sources from public, anon, authenticated;
grant select on public.budget_costs, public.income_sources to authenticated;

-- One MVCC snapshot binds the revision to the actual draft shown on screen.
-- Separate HTTP reads could otherwise pair a new revision with old cost rows.
create function public.get_budget_setup(p_household_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'household', to_jsonb(h),
    'members', (select jsonb_agg(m order by m.joined_at, m.user_id) from public.members m where m.household_id = h.id),
    'costs', coalesce((select jsonb_agg(c order by c.sort_order) from public.budget_costs c where c.household_id = h.id), '[]'::jsonb),
    'sources', coalesce((select jsonb_agg(s order by s.sort_order) from public.income_sources s
      where s.household_id = h.id and s.owner_id = auth.uid()), '[]'::jsonb)
  ) from public.households h where h.id = p_household_id;
$$;
revoke execute on function public.get_budget_setup(uuid) from public, anon;
grant execute on function public.get_budget_setup(uuid) to authenticated;

-- Include changes from older clients and a partner joining/leaving in conflicts.
create function public.bump_member_budget_revision()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op <> 'UPDATE' then
    update public.households set budget_revision = budget_revision + 1
      where id = case when tg_op = 'DELETE' then old.household_id else new.household_id end;
  elsif new.monthly_income_minor is distinct from old.monthly_income_minor
     or new.monthly_allowance_minor is distinct from old.monthly_allowance_minor then
    update public.households set budget_revision = budget_revision + 1 where id = new.household_id;
  end if;
  return null;
end;
$$;
create trigger member_budget_revision after insert or delete or update on public.members
  for each row execute function public.bump_member_budget_revision();

create function public.bump_split_budget_revision()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.split_mode is distinct from old.split_mode then
    new.budget_revision := greatest(new.budget_revision, old.budget_revision + 1);
  end if;
  return new;
end;
$$;
create trigger split_budget_revision before update on public.households
  for each row execute function public.bump_split_budget_revision();

create function public.lock_budget_setup(p_household_id uuid, p_revision integer)
returns void language plpgsql security definer set search_path = '' as $$
declare current_revision integer;
begin
  if auth.uid() is null or not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;
  select budget_revision into current_revision from public.households where id = p_household_id for update;
  if p_revision is null or current_revision is distinct from p_revision then
    raise exception 'Budget plan changed' using errcode = '40001';
  end if;
end;
$$;

create function public.save_budget_income(
  p_household_id uuid, p_revision integer, p_income_minor bigint, p_split_mode public.split_mode
) returns integer language plpgsql security definer set search_path = '' as $$
declare revision integer;
begin
  perform public.lock_budget_setup(p_household_id, p_revision);
  if p_income_minor is null or p_income_minor < 0 or p_income_minor > 1000000000000 or p_split_mode is null then
    raise exception 'Invalid budget input' using errcode = '22023';
  end if;
  update public.members set monthly_income_minor = p_income_minor,
    budget_setup_step = greatest(budget_setup_step, 1)
    where household_id = p_household_id and user_id = auth.uid();
  update public.households set split_mode = p_split_mode, budget_revision = budget_revision + 1
    where id = p_household_id returning budget_revision into revision;
  return revision;
end;
$$;

create function public.save_budget_allowances(p_household_id uuid, p_revision integer, p_allowances jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare revision integer; item jsonb; seen uuid[] := '{}'; member_id uuid; amount bigint;
begin
  perform public.lock_budget_setup(p_household_id, p_revision);
  if not exists (select 1 from public.members where household_id = p_household_id
    and user_id = auth.uid() and budget_setup_step >= 1) then
    raise exception 'Complete the earlier budget steps' using errcode = '22023';
  end if;
  if jsonb_typeof(p_allowances) is distinct from 'array' then
    raise exception 'Invalid budget input' using errcode = '22023';
  end if;
  if jsonb_array_length(p_allowances) <> (select count(*) from public.members where household_id = p_household_id) then
    raise exception 'Budget plan changed' using errcode = '40001';
  end if;
  for item in select value from jsonb_array_elements(p_allowances) loop
    if jsonb_typeof(item->'amountMinor') is distinct from 'number'
       or (item->>'amountMinor') !~ '^[0-9]+$' then
      raise exception 'Invalid budget input' using errcode = '22023';
    end if;
    member_id := (item->>'userId')::uuid;
    amount := (item->>'amountMinor')::bigint;
    if member_id is null or member_id = any(seen) or amount > 1000000000000 or not exists
      (select 1 from public.members where household_id = p_household_id and user_id = member_id) then
      raise exception 'Invalid budget input' using errcode = '22023';
    end if;
    seen := array_append(seen, member_id);
    -- Allowances are a shared agreement; income remains self-editable only.
    update public.members set monthly_allowance_minor = amount
      where household_id = p_household_id and user_id = member_id;
  end loop;
  update public.members set budget_setup_step = greatest(budget_setup_step, 2)
    where household_id = p_household_id and user_id = auth.uid();
  update public.households set budget_revision = budget_revision + 1 where id = p_household_id
    returning budget_revision into revision;
  return revision;
end;
$$;

create function public.save_budget_costs(p_household_id uuid, p_revision integer, p_costs jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare revision integer; item jsonb; position integer := 0; amount bigint; total bigint := 0;
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
  delete from public.budget_costs where household_id = p_household_id;
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
    insert into public.budget_costs(household_id, name, amount_minor, sort_order)
      values (p_household_id, trim(item->>'name'), amount, position);
    position := position + 1;
  end loop;
  update public.members set budget_setup_step = greatest(budget_setup_step, 3)
    where household_id = p_household_id and user_id = auth.uid();
  update public.households set budget_revision = budget_revision + 1 where id = p_household_id
    returning budget_revision into revision;
  return revision;
end;
$$;

create function public.save_budget_paydays(p_household_id uuid, p_revision integer, p_sources jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare revision integer; item jsonb; position integer := 0; total bigint := 0; amount bigint;
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
  delete from public.income_sources where household_id = p_household_id and owner_id = auth.uid();
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
    insert into public.income_sources(household_id, owner_id, name, cadence, amount_minor, next_payday, sort_order)
      values (p_household_id, auth.uid(), trim(item->>'name'), item->>'cadence', amount,
        (item->>'nextPayday')::date, position);
    position := position + 1;
  end loop;
  update public.members set budget_setup_step = 4, budget_completed_at = now()
    where household_id = p_household_id and user_id = auth.uid();
  update public.households set budget_revision = budget_revision + 1 where id = p_household_id
    returning budget_revision into revision;
  return revision;
end;
$$;

revoke execute on function public.bump_member_budget_revision(), public.bump_split_budget_revision(), public.lock_budget_setup(uuid, integer)
  from public, anon, authenticated;
revoke execute on function
  public.save_budget_income(uuid, integer, bigint, public.split_mode),
  public.save_budget_allowances(uuid, integer, jsonb),
  public.save_budget_costs(uuid, integer, jsonb),
  public.save_budget_paydays(uuid, integer, jsonb)
  from public, anon;
grant execute on function
  public.save_budget_income(uuid, integer, bigint, public.split_mode),
  public.save_budget_allowances(uuid, integer, jsonb),
  public.save_budget_costs(uuid, integer, jsonb),
  public.save_budget_paydays(uuid, integer, jsonb)
  to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.budget_costs, public.income_sources;
  end if;
end $$;
