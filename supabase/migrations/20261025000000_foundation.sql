-- Foundation: households, partners, the Shared Bucket and the two Private Spaces.
--
-- Privacy model
--   * Everything shared (household, members, categories, shared transactions) is
--     visible to both partners and nobody else.
--   * Private transactions are visible ONLY to their owner. A partner can see how
--     much allowance is left (allowance_balances), never what it was spent on.
--   * Households and memberships are only created through the functions at the
--     bottom, never by direct inserts.
--
-- All amounts are integer minor units in the household's base currency. When a
-- purchase was made in another currency, the original amount and rate are kept too.

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.split_mode as enum ('proportional', 'equal', 'combined');
create type public.period_status as enum ('open', 'in_review', 'locked');
create type public.category_bucket as enum ('needs', 'wants', 'savings');

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- 8-character code with no look-alike characters (no 0/O, 1/I/L).
create function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  bytes bytea := uuid_send(gen_random_uuid());
  code text := '';
begin
  for i in 0..7 loop
    code := code || substr(alphabet, (get_byte(bytes, i) % length(alphabet)) + 1, 1);
  end loop;
  return code;
end;
$$;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  base_currency char(3) not null check (base_currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'UTC',
  split_mode public.split_mode not null default 'proportional',
  money_date_day smallint not null default 1 check (money_date_day between 1 and 28),
  invite_code text not null unique default public.generate_invite_code(),
  created_at timestamptz not null default now()
);

create table public.members (
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 40),
  monthly_income_minor bigint not null default 0 check (monthly_income_minor >= 0),
  monthly_allowance_minor bigint not null default 0 check (monthly_allowance_minor >= 0),
  joined_at timestamptz not null default now(),
  primary key (household_id, user_id),
  -- One household per person for now.
  unique (user_id)
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  emoji text,
  bucket public.category_bucket not null default 'needs',
  sort_order smallint not null default 0,
  archived boolean not null default false,
  unique (household_id, id)
);

create table public.budget_periods (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  starts_on date not null,
  ends_on date not null, -- exclusive
  status public.period_status not null default 'open',
  -- Incomes, allowances and split mode as they were when the period was locked.
  snapshot jsonb,
  check (ends_on > starts_on),
  unique (household_id, starts_on)
);

create table public.shared_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  category_id uuid,
  paid_by uuid not null,
  created_by uuid not null default auth.uid(),
  amount_minor bigint not null check (amount_minor <> 0), -- negative = refund
  original_currency char(3),
  original_amount_minor bigint,
  fx_rate numeric(20, 10),
  description text not null default '' check (char_length(description) <= 120),
  note text check (char_length(note) <= 500),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (household_id) references public.households (id) on delete cascade,
  -- Shared history outlives a partner leaving: removing a member who paid for or
  -- logged shared expenses is blocked until that history is dealt with.
  foreign key (household_id, paid_by) references public.members (household_id, user_id),
  foreign key (household_id, created_by) references public.members (household_id, user_id),
  foreign key (household_id, category_id) references public.categories (household_id, id),
  check (
    (original_currency is null and original_amount_minor is null and fx_rate is null)
    or (original_currency is not null and original_amount_minor is not null and fx_rate > 0)
  )
);

create index shared_transactions_household_date on public.shared_transactions (household_id, occurred_on desc);

create trigger shared_transactions_updated_at
  before update on public.shared_transactions
  for each row execute function public.set_updated_at();

create table public.private_transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  owner_id uuid not null default auth.uid(),
  amount_minor bigint not null check (amount_minor <> 0),
  original_currency char(3),
  original_amount_minor bigint,
  fx_rate numeric(20, 10),
  description text not null default '' check (char_length(description) <= 120),
  occurred_on date not null default current_date,
  created_at timestamptz not null default now(),
  foreign key (household_id) references public.households (id) on delete cascade,
  -- Private spending belongs to the person: it leaves with them.
  foreign key (household_id, owner_id) references public.members (household_id, user_id) on delete cascade,
  check (
    (original_currency is null and original_amount_minor is null and fx_rate is null)
    or (original_currency is not null and original_amount_minor is not null and fx_rate > 0)
  )
);

create index private_transactions_owner_date on public.private_transactions (owner_id, occurred_on desc);

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------

-- Security definer so policies on `members` can call it without recursing into themselves.
create function public.is_household_member(p_household_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.members
    where household_id = p_household_id and user_id = (select auth.uid())
  );
$$;

alter table public.households enable row level security;
alter table public.members enable row level security;
alter table public.categories enable row level security;
alter table public.budget_periods enable row level security;
alter table public.shared_transactions enable row level security;
alter table public.private_transactions enable row level security;

-- Households: partners can read and adjust their own household's settings.
create policy "members read their household" on public.households
  for select to authenticated using (public.is_household_member(id));
create policy "members update their household" on public.households
  for update to authenticated using (public.is_household_member(id));

-- Members: partners see each other; each person edits only their own row or leaves.
create policy "members read their partner" on public.members
  for select to authenticated using (public.is_household_member(household_id));
create policy "members update themselves" on public.members
  for update to authenticated using (user_id = (select auth.uid()));
create policy "members can leave" on public.members
  for delete to authenticated using (user_id = (select auth.uid()));

-- Shared data: fully visible and editable by both partners.
create policy "members manage categories" on public.categories
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members manage periods" on public.budget_periods
  for all to authenticated
  using (public.is_household_member(household_id))
  with check (public.is_household_member(household_id));

create policy "members read shared transactions" on public.shared_transactions
  for select to authenticated using (public.is_household_member(household_id));
