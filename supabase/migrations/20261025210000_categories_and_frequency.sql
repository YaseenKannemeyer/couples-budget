-- Shared category metadata is visible to both partners. Private custom labels
-- are owner-only, including through payment workspace RPCs and FK validation.
alter table public.categories
  add column visibility text not null default 'shared' check (visibility in ('shared', 'private')),
  add column owner_id uuid,
  add column version integer not null default 1,
  add column starter_key text,
  add foreign key (household_id, owner_id) references public.members(household_id, user_id),
  add check ((visibility = 'shared' and owner_id is null) or (visibility = 'private' and owner_id is not null)),
  add check (emoji is null or char_length(emoji) <= 16),
  alter column sort_order type integer;
create unique index categories_starter_key on public.categories(household_id, starter_key)
  where starter_key is not null;

drop policy "members manage categories" on public.categories;
create policy "partners read shared labels and owners read private labels" on public.categories
  for select to authenticated using (public.is_household_member(household_id)
    and (visibility = 'shared' or owner_id = (select auth.uid())));
revoke insert, update, delete on public.categories from authenticated;

create function public.seed_household_categories(p_household_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare preset record; existing_id uuid;
begin
  for preset in select * from (values
    ('essentials', 'Essentials', '🛒', 'needs', 1),
    ('entertainment', 'Entertainment', '🎬', 'wants', 2),
    ('housing', 'Housing', '🏡', 'needs', 3),
    ('transport', 'Transport', '🚗', 'needs', 4),
    ('utilities', 'Utilities', '💡', 'needs', 5),
    ('health', 'Health', '🩺', 'needs', 6),
    ('personal', 'Personal', '🧴', 'wants', 7),
    ('fun', 'Fun', '🎟️', 'wants', 8),
    ('savings', 'Savings', '🌱', 'savings', 9),
    ('other', 'Other', '📦', 'needs', 10)
  ) as defaults(key, name, emoji, bucket, position) loop
    if exists (select 1 from public.categories where household_id = p_household_id and starter_key = preset.key) then
      continue;
    end if;
    select id into existing_id from public.categories where household_id = p_household_id and visibility = 'shared'
      and starter_key is null and lower(trim(name)) = lower(preset.name) order by sort_order, id limit 1;
    if existing_id is not null then
      -- Preserve existing IDs, names, buckets and archive decisions.
      update public.categories set starter_key = preset.key where id = existing_id;
    else
      insert into public.categories(household_id, name, emoji, bucket, sort_order, starter_key)
      values (p_household_id, preset.name, preset.emoji, preset.bucket::public.category_bucket, preset.position, preset.key);
    end if;
  end loop;
end;
$$;
revoke execute on function public.seed_household_categories(uuid) from public, anon, authenticated;

do $$ declare household record;
begin
  for household in select id from public.households loop
    perform public.seed_household_categories(household.id);
  end loop;
end $$;
with ordered as (
  select id, row_number() over (partition by household_id, visibility, owner_id order by sort_order, name, id) as position
  from public.categories
) update public.categories c set sort_order = ordered.position from ordered where c.id = ordered.id;

create or replace function public.create_household(p_name text, p_base_currency text, p_timezone text, p_display_name text)
returns public.households language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); household public.households;
begin
  if me is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  if exists (select 1 from public.members where user_id = me) then
    raise exception 'You are already part of a household' using errcode = '23505';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone: %', p_timezone using errcode = '22023';
  end if;
  insert into public.households(name, base_currency, timezone)
    values (trim(p_name), upper(p_base_currency), p_timezone) returning * into household;
  insert into public.members(household_id, user_id, display_name) values (household.id, me, trim(p_display_name));
  perform public.seed_household_categories(household.id);
  return household;
end;
$$;

alter table public.shared_transactions
  add column frequency text not null default 'one_time' check (frequency in ('one_time', 'monthly')),
  add column scheduled_payment_ref uuid,
  add column version integer not null default 1;
alter table public.private_transactions
  add column frequency text not null default 'one_time' check (frequency in ('one_time', 'monthly')),
  add column scheduled_payment_ref uuid,
  add column version integer not null default 1;
grant update (frequency) on public.shared_transactions, public.private_transactions to authenticated;

-- Repair old uncategorized rows without changing existing valid category choices.
update public.shared_transactions t set category_id = c.id from public.categories c
  where t.category_id is null and c.household_id = t.household_id and c.starter_key = 'other';
