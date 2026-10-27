-- Personal, versioned discovery state. No household/financial fields, no Realtime publication.
create table public.guide_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  guide_id text not null,
  guide_version integer not null check (guide_version = 1),
  step_id text not null,
  status text not null check (status in ('in_progress','paused','dismissed','completed')),
  revision integer not null default 1 check (revision > 0),
  request_id uuid not null,
  primary key (user_id, guide_id, guide_version),
  check (case guide_id
    when 'first-visit' then step_id in ('home','shared','private','log')
    when 'quick-log' then step_id in ('space','save')
    when 'payments' then step_id in ('list','create')
    when 'cashflow' then step_id in ('forecast','calendar')
    when 'categories' then step_id in ('spaces','create')
    when 'budget-categories' then step_id in ('plan','assign')
    when 'private-allowance' then step_id in ('balance','privacy')
    else false end)
);
alter table public.guide_progress enable row level security;
create policy own_guide_progress on public.guide_progress for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.guide_progress from public, anon, authenticated;
grant select on public.guide_progress to authenticated;

create function public.save_guide_progress(
  p_guide_id text, p_guide_version integer, p_step_id text, p_status text,
  p_revision integer, p_request_id uuid
) returns public.guide_progress language plpgsql security definer set search_path = '' as $$
declare saved public.guide_progress;
begin
  if auth.uid() is null then raise exception 'Not signed in' using errcode='42501'; end if;
  -- Serializes first inserts too; row locks alone cannot lock a missing row.
  perform 1 from auth.users where id=auth.uid() for update;
  select * into saved from public.guide_progress
    where user_id=auth.uid() and guide_id=p_guide_id and guide_version=p_guide_version for update;
  if saved.request_id = p_request_id then
    if saved.step_id is distinct from p_step_id or saved.status is distinct from p_status then
      raise exception 'Invalid guide input' using errcode='22023';
    end if;
    return saved;
  end if;
  if p_revision is distinct from coalesce(saved.revision,0) then
    raise exception 'Guide changed' using errcode='40001';
  end if;
  insert into public.guide_progress(user_id,guide_id,guide_version,step_id,status,request_id)
    values(auth.uid(),p_guide_id,p_guide_version,p_step_id,p_status,p_request_id)
    on conflict(user_id,guide_id,guide_version) do update set
      step_id=excluded.step_id,status=excluded.status,request_id=excluded.request_id,
      revision=public.guide_progress.revision+1
    returning * into saved;
  return saved;
exception when check_violation or not_null_violation then
  raise exception 'Invalid guide input' using errcode='22023';
end;
$$;
revoke execute on function public.save_guide_progress(text,integer,text,text,integer,uuid) from public, anon;
grant execute on function public.save_guide_progress(text,integer,text,text,integer,uuid) to authenticated;

-- Optional payday setup can be deferred without inventing income or deleting existing sources.
create function public.defer_budget_paydays(p_household_id uuid, p_revision integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare revision integer;
begin
  perform public.lock_budget_setup(p_household_id,p_revision);
  if not exists(select 1 from public.members where household_id=p_household_id
    and user_id=auth.uid() and budget_setup_step>=3) then
    raise exception 'Complete the earlier budget steps' using errcode='22023';
  end if;
  update public.members set budget_setup_step=4,budget_completed_at=coalesce(budget_completed_at,now())
    where household_id=p_household_id and user_id=auth.uid();
  update public.households set budget_revision=budget_revision+1 where id=p_household_id
    returning budget_revision into revision;
  return revision;
end;
$$;
revoke execute on function public.defer_budget_paydays(uuid,integer) from public, anon;
grant execute on function public.defer_budget_paydays(uuid,integer) to authenticated;
