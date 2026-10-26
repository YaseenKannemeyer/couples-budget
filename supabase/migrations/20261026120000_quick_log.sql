-- Idempotent expense logging and private receipt storage. Queue IDs are generated
-- on the device before network work; one ID can commit only one request payload.
create table public.quick_log_requests (
  id uuid primary key, household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null, values jsonb not null, result jsonb not null,
  created_at timestamptz not null default now(),
  foreign key(household_id,owner_id) references public.members(household_id,user_id) on delete cascade
);
create table public.expense_receipts (
  id uuid primary key references public.quick_log_requests(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  owner_id uuid not null, visibility text not null check(visibility in ('shared','private')),
  shared_transaction_id uuid references public.shared_transactions(id) on delete cascade,
  private_transaction_id uuid references public.private_transactions(id) on delete cascade,
  object_path text not null unique, ready boolean not null default false,
  foreign key(household_id,owner_id) references public.members(household_id,user_id) on delete cascade,
  check(case when visibility='shared' then shared_transaction_id is not null and private_transaction_id is null
    else shared_transaction_id is null and private_transaction_id is not null end)
);
alter table public.quick_log_requests enable row level security;
alter table public.expense_receipts enable row level security;
create policy own_requests on public.quick_log_requests for select to authenticated
  using(owner_id=auth.uid() and public.is_household_member(household_id));
create policy visible_receipts on public.expense_receipts for select to authenticated
  using(public.is_household_member(household_id) and (owner_id=auth.uid() or (visibility='shared' and ready)));
revoke all on public.quick_log_requests,public.expense_receipts from anon,authenticated;
grant select on public.quick_log_requests,public.expense_receipts to authenticated;

create function public.log_expense(p_household_id uuid,p_user_id uuid,p_client_id uuid,p_values jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare today date; prior public.quick_log_requests; s public.scheduled_payments; amount bigint; cat uuid; payer uuid;
  space text; frequency text; on_date date; v_description text; v_note text; record_id uuid; tx_id uuid;
  v_original_currency text; original_amount bigint; rate numeric; output jsonb; receipt_path text;
begin
  if auth.uid() is null or p_user_id is distinct from auth.uid() then raise exception 'Not signed in' using errcode='42501'; end if;
  today:=public.lock_cashflow(p_household_id);
  if p_client_id is null then raise exception 'Invalid expense input'; end if;
  select * into prior from public.quick_log_requests where id=p_client_id;
  if prior.id is not null then
    if prior.owner_id<>auth.uid() or prior.household_id<>p_household_id then raise exception 'Expense unavailable' using errcode='42501'; end if;
    if prior.values is distinct from p_values then raise exception 'Queued expense changed'; end if;
    return prior.result;
  end if;
  if jsonb_typeof(p_values) is distinct from 'object' then raise exception 'Invalid expense input'; end if;
  if p_values->>'baseCurrency' is distinct from (select base_currency::text from public.households where id=p_household_id) then
    raise exception 'Household currency changed';
  end if;
  space:=p_values->>'visibility'; frequency:=p_values->>'frequency'; amount:=(p_values->>'amountMinor')::bigint;
  cat:=(p_values->>'categoryId')::uuid; payer:=(p_values->>'paidBy')::uuid;
  v_description:=trim(p_values->>'description'); v_note:=nullif(trim(p_values->>'note'),'');
  if (p_values->>'occurredOn') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Invalid expense input'; end if;
  on_date:=(p_values->>'occurredOn')::date;
  if space is null or space not in ('shared','private') or frequency is null or frequency not in ('one_time','monthly')
    or amount is null or amount not between 1 and 1000000000000 or on_date is null or on_date>today or on_date<today-3660
    or v_description is null or length(v_description) not between 1 and 120 or length(v_note)>500
    or payer is null or not exists(select 1 from public.members where household_id=p_household_id and user_id=payer)
    or (space='private' and payer<>auth.uid()) then raise exception 'Invalid expense input'; end if;
  perform public.validate_expense_category(p_household_id,cat,space,auth.uid());
  v_original_currency:=nullif(p_values->>'originalCurrency','');
  original_amount:=(p_values->>'originalAmountMinor')::bigint; rate:=(p_values->>'fxRate')::numeric;
  if v_original_currency is not null then
    if v_original_currency !~ '^[A-Z]{3}$' or original_amount is null or original_amount not between 1 and 1000000000000
      or rate is null or rate<=0 or rate>=10000000000 then raise exception 'Invalid expense input'; end if;
  elsif original_amount is not null or rate is not null then raise exception 'Invalid expense input'; end if;
  if p_values->>'scheduleId' is not null then
    s:=public.lock_scheduled_payment((p_values->>'scheduleId')::uuid,(p_values->>'scheduleVersion')::integer);
    if s.household_id<>p_household_id or s.visibility<>space or s.recurrence<>frequency then raise exception 'Invalid expense input'; end if;
    record_id:=public.mark_scheduled_payment_paid(s.id,s.version,(p_values->>'scheduleDueStart')::date,amount,on_date,payer,true);
    select coalesce(shared_transaction_id,private_transaction_id) into tx_id from public.payment_records where id=record_id;
    -- Classification of the logged expense may differ from the immutable paid
    -- snapshot; the schedule and its category remain untouched.
    if space='shared' then
      update public.shared_transactions set description=v_description,note=v_note,category_id=cat,
        original_currency=v_original_currency,original_amount_minor=original_amount,fx_rate=rate where id=tx_id;
    else
      update public.private_transactions set description=v_description,note=v_note,category_id=cat,
        original_currency=v_original_currency,original_amount_minor=original_amount,fx_rate=rate where id=tx_id;
    end if;
  else
    tx_id:=p_client_id;
    if space='shared' then
      insert into public.shared_transactions(id,household_id,category_id,paid_by,created_by,amount_minor,description,note,occurred_on,frequency,original_currency,original_amount_minor,fx_rate)
        values(tx_id,p_household_id,cat,payer,auth.uid(),amount,v_description,v_note,on_date,frequency,v_original_currency,original_amount,rate);
    else
      insert into public.private_transactions(id,household_id,owner_id,category_id,amount_minor,description,note,occurred_on,frequency,original_currency,original_amount_minor,fx_rate)
        values(tx_id,p_household_id,auth.uid(),cat,amount,v_description,v_note,on_date,frequency,v_original_currency,original_amount,rate);
    end if;
  end if;
  output:=jsonb_build_object('transactionId',tx_id,'visibility',space,'scheduleRef',s.id,'receiptPath',null);
  if coalesce((p_values->>'receipt')::boolean,false) then
    receipt_path:=p_household_id::text||'/'||space||'/'||auth.uid()::text||'/'||p_client_id::text||'.jpg';
    output:=output||jsonb_build_object('receiptPath',receipt_path);
  end if;
  insert into public.quick_log_requests values(p_client_id,p_household_id,auth.uid(),p_values,output,now());
  if receipt_path is not null then
    insert into public.expense_receipts(id,household_id,owner_id,visibility,shared_transaction_id,private_transaction_id,object_path)
      values(p_client_id,p_household_id,auth.uid(),space,case when space='shared' then tx_id end,case when space='private' then tx_id end,receipt_path);
  end if;
  return output;
exception when check_violation or not_null_violation or invalid_text_representation or datetime_field_overflow or numeric_value_out_of_range then
  raise exception 'Invalid expense input' using errcode='22023';
end;
$$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('expense-receipts','expense-receipts',false,5242880,array['image/jpeg'])
  on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg'];

create function public.can_read_receipt(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.expense_receipts r where r.object_path=p_path and r.ready
    and public.is_household_member(r.household_id) and (r.visibility='shared' or r.owner_id=auth.uid()));
$$;
create function public.owns_receipt(p_path text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.expense_receipts r where r.object_path=p_path and r.owner_id=auth.uid()
    and public.is_household_member(r.household_id));
$$;
create policy receipt_read on storage.objects for select to authenticated
  using(bucket_id='expense-receipts' and (public.can_read_receipt(name) or public.owns_receipt(name)));
create policy receipt_insert on storage.objects for insert to authenticated
  with check(bucket_id='expense-receipts' and public.owns_receipt(name));
create policy receipt_delete on storage.objects for delete to authenticated
  using(bucket_id='expense-receipts' and public.owns_receipt(name));
create policy receipt_read_guard on storage.objects as restrictive for select to public
  using(bucket_id<>'expense-receipts' or public.can_read_receipt(name) or public.owns_receipt(name));
create policy receipt_insert_guard on storage.objects as restrictive for insert to public
  with check(bucket_id<>'expense-receipts' or public.owns_receipt(name));
create policy receipt_delete_guard on storage.objects as restrictive for delete to public
  using(bucket_id<>'expense-receipts' or public.owns_receipt(name));
create policy receipt_update_guard on storage.objects as restrictive for update to public
  using(bucket_id<>'expense-receipts') with check(bucket_id<>'expense-receipts');
-- No UPDATE policy: retries cannot overwrite an existing receipt object.

create function public.finish_expense_receipt(p_household_id uuid,p_user_id uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.expense_receipts;
begin
  if p_user_id is distinct from auth.uid() then raise exception 'Receipt unavailable'; end if;
  perform public.lock_cashflow(p_household_id);
  select * into r from public.expense_receipts where id=p_id and household_id=p_household_id and owner_id=auth.uid() for update;
  if r.id is null then raise exception 'Receipt unavailable'; end if;
  if not exists(select 1 from storage.objects where bucket_id='expense-receipts' and name=r.object_path
    and metadata->>'mimetype'='image/jpeg' and (metadata->>'size')::bigint between 1 and 5242880) then raise exception 'Receipt upload pending'; end if;
  update public.expense_receipts set ready=true where id=r.id;
end;
$$;
create function public.remove_expense_receipt(p_household_id uuid,p_user_id uuid,p_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare r public.expense_receipts;
begin
  if p_user_id is distinct from auth.uid() then raise exception 'Receipt unavailable'; end if;
  perform public.lock_cashflow(p_household_id);
  select * into r from public.expense_receipts where id=p_id and household_id=p_household_id and owner_id=auth.uid() for update;
  if r.id is null then return; end if;
  if exists(select 1 from storage.objects where bucket_id='expense-receipts' and name=r.object_path) then raise exception 'Receipt upload pending'; end if;
  delete from public.expense_receipts where id=r.id;
  update public.quick_log_requests set result=result||jsonb_build_object('receiptPath',null) where id=r.id;
end;
$$;
revoke execute on function public.log_expense(uuid,uuid,uuid,jsonb),public.can_read_receipt(text),public.owns_receipt(text),
  public.finish_expense_receipt(uuid,uuid,uuid),public.remove_expense_receipt(uuid,uuid,uuid) from public,anon;
grant execute on function public.log_expense(uuid,uuid,uuid,jsonb),public.can_read_receipt(text),public.owns_receipt(text),
  public.finish_expense_receipt(uuid,uuid,uuid),public.remove_expense_receipt(uuid,uuid,uuid) to authenticated;

-- Anonymous policy checks always return false for this private bucket.
grant execute on function public.can_read_receipt(text),public.owns_receipt(text) to anon;
