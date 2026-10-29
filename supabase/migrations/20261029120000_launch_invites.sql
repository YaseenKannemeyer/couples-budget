-- Phase 2.5: a solo household can prepare an optional allowance proposal.
-- This is a monthly budget agreement, never a cash transfer or private purchase.
alter table public.households add column invite_allowance_minor bigint
  check (invite_allowance_minor between 0 and 1000000000000);

create function public.save_invite_allowance(p_household_id uuid, p_revision integer, p_amount_minor bigint)
returns integer language plpgsql security definer set search_path = '' as $$
declare revision integer;
begin
  perform public.lock_budget_setup(p_household_id, p_revision);
  if (select count(*) from public.members where household_id = p_household_id) <> 1 then
    raise exception 'Invite no longer available' using errcode = '40001';
  end if;
  if p_amount_minor is not null and (p_amount_minor < 0 or p_amount_minor > 1000000000000) then
    raise exception 'Invalid budget input' using errcode = '22023';
  end if;
  update public.households set invite_allowance_minor = p_amount_minor, budget_revision = budget_revision + 1
    where id = p_household_id returning budget_revision into revision;
  return revision;
end;
$$;

-- A bearer invite code permits an authenticated prospective partner to review
-- only these shared planning facts. No income, source, balance, purchase, note,
-- receipt, schedule or account information is returned. No public lookup/list.
create function public.preview_household_invite(p_invite_code text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare h public.households;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into h from public.households
    where invite_code = upper(regexp_replace(p_invite_code, '[[:space:]-]', '', 'g')) for share;
  if h.id is null then raise exception 'That invite code didn''t match any household' using errcode = 'P0002'; end if;
  if exists(select 1 from public.members where user_id = auth.uid()) then
    raise exception 'You are already part of a household' using errcode = '23505';
  end if;
  if (select count(*) from public.members where household_id = h.id) <> 1 then
    raise exception 'This household already has two partners' using errcode = '23514';
  end if;
  return jsonb_build_object('household_id', h.id, 'name', h.name, 'base_currency', h.base_currency,
    'split_mode', h.split_mode, 'revision', h.budget_revision, 'allowance_minor', h.invite_allowance_minor,
    'inviter_name', (select display_name from public.members where household_id = h.id limit 1),
    'costs', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'amount_minor', amount_minor) order by sort_order, id)
      from public.budget_costs where household_id = h.id), '[]'::jsonb));
end;
$$;

create function public.join_household_reviewed(
  p_invite_code text, p_display_name text, p_revision integer, p_allowance_minor bigint
) returns public.households language plpgsql security definer set search_path = '' as $$
declare h public.households; existing uuid;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode = '28000'; end if;
  select * into h from public.households
    where invite_code = upper(regexp_replace(p_invite_code, '[[:space:]-]', '', 'g')) for update;
  if h.id is null then raise exception 'That invite code didn''t match any household' using errcode = 'P0002'; end if;
  select household_id into existing from public.members where user_id = auth.uid();
  -- A response lost after commit can be retried without resetting an allowance
  -- or repeating any financial action. A different household is never replaced.
  if existing = h.id then return h; end if;
  if existing is not null then raise exception 'You are already part of a household' using errcode = '23505'; end if;
  if p_revision is null or p_revision <> h.budget_revision then
    raise exception 'Budget plan changed' using errcode = '40001';
  end if;
  if p_allowance_minor is null or p_allowance_minor < 0 or p_allowance_minor > 1000000000000
    or p_display_name is null or length(trim(p_display_name)) not between 1 and 40 then
    raise exception 'Invalid budget input' using errcode = '22023';
  end if;
  perform public.join_household(h.invite_code, p_display_name);
  -- Update only the person who just explicitly reviewed this allowance. Income
  -- and payday setup remain pending; the existing member is not edited.
  update public.members set monthly_allowance_minor = p_allowance_minor
    where household_id = h.id and user_id = auth.uid();
  select * into h from public.households where id = h.id;
  return h;
end;
$$;

revoke all on function public.save_invite_allowance(uuid, integer, bigint),
  public.preview_household_invite(text), public.join_household_reviewed(text, text, integer, bigint) from public, anon;
grant execute on function public.save_invite_allowance(uuid, integer, bigint),
  public.preview_household_invite(text), public.join_household_reviewed(text, text, integer, bigint) to authenticated;
