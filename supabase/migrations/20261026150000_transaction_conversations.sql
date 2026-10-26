-- Shared-expense conversations. Private transactions are never valid targets.
alter table public.shared_transactions add constraint shared_transactions_household_id_id_key unique (household_id,id);
alter table public.households add column conversation_revision bigint not null default 0;

create table public.comments (
  id uuid primary key,
  household_id uuid not null,
  transaction_id uuid not null,
  author_id uuid not null,
  body text not null check (char_length(body)<=1000),
  version integer not null default 1 check(version>0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((deleted_at is null and char_length(btrim(body)) between 1 and 1000) or (deleted_at is not null and body='')),
  foreign key (household_id,transaction_id) references public.shared_transactions(household_id,id) on delete cascade,
  foreign key (household_id,author_id) references public.members(household_id,user_id) on delete cascade
);
create index comments_thread_order on public.comments(household_id,transaction_id,created_at desc,id desc);
create table public.reactions (
  household_id uuid not null,
  transaction_id uuid not null,
  author_id uuid not null,
  kind text not null check(kind in ('heart','thanks','coffee','celebrate')),
  created_at timestamptz not null default now(),
  primary key(transaction_id,author_id,kind),
  foreign key (household_id,transaction_id) references public.shared_transactions(household_id,id) on delete cascade,
  foreign key (household_id,author_id) references public.members(household_id,user_id) on delete cascade
);
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
revoke all on public.comments,public.reactions from public,anon,authenticated;
grant select on public.comments,public.reactions to authenticated;
create policy comments_read on public.comments for select to authenticated using(public.is_household_member(household_id));
create policy reactions_read on public.reactions for select to authenticated using(public.is_household_member(household_id));

-- Publish only an authorised household revision, never comment bodies or reaction
-- DELETE payloads. Clients fetch the thread through RLS after this signal.
create function public.signal_conversation_change() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.households set conversation_revision=conversation_revision+1
    where id=case when tg_op='DELETE' then old.household_id else new.household_id end;
  return null;
end;
$$;
create trigger comments_signal after insert or update or delete on public.comments
  for each row execute function public.signal_conversation_change();
create trigger reactions_signal after insert or delete on public.reactions
  for each row execute function public.signal_conversation_change();

create function public.lock_shared_conversation(p_household_id uuid,p_transaction_id uuid,p_actor_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or p_actor_id is distinct from auth.uid() then raise exception 'Not signed in' using errcode='42501'; end if;
  perform 1 from public.shared_transactions where id=p_transaction_id and household_id=p_household_id
    and public.is_household_member(p_household_id) for update;
  if not found then raise exception 'Conversation unavailable' using errcode='42501'; end if;
end;
$$;

create function public.save_transaction_comment(p_household_id uuid,p_transaction_id uuid,p_actor_id uuid,
  p_id uuid,p_version integer,p_body text) returns public.comments
language plpgsql security definer set search_path='' as $$
declare item public.comments; clean text;
begin
  perform public.lock_shared_conversation(p_household_id,p_transaction_id,p_actor_id);
  clean:=regexp_replace(p_body,'^[[:space:]]+|[[:space:]]+$','','g');
  if p_id is null or p_version is null or p_version<0 or clean is null or char_length(clean) not between 1 and 1000 then
    raise exception 'Invalid comment input' using errcode='22023';
  end if;
  select * into item from public.comments where id=p_id for update;
  if item.id is null then
    if p_version<>0 then raise exception 'Comment unavailable'; end if;
    insert into public.comments(id,household_id,transaction_id,author_id,body)
      values(p_id,p_household_id,p_transaction_id,p_actor_id,clean) returning * into item;
    return item;
  end if;
  if item.household_id<>p_household_id or item.transaction_id<>p_transaction_id or item.author_id<>p_actor_id or item.deleted_at is not null then
    raise exception 'Comment unavailable' using errcode='42501';
  end if;
  -- Stable client IDs and desired-body comparison make lost-response retries safe.
  if item.body=clean and (p_version=0 or item.version=p_version or item.version=p_version+1) then return item; end if;
  if p_version=0 or item.version<>p_version then raise exception 'Comment changed' using errcode='40001'; end if;
  update public.comments set body=clean,version=version+1,updated_at=now() where id=p_id returning * into item;
  return item;
end;
$$;
create function public.remove_transaction_comment(p_household_id uuid,p_transaction_id uuid,p_actor_id uuid,p_id uuid,p_version integer)
returns void language plpgsql security definer set search_path='' as $$
declare item public.comments;
begin
  perform public.lock_shared_conversation(p_household_id,p_transaction_id,p_actor_id);
  select * into item from public.comments where id=p_id for update;
  if item.id is null or item.household_id<>p_household_id or item.transaction_id<>p_transaction_id or item.author_id<>p_actor_id then
    raise exception 'Comment unavailable' using errcode='42501';
  end if;
  if item.deleted_at is not null then return; end if;
  if p_version is distinct from item.version then raise exception 'Comment changed' using errcode='40001'; end if;
  -- Keep only a tombstone so an old create retry cannot resurrect a removed body.
  update public.comments set body='',deleted_at=now(),updated_at=now(),version=version+1 where id=p_id;
end;
$$;
create function public.set_transaction_reaction(p_household_id uuid,p_transaction_id uuid,p_actor_id uuid,p_kind text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.lock_shared_conversation(p_household_id,p_transaction_id,p_actor_id);
  if p_kind is null or p_kind not in ('heart','thanks','coffee','celebrate') or p_active is null then
    raise exception 'Invalid reaction input' using errcode='22023';
  end if;
  if p_active then
    insert into public.reactions(household_id,transaction_id,author_id,kind) values(p_household_id,p_transaction_id,p_actor_id,p_kind)
      on conflict(transaction_id,author_id,kind) do nothing;
  else
    delete from public.reactions where household_id=p_household_id and transaction_id=p_transaction_id and author_id=p_actor_id and kind=p_kind;
  end if;
end;
$$;
revoke execute on function public.signal_conversation_change(),public.lock_shared_conversation(uuid,uuid,uuid) from public,anon,authenticated;
revoke execute on function public.save_transaction_comment(uuid,uuid,uuid,uuid,integer,text),
  public.remove_transaction_comment(uuid,uuid,uuid,uuid,integer),public.set_transaction_reaction(uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.save_transaction_comment(uuid,uuid,uuid,uuid,integer,text),
  public.remove_transaction_comment(uuid,uuid,uuid,uuid,integer),public.set_transaction_reaction(uuid,uuid,uuid,text,boolean) to authenticated;