update public.private_transactions t set category_id = c.id from public.categories c
  where t.category_id is null and c.household_id = t.household_id and c.starter_key = 'other';
alter table public.shared_transactions alter column category_id set not null;
alter table public.private_transactions alter column category_id set not null;
update public.shared_transactions t set frequency = r.recurrence, scheduled_payment_ref = r.schedule_ref
  from public.payment_records r where r.shared_transaction_id = t.id;
update public.private_transactions t set frequency = r.recurrence, scheduled_payment_ref = r.schedule_ref
  from public.payment_records r where r.private_transaction_id = t.id;

create function public.validate_expense_category(p_household_id uuid, p_category_id uuid, p_visibility text, p_owner uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare category public.categories;
begin
  select * into category from public.categories where household_id = p_household_id and id = p_category_id for key share;
  if category.id is null or category.archived
    or (p_visibility = 'shared' and category.visibility <> 'shared')
    or (p_visibility = 'private' and category.visibility = 'private' and category.owner_id <> p_owner) then
    raise exception 'Category unavailable' using errcode = '22023';
  end if;
end;
$$;

create function public.validate_transaction_classification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare space text; owner uuid; s public.scheduled_payments;
begin
  if tg_table_name = 'shared_transactions' then space := 'shared'; owner := null;
  else space := 'private'; owner := new.owner_id; end if;
  if tg_op = 'UPDATE' then
    if old.scheduled_payment_ref is not null and (new.scheduled_payment_ref is distinct from old.scheduled_payment_ref
      or new.frequency is distinct from old.frequency) then
      raise exception 'Linked frequency is fixed' using errcode = '22023';
    end if;
  end if;
  if new.category_id is null then
    select id into new.category_id from public.categories where household_id = new.household_id
      and visibility = 'shared' and not archived order by (starter_key = 'other') desc nulls last, sort_order, id limit 1;
  end if;
  if tg_op = 'INSERT' then
    perform public.validate_expense_category(new.household_id, new.category_id, space, owner);
  elsif new.category_id is distinct from old.category_id or new.household_id is distinct from old.household_id then
    perform public.validate_expense_category(new.household_id, new.category_id, space, owner);
  end if;
  if new.scheduled_payment_ref is not null then
    if tg_op = 'INSERT' then
      select * into s from public.scheduled_payments where id = new.scheduled_payment_ref;
    elsif new.scheduled_payment_ref is distinct from old.scheduled_payment_ref or new.frequency is distinct from old.frequency then
      select * into s from public.scheduled_payments where id = new.scheduled_payment_ref;
    else
      -- A historical link survives deleting its schedule; it isn't revalidated on category edits.
      new.version := old.version + 1;
      return new;
    end if;
    if s.id is null or s.household_id <> new.household_id or s.visibility <> space
      or (space = 'private' and s.owner_id <> owner) then
      raise exception 'Payment not available' using errcode = '42501';
    end if;
    new.frequency := s.recurrence;
  end if;
  if tg_op = 'UPDATE' then new.version := old.version + 1; end if;
  return new;
end;
$$;
create trigger shared_transaction_classification before insert or update on public.shared_transactions
  for each row execute function public.validate_transaction_classification();
create trigger private_transaction_classification before insert or update on public.private_transactions
  for each row execute function public.validate_transaction_classification();

create function public.validate_schedule_category()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.validate_expense_category(new.household_id, new.category_id, new.visibility, new.owner_id);
  elsif new.category_id is distinct from old.category_id then
    perform public.validate_expense_category(new.household_id, new.category_id, new.visibility, new.owner_id);
  end if;
  return new;
end;
$$;
create trigger schedule_category_privacy before insert or update on public.scheduled_payments
  for each row execute function public.validate_schedule_category();

create function public.lock_category(p_id uuid, p_version integer)
returns public.categories language plpgsql security definer set search_path = '' as $$
declare c public.categories;
begin
  select * into c from public.categories where id = p_id;
  if c.id is null or not public.is_household_member(c.household_id)
    or (c.visibility = 'private' and c.owner_id <> auth.uid()) then
    raise exception 'Category unavailable' using errcode = '42501';
  end if;
  -- Category writes in a household serialize, including create/reorder/archive.
  perform 1 from public.households where id = c.household_id for update;
  select * into c from public.categories where id = p_id for update;
  if p_version is null or c.version <> p_version then
    raise exception 'Category changed' using errcode = '40001';
  end if;
  return c;
end;
$$;

create function public.save_category(p_household_id uuid, p_id uuid, p_version integer, p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare c public.categories; result uuid; space text; v_bucket public.category_bucket; position integer;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Category unavailable' using errcode = '42501';
  end if;
  perform 1 from public.households where id = p_household_id for update;
  if p_id is not null then
    c := public.lock_category(p_id, p_version);
    if c.household_id <> p_household_id then raise exception 'Category unavailable' using errcode = '42501'; end if;
  end if;
  if jsonb_typeof(p_values) is distinct from 'object'
    or jsonb_typeof(p_values->'name') is distinct from 'string' or char_length(trim(p_values->>'name')) not between 1 and 40
    or coalesce(p_values->>'visibility', '') not in ('shared', 'private')
    or coalesce(p_values->>'bucket', '') not in ('needs', 'wants', 'savings')
    or (p_values->>'emoji' is not null and (jsonb_typeof(p_values->'emoji') <> 'string' or char_length(p_values->>'emoji') > 16)) then
    raise exception 'Invalid category input' using errcode = '22023';
  end if;
  space := p_values->>'visibility'; v_bucket := (p_values->>'bucket')::public.category_bucket;
  if p_id is null then
    select coalesce(max(sort_order), 0) + 1 into position from public.categories where household_id = p_household_id
      and visibility = space and (space = 'shared' or owner_id = auth.uid());
    insert into public.categories(household_id, name, emoji, bucket, sort_order, visibility, owner_id)
      values (p_household_id, trim(p_values->>'name'), nullif(trim(p_values->>'emoji'), ''), v_bucket, position,
        space, case when space = 'private' then auth.uid() else null end) returning id into result;
  else
    if c.visibility <> space then raise exception 'Category visibility is fixed' using errcode = '22023'; end if;
    update public.categories set name = trim(p_values->>'name'), emoji = nullif(trim(p_values->>'emoji'), ''),
      bucket = v_bucket, version = version + 1 where id = p_id returning id into result;
  end if;
  return result;
end;
$$;

create function public.move_category(p_id uuid, p_version integer, p_direction integer)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.categories; ids uuid[]; position integer; neighbor uuid; neighbor_order integer;
begin
  c := public.lock_category(p_id, p_version);
  if c.archived or p_direction is null or p_direction not in (-1, 1) then
    raise exception 'Invalid category input' using errcode = '22023';
  end if;
  select array_agg(id order by sort_order, id) into ids from public.categories where household_id = c.household_id
    and not archived and visibility = c.visibility and owner_id is not distinct from c.owner_id;
  position := array_position(ids, c.id);
  neighbor := ids[position + p_direction];
  if neighbor is null then return; end if;
  select sort_order into neighbor_order from public.categories where id = neighbor for update;
  update public.categories set sort_order = neighbor_order, version = version + 1 where id = c.id;
  update public.categories set sort_order = c.sort_order, version = version + 1 where id = neighbor;
end;
$$;

create function public.archive_category(p_id uuid, p_version integer, p_replacement_id uuid)
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
  update public.categories set archived = true, version = version + 1 where id = c.id;
end;
$$;

create function public.restore_category(p_id uuid, p_version integer)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.categories;
begin
  c := public.lock_category(p_id, p_version);
  update public.categories set archived = false, version = version + 1 where id = c.id;
end;
$$;

create function public.classify_expense(p_household_id uuid, p_visibility text, p_id uuid, p_version integer,
  p_category_id uuid, p_frequency text)
returns void language plpgsql security definer set search_path = '' as $$
declare row_version integer; link uuid; existing_frequency text;
begin
  if not public.is_household_member(p_household_id) or p_visibility is null or p_visibility not in ('shared', 'private') then
    raise exception 'Expense unavailable' using errcode = '42501';
  end if;
  if p_visibility = 'shared' then
    select version, scheduled_payment_ref, frequency into row_version, link, existing_frequency
      from public.shared_transactions where household_id = p_household_id and id = p_id for update;
  else
    select version, scheduled_payment_ref, frequency into row_version, link, existing_frequency
      from public.private_transactions where household_id = p_household_id and id = p_id and owner_id = auth.uid() for update;
  end if;
  if row_version is null then raise exception 'Expense unavailable' using errcode = '42501'; end if;
  if p_version is null or row_version <> p_version then raise exception 'Expense changed' using errcode = '40001'; end if;
  if p_frequency is null or p_frequency not in ('one_time', 'monthly') then
    raise exception 'Invalid category input' using errcode = '22023';
  end if;
  if link is not null and p_frequency <> existing_frequency then
    raise exception 'Linked frequency is fixed' using errcode = '22023';
  end if;
  perform public.validate_expense_category(p_household_id, p_category_id, p_visibility, auth.uid());
  if p_visibility = 'shared' then
    update public.shared_transactions set category_id = p_category_id, frequency = p_frequency where id = p_id;
  else
    update public.private_transactions set category_id = p_category_id, frequency = p_frequency where id = p_id;
  end if;
end;
$$;

revoke execute on function public.validate_expense_category(uuid, uuid, text, uuid), public.validate_transaction_classification(),
  public.validate_schedule_category(), public.lock_category(uuid, integer) from public, anon, authenticated;
revoke execute on function public.save_category(uuid, uuid, integer, jsonb), public.move_category(uuid, integer, integer),
  public.archive_category(uuid, integer, uuid), public.restore_category(uuid, integer),
  public.classify_expense(uuid, text, uuid, integer, uuid, text) from public, anon;
grant execute on function public.save_category(uuid, uuid, integer, jsonb), public.move_category(uuid, integer, integer),
  public.archive_category(uuid, integer, uuid), public.restore_category(uuid, integer),
  public.classify_expense(uuid, text, uuid, integer, uuid, text) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.categories, public.private_transactions;
  end if;
end $$;

-- Preserve the schedule link and frequency when an actual expense is logged.
create or replace function public.mark_scheduled_payment_paid(
  p_id uuid, p_version integer, p_due_start date, p_amount_minor bigint,
  p_paid_on date, p_paid_by uuid, p_create_transaction boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare s public.scheduled_payments; record_id uuid; transaction_id uuid; category text; next_month date; cycle date;
begin
  s := public.lock_scheduled_payment(p_id, p_version);
  if s.status <> 'active' or p_due_start is null or p_due_start <> s.due_start then
    raise exception 'Payment changed' using errcode = '40001';
  end if;
  if p_amount_minor is null or p_amount_minor not between 1 and 1000000000000 or p_paid_on is null
    or p_paid_by is null or p_create_transaction is null
    or (s.visibility = 'private' and p_paid_by <> s.owner_id)
    or not exists (select 1 from public.members where household_id = s.household_id and user_id = p_paid_by) then
    raise exception 'Invalid payment input' using errcode = '22023';
  end if;
  select name into category from public.categories where id = s.category_id and household_id = s.household_id;
  cycle := case when s.recurrence = 'monthly' then date_trunc('month', s.due_start::timestamp)::date else s.due_start end;
  insert into public.payment_records(household_id, schedule_id, schedule_ref, owner_id, payer_id, recorded_by,
    visibility, name, category_name, note, recurrence, cycle_on, due_start, due_end, expected_amount_minor, amount_minor, paid_on)
  values (s.household_id, s.id, s.id, s.owner_id, p_paid_by, auth.uid(), s.visibility, s.name, category,
    s.note, s.recurrence, cycle, s.due_start, s.due_end, s.expected_amount_minor, p_amount_minor, p_paid_on)
  returning id into record_id;
  if p_create_transaction then
    if s.visibility = 'shared' then
      insert into public.shared_transactions(household_id, category_id, paid_by, created_by, amount_minor, description, note, occurred_on, frequency, scheduled_payment_ref)
      values (s.household_id, s.category_id, p_paid_by, auth.uid(), p_amount_minor, s.name, s.note, p_paid_on, s.recurrence, s.id) returning id into transaction_id;
      update public.payment_records set shared_transaction_id = transaction_id where id = record_id;
    else
      insert into public.private_transactions(household_id, owner_id, category_id, amount_minor, description, note, occurred_on, frequency, scheduled_payment_ref)
      values (s.household_id, s.owner_id, s.category_id, p_amount_minor, s.name, s.note, p_paid_on, s.recurrence, s.id) returning id into transaction_id;
      update public.payment_records set private_transaction_id = transaction_id where id = record_id;
    end if;
  end if;
  if s.recurrence = 'monthly' then
    next_month := (date_trunc('month', s.due_start::timestamp) + interval '1 month')::date;
    update public.scheduled_payments set due_start = public.payment_date_in_month(next_month, s.anchor_start_day),
      due_end = public.payment_date_in_month(next_month, s.anchor_end_day), version = version + 1, updated_at = now() where id = s.id;
  else
    update public.scheduled_payments set status = 'completed', version = version + 1, updated_at = now() where id = s.id;
  end if;
  return record_id;
end;
$$;

