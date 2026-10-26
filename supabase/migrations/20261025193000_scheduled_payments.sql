-- Bill schedules are plans. Payment records are immutable snapshots, and an
-- optional transaction is created atomically when a cycle is marked paid.
alter table public.private_transactions
  add column category_id uuid,
  add column note text check (char_length(note) <= 500),
  add foreign key (household_id, category_id) references public.categories(household_id, id);
grant update (category_id, note) on public.private_transactions to authenticated;
-- Categories are archived rather than deleted. A partner must not probe private
-- usage by trying to delete a category and observing foreign-key failures.
revoke delete on public.categories from authenticated;

create table public.scheduled_payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null default auth.uid(),
  payer_id uuid not null,
  visibility text not null check (visibility in ('shared', 'private')),
  name text not null check (char_length(trim(name)) between 1 and 80),
  expected_amount_minor bigint check (expected_amount_minor between 1 and 1000000000000),
  category_id uuid not null,
  note text check (char_length(note) <= 500),
  recurrence text not null check (recurrence in ('one_time', 'monthly')),
  date_mode text not null check (date_mode in ('exact', 'window')),
  due_start date not null,
  due_end date not null check (due_end >= due_start),
  -- Anchors survive February's clamping so March returns to the intended day.
  anchor_start_day smallint not null check (anchor_start_day between 1 and 31),
  anchor_end_day smallint not null check (anchor_end_day between 1 and 31),
  reminder_days_before smallint check (reminder_days_before between 0 and 30),
  status text not null default 'active' check (status in ('active', 'paused', 'archived', 'completed')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id, owner_id) references public.members(household_id, user_id),
  foreign key (household_id, payer_id) references public.members(household_id, user_id),
  foreign key (household_id, category_id) references public.categories(household_id, id),
  check (visibility = 'shared' or payer_id = owner_id),
  check (date_mode = 'window' or due_start = due_end),
  check (recurrence <> 'monthly' or date_trunc('month', due_start::timestamp) = date_trunc('month', due_end::timestamp))
);
create index scheduled_payments_upcoming on public.scheduled_payments(household_id, status, due_start);

create table public.payment_records (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  schedule_id uuid references public.scheduled_payments(id) on delete set null,
  schedule_ref uuid not null, -- stable identity after the schedule is deleted
  owner_id uuid not null references auth.users(id),
  payer_id uuid not null references auth.users(id),
  recorded_by uuid not null default auth.uid() references auth.users(id),
  visibility text not null check (visibility in ('shared', 'private')),
  name text not null,
  category_name text not null,
  note text,
  recurrence text not null check (recurrence in ('one_time', 'monthly')),
  cycle_on date not null,
  due_start date not null,
  due_end date not null,
  expected_amount_minor bigint,
  amount_minor bigint not null check (amount_minor between 1 and 1000000000000),
  paid_on date not null,
  shared_transaction_id uuid references public.shared_transactions(id) on delete set null,
  private_transaction_id uuid references public.private_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (schedule_ref, cycle_on),
  check (num_nonnulls(shared_transaction_id, private_transaction_id) <= 1),
  check (shared_transaction_id is null or visibility = 'shared'),
  check (private_transaction_id is null or visibility = 'private')
);
create index payment_records_history on public.payment_records(household_id, paid_on desc, id desc);
create index payment_records_schedule on public.payment_records(schedule_ref, cycle_on desc);

alter table public.scheduled_payments enable row level security;
alter table public.payment_records enable row level security;
create policy "partners read shared schedules and owners read private schedules" on public.scheduled_payments
  for select to authenticated using (public.is_household_member(household_id)
    and (visibility = 'shared' or owner_id = (select auth.uid())));
create policy "payment history keeps its original privacy" on public.payment_records
  for select to authenticated using (public.is_household_member(household_id)
    and (visibility = 'shared' or owner_id = (select auth.uid())));
revoke all on public.scheduled_payments, public.payment_records from public, anon, authenticated;
grant select on public.scheduled_payments, public.payment_records to authenticated;

create function public.payment_date_in_month(p_month date, p_day integer)
returns date language sql immutable set search_path = '' as $$
  select date_trunc('month', p_month::timestamp)::date +
    (least(p_day, extract(day from (date_trunc('month', p_month::timestamp) + interval '1 month - 1 day'))::integer) - 1);
$$;