create policy "members log shared transactions" on public.shared_transactions
  for insert to authenticated
  with check (public.is_household_member(household_id) and created_by = (select auth.uid()));
create policy "members edit shared transactions" on public.shared_transactions
  for update to authenticated using (public.is_household_member(household_id));
create policy "members delete shared transactions" on public.shared_transactions
  for delete to authenticated using (public.is_household_member(household_id));

-- Private Space: owner only. No partner policy exists, so partners get zero rows.
create policy "owner manages private transactions" on public.private_transactions
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()) and public.is_household_member(household_id));

-- Column-level limits on updates, so rows can't be moved between households
-- or reassigned to someone else.
revoke all on public.households, public.members, public.categories, public.budget_periods,
  public.shared_transactions, public.private_transactions from anon;

revoke insert, update on public.households from authenticated;
grant update (name, timezone, split_mode, money_date_day) on public.households to authenticated;

revoke insert, update on public.members from authenticated;
grant update (display_name, monthly_income_minor, monthly_allowance_minor) on public.members to authenticated;

revoke update on public.shared_transactions from authenticated;
grant update (category_id, paid_by, amount_minor, original_currency, original_amount_minor,
  fx_rate, description, note, occurred_on) on public.shared_transactions to authenticated;

revoke update on public.private_transactions from authenticated;
grant update (amount_minor, original_currency, original_amount_minor, fx_rate, description,
  occurred_on) on public.private_transactions to authenticated;

-- ---------------------------------------------------------------------------
-- Functions the app calls
-- ---------------------------------------------------------------------------

-- What each partner has left in their Private Space this month. Partners see the
-- totals for each other, but never the individual transactions.
create function public.allowance_balances(p_household_id uuid)
returns table (
  user_id uuid,
  display_name text,
  allowance_minor bigint,
  spent_minor bigint,
  remaining_minor bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with month as (
    select
      date_trunc('month', now() at time zone h.timezone)::date as starts_on,
      (date_trunc('month', now() at time zone h.timezone) + interval '1 month')::date as ends_on
    from public.households h
    where h.id = p_household_id
  )
  select
    m.user_id,
    m.display_name,
    m.monthly_allowance_minor,
    coalesce(sum(p.amount_minor), 0)::bigint,
    (m.monthly_allowance_minor - coalesce(sum(p.amount_minor), 0))::bigint
  from public.members m
  cross join month
  left join public.private_transactions p
    on p.household_id = m.household_id
    and p.owner_id = m.user_id
    and p.occurred_on >= month.starts_on
    and p.occurred_on < month.ends_on
  where m.household_id = p_household_id
    and public.is_household_member(p_household_id)
  group by m.user_id, m.display_name, m.monthly_allowance_minor, m.joined_at
  order by m.joined_at;
$$;

create function public.create_household(
  p_name text,
  p_base_currency text,
  p_timezone text,
  p_display_name text
)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  household public.households;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = me) then
    raise exception 'You are already part of a household' using errcode = '23505';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Unknown timezone: %', p_timezone using errcode = '22023';
  end if;

  insert into public.households (name, base_currency, timezone)
  values (trim(p_name), upper(p_base_currency), p_timezone)
  returning * into household;

  insert into public.members (household_id, user_id, display_name)
  values (household.id, me, trim(p_display_name));

  insert into public.categories (household_id, name, emoji, bucket, sort_order) values
    (household.id, 'Rent & home', '🏡', 'needs', 1),
    (household.id, 'Groceries', '🛒', 'needs', 2),
    (household.id, 'Utilities', '💡', 'needs', 3),
    (household.id, 'Transport', '🚗', 'needs', 4),
    (household.id, 'Insurance', '🛡️', 'needs', 5),
    (household.id, 'Eating out', '🍝', 'wants', 6),
    (household.id, 'Fun together', '🎟️', 'wants', 7),
    (household.id, 'Savings', '🌱', 'savings', 8);

  return household;
end;
$$;

create function public.join_household(p_invite_code text, p_display_name text)
returns public.households
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  household public.households;
begin
  if me is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if exists (select 1 from public.members where user_id = me) then
    raise exception 'You are already part of a household' using errcode = '23505';
  end if;

  select * into household
  from public.households
  where invite_code = upper(replace(trim(p_invite_code), '-', ''))
  for update;

  if household.id is null then
    raise exception 'That invite code didn''t match any household' using errcode = 'P0002';
  end if;
  if (select count(*) from public.members where household_id = household.id) >= 2 then
    raise exception 'This household already has two partners' using errcode = '23514';
  end if;

  insert into public.members (household_id, user_id, display_name)
  values (household.id, me, trim(p_display_name));

  return household;
end;
$$;

create function public.regenerate_invite_code(p_household_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  code text;
begin
  if not public.is_household_member(p_household_id) then
    raise exception 'Not a member of this household' using errcode = '42501';
  end if;
  update public.households
  set invite_code = public.generate_invite_code()
  where id = p_household_id
  returning invite_code into code;
  return code;
end;
$$;

revoke execute on function
  public.is_household_member(uuid),
  public.allowance_balances(uuid),
  public.create_household(text, text, text, text),
  public.join_household(text, text),
  public.regenerate_invite_code(uuid)
from public, anon;

grant execute on function
  public.is_household_member(uuid),
  public.allowance_balances(uuid),
  public.create_household(text, text, text, text),
  public.join_household(text, text),
  public.regenerate_invite_code(uuid)
to authenticated;

-- ---------------------------------------------------------------------------
-- Realtime: both partners' screens update instantly. Realtime respects RLS.
-- ---------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime
      add table public.households, public.members, public.shared_transactions;
  end if;
end;
$$;