create function public.lock_scheduled_payment(p_id uuid, p_version integer)
returns public.scheduled_payments language plpgsql security definer set search_path = '' as $$
declare s public.scheduled_payments;
begin
  select * into s from public.scheduled_payments where id = p_id for update;
  if s.id is null or auth.uid() is null or not public.is_household_member(s.household_id)
    or (s.visibility = 'private' and s.owner_id <> auth.uid()) then
    raise exception 'Payment not available' using errcode = '42501';
  end if;
  if p_version is null or s.version <> p_version then
    raise exception 'Payment changed' using errcode = '40001';
  end if;
  return s;
end;
$$;

create function public.save_scheduled_payment(p_household_id uuid, p_id uuid, p_version integer, p_values jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  s public.scheduled_payments; result uuid; visibility text; recurrence text; v_date_mode text;
  payer uuid; category uuid; amount bigint; start_date date; end_date date; reminder smallint;
begin
  if auth.uid() is null or not public.is_household_member(p_household_id) then
    raise exception 'Payment not available' using errcode = '42501';
  end if;
  if p_id is not null then
    s := public.lock_scheduled_payment(p_id, p_version);
    if s.household_id <> p_household_id then
      raise exception 'Payment not available' using errcode = '42501';
    end if;
  end if;
  if jsonb_typeof(p_values) is distinct from 'object'
    or jsonb_typeof(p_values->'name') is distinct from 'string'
    or char_length(trim(p_values->>'name')) not between 1 and 80
    or coalesce(p_values->>'visibility', '') not in ('shared', 'private')
    or coalesce(p_values->>'recurrence', '') not in ('one_time', 'monthly')
    or coalesce(p_values->>'dateMode', '') not in ('exact', 'window')
    or coalesce(p_values->>'dueStart', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or coalesce(p_values->>'dueEnd', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    or (p_values->>'note' is not null and char_length(p_values->>'note') > 500)
    or (p_values->>'note' is not null and jsonb_typeof(p_values->'note') <> 'string')
    or (p_values->>'expectedAmountMinor' is not null and
      (jsonb_typeof(p_values->'expectedAmountMinor') <> 'number' or (p_values->>'expectedAmountMinor') !~ '^[0-9]+$'))
    or (p_values->>'reminderDaysBefore' is not null and
      (jsonb_typeof(p_values->'reminderDaysBefore') <> 'number' or (p_values->>'reminderDaysBefore') !~ '^[0-9]+$')) then
    raise exception 'Invalid payment input' using errcode = '22023';
  end if;
  visibility := p_values->>'visibility';
  recurrence := p_values->>'recurrence';
  v_date_mode := p_values->>'dateMode';
  payer := (p_values->>'payerId')::uuid;
  category := (p_values->>'categoryId')::uuid;
  amount := (p_values->>'expectedAmountMinor')::bigint;
  start_date := (p_values->>'dueStart')::date;
  end_date := (p_values->>'dueEnd')::date;
  reminder := (p_values->>'reminderDaysBefore')::smallint;
  if payer is null or category is null or (visibility = 'private' and payer <> auth.uid())
    or end_date < start_date or (amount is not null and (amount < 1 or amount > 1000000000000))
    or (v_date_mode = 'exact' and end_date <> start_date)
    or (reminder is not null and reminder not between 0 and 30)
    or (recurrence = 'monthly' and date_trunc('month', start_date::timestamp) <> date_trunc('month', end_date::timestamp))
    or not exists (select 1 from public.members where household_id = p_household_id and user_id = payer)
    or not exists (select 1 from public.categories where household_id = p_household_id and id = category and not archived) then
    raise exception 'Invalid payment input' using errcode = '22023';
  end if;
  if p_id is null then
    insert into public.scheduled_payments(household_id, owner_id, payer_id, visibility, name, expected_amount_minor,
      category_id, note, recurrence, date_mode, due_start, due_end, anchor_start_day, anchor_end_day, reminder_days_before)
    values (p_household_id, auth.uid(), payer, visibility, trim(p_values->>'name'), amount,
      category, nullif(trim(p_values->>'note'), ''), recurrence, v_date_mode, start_date, end_date,
      extract(day from start_date), extract(day from end_date), reminder)
    returning id into result;
  else
    -- Immutable privacy/recurrence prevents retroactive exposure and ambiguous cycles.
    if s.visibility <> visibility or s.recurrence <> recurrence or s.status = 'completed' then
      raise exception 'Payment type is fixed' using errcode = '22023';
    end if;
    if exists (select 1 from public.payment_records where schedule_ref = p_id and cycle_on =
      case when s.recurrence = 'monthly' then date_trunc('month', start_date::timestamp)::date else start_date end) then
      raise exception 'Payment cycle already paid' using errcode = '23505';
    end if;
    update public.scheduled_payments set payer_id = payer, name = trim(p_values->>'name'),
      expected_amount_minor = amount, category_id = category, note = nullif(trim(p_values->>'note'), ''),
      date_mode = v_date_mode, due_start = start_date, due_end = end_date,
      anchor_start_day = case when start_date = s.due_start then s.anchor_start_day else extract(day from start_date) end,
      anchor_end_day = case
        when v_date_mode = 'exact' then
          case when start_date = s.due_start then s.anchor_start_day else extract(day from start_date) end
        when end_date = s.due_end then s.anchor_end_day else extract(day from end_date) end,
      reminder_days_before = reminder, version = version + 1, updated_at = now()
      where id = p_id returning id into result;
  end if;
  return result;
end;
$$;

create function public.set_scheduled_payment_status(p_id uuid, p_version integer, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
declare s public.scheduled_payments;
begin
  s := public.lock_scheduled_payment(p_id, p_version);
  if p_status is null or p_status not in ('active', 'paused', 'archived') or
    (s.recurrence = 'one_time' and p_status <> 'archived' and exists (select 1 from public.payment_records where schedule_ref = p_id)) then
    raise exception 'Invalid payment state' using errcode = '22023';
  end if;
  update public.scheduled_payments set status = p_status, version = version + 1, updated_at = now() where id = p_id;
end;
$$;

create function public.delete_scheduled_payment(p_id uuid, p_version integer)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.lock_scheduled_payment(p_id, p_version);
  delete from public.scheduled_payments where id = p_id;
end;
$$;

create function public.mark_scheduled_payment_paid(
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
      insert into public.shared_transactions(household_id, category_id, paid_by, created_by, amount_minor, description, note, occurred_on)
      values (s.household_id, s.category_id, p_paid_by, auth.uid(), p_amount_minor, s.name, s.note, p_paid_on) returning id into transaction_id;
      update public.payment_records set shared_transaction_id = transaction_id where id = record_id;
    else
      insert into public.private_transactions(household_id, owner_id, category_id, amount_minor, description, note, occurred_on)
      values (s.household_id, s.owner_id, s.category_id, p_amount_minor, s.name, s.note, p_paid_on) returning id into transaction_id;
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

-- RLS remains in force for every subquery. Recent amounts are a three-cycle
-- estimate only; the actual paid amount is always explicitly confirmed.
create function public.get_payment_workspace(p_household_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'schedules', coalesce((select jsonb_agg(
      to_jsonb(s) || jsonb_build_object(
        'estimate_minor', coalesce(s.expected_amount_minor, (select round(avg(recent.amount_minor))::bigint from
          (select r.amount_minor from public.payment_records r where r.schedule_ref = s.id order by r.cycle_on desc limit 3) recent)),
        'paid_this_month', exists (select 1 from public.payment_records r where r.schedule_ref = s.id
          and r.cycle_on >= date_trunc('month', now() at time zone h.timezone)::date
          and r.cycle_on < (date_trunc('month', now() at time zone h.timezone) + interval '1 month')::date),
        'recent_amounts', coalesce((select jsonb_agg(recent) from (select r.amount_minor, r.paid_on
          from public.payment_records r where r.schedule_ref = s.id order by r.cycle_on desc limit 3) recent), '[]'::jsonb)
      ) order by s.due_start, s.created_at, s.id) from public.scheduled_payments s where s.household_id = h.id), '[]'::jsonb),
    'categories', coalesce((select jsonb_agg(c order by c.sort_order, c.name) from public.categories c
      where c.household_id = h.id), '[]'::jsonb)
  ) from public.households h where h.id = p_household_id;
$$;

revoke execute on function public.lock_scheduled_payment(uuid, integer) from public, anon, authenticated;
revoke execute on function public.payment_date_in_month(date, integer) from public, anon;
revoke execute on function
  public.save_scheduled_payment(uuid, uuid, integer, jsonb),
  public.set_scheduled_payment_status(uuid, integer, text),
  public.delete_scheduled_payment(uuid, integer),
  public.mark_scheduled_payment_paid(uuid, integer, date, bigint, date, uuid, boolean),
  public.get_payment_workspace(uuid)
  from public, anon;
grant execute on function
  public.save_scheduled_payment(uuid, uuid, integer, jsonb),
  public.set_scheduled_payment_status(uuid, integer, text),
  public.delete_scheduled_payment(uuid, integer),
  public.mark_scheduled_payment_paid(uuid, integer, date, bigint, date, uuid, boolean),
  public.get_payment_workspace(uuid)
  to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.scheduled_payments, public.payment_records;
  end if;
end $$;
