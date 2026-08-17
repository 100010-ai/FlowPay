-- FlowPay 1.3 — security & performance hardening
-- Safe to run after upgrade-v12.sql. No demo/provider data is inserted.

-- Atomic fixed-window rate limiting. This replaces the event-per-request counter
-- used by v1.2 and removes the count-then-insert race under concurrency.
create table if not exists public.flowpay_rate_limit_counters (
  bucket text not null,
  key_hash text not null,
  window_started_at timestamptz not null,
  hits integer not null default 0 check (hits >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket, key_hash)
);
alter table public.flowpay_rate_limit_counters enable row level security;
-- Intentionally no anon/authenticated policies. Service role only.

create or replace function public.flowpay_check_rate_limit(
  p_key_hash text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  now_at timestamptz := clock_timestamp();
  window_at timestamptz;
  used integer;
begin
  if p_limit < 1 or p_limit > 10000 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'INVALID_RATE_LIMIT' using errcode='22023';
  end if;
  if length(p_key_hash) <> 64 or length(p_bucket) < 1 or length(p_bucket) > 100 then
    raise exception 'INVALID_RATE_LIMIT_KEY' using errcode='22023';
  end if;

  window_at := to_timestamp(floor(extract(epoch from now_at) / p_window_seconds) * p_window_seconds);

  insert into public.flowpay_rate_limit_counters(bucket,key_hash,window_started_at,hits,updated_at)
  values(p_bucket,p_key_hash,window_at,1,now_at)
  on conflict(bucket,key_hash) do update set
    hits = case
      when public.flowpay_rate_limit_counters.window_started_at = excluded.window_started_at
        then public.flowpay_rate_limit_counters.hits + 1
      else 1
    end,
    window_started_at = excluded.window_started_at,
    updated_at = excluded.updated_at
  returning hits into used;

  return query select used <= p_limit, greatest(0, p_limit - used);
end;
$$;
revoke all on function public.flowpay_check_rate_limit(text,text,integer,integer) from public;
grant execute on function public.flowpay_check_rate_limit(text,text,integer,integer) to service_role;

-- Bounded exact API usage aggregates. Detailed request rows remain sampled in app code.
create table if not exists public.api_usage_daily (
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  usage_date date not null default current_date,
  request_count bigint not null default 0,
  success_count bigint not null default 0,
  error_count bigint not null default 0,
  total_duration_ms bigint not null default 0,
  max_duration_ms integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, endpoint, usage_date)
);
alter table public.api_usage_daily enable row level security;
drop policy if exists "api usage own read" on public.api_usage_daily;
create policy "api usage own read" on public.api_usage_daily
for select to authenticated using ((select auth.uid()) = user_id);

alter table public.api_request_logs add column if not exists request_id text;

create or replace function public.flowpay_record_api_usage(
  p_user_id uuid,
  p_endpoint text,
  p_status_code integer,
  p_duration_ms integer
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null or length(trim(coalesce(p_endpoint,''))) < 1 then
    raise exception 'INVALID_API_USAGE' using errcode='22023';
  end if;
  if p_status_code < 100 or p_status_code > 599 then
    raise exception 'INVALID_STATUS_CODE' using errcode='22023';
  end if;

  insert into public.api_usage_daily(
    user_id,endpoint,usage_date,request_count,success_count,error_count,total_duration_ms,max_duration_ms,updated_at
  ) values(
    p_user_id,left(trim(p_endpoint),120),current_date,1,
    case when p_status_code between 200 and 399 then 1 else 0 end,
    case when p_status_code >= 400 then 1 else 0 end,
    greatest(0,least(coalesce(p_duration_ms,0),600000)),
    greatest(0,least(coalesce(p_duration_ms,0),600000)),now()
  )
  on conflict(user_id,endpoint,usage_date) do update set
    request_count = public.api_usage_daily.request_count + 1,
    success_count = public.api_usage_daily.success_count + case when p_status_code between 200 and 399 then 1 else 0 end,
    error_count = public.api_usage_daily.error_count + case when p_status_code >= 400 then 1 else 0 end,
    total_duration_ms = public.api_usage_daily.total_duration_ms + greatest(0,least(coalesce(p_duration_ms,0),600000)),
    max_duration_ms = greatest(public.api_usage_daily.max_duration_ms,greatest(0,least(coalesce(p_duration_ms,0),600000))),
    updated_at = now();
end;
$$;
revoke all on function public.flowpay_record_api_usage(uuid,text,integer,integer) from public;
grant execute on function public.flowpay_record_api_usage(uuid,text,integer,integer) to service_role;

-- Harden the security-definer audit trigger against search_path shadowing.
create or replace function public.flowpay_audit_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_json jsonb;
  owner_id uuid;
  row_id uuid;
begin
  row_json := case when TG_OP = 'DELETE' then to_jsonb(OLD) else to_jsonb(NEW) end;
  owner_id := coalesce(nullif(row_json->>'user_id','')::uuid, nullif(row_json->>'owner_user_id','')::uuid);
  if owner_id is null then owner_id := auth.uid(); end if;
  row_id := coalesce(nullif(row_json->>'id','')::uuid, owner_id);
  if owner_id is not null then
    insert into public.workspace_audit_log(user_id,entity_type,entity_id,action)
    values(owner_id,TG_TABLE_NAME,row_id,lower(TG_OP));
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

-- Indexes aligned with actual FlowPay query/filter patterns.
create index if not exists provider_rules_active_corridor_amount_idx
  on public.provider_rules(from_country,to_country,min_amount,max_amount,priority desc)
  where active = true;
create index if not exists provider_rules_active_currencies_gin_idx
  on public.provider_rules using gin(currencies)
  where active = true;
create index if not exists payment_drafts_user_status_updated_idx
  on public.payment_drafts(user_id,status,updated_at desc);
create index if not exists payment_drafts_user_open_due_idx
  on public.payment_drafts(user_id,due_date)
  where status in ('draft','ready','failed');
create index if not exists invoices_user_status_due_idx
  on public.invoices(user_id,status,due_date);
create index if not exists counterparties_user_country_currency_idx
  on public.counterparties(user_id,country,currency);
create index if not exists api_keys_user_active_idx
  on public.api_keys(user_id,created_at desc)
  where revoked_at is null;
create index if not exists api_request_logs_user_status_created_idx
  on public.api_request_logs(user_id,status_code,created_at desc);
create index if not exists workspace_audit_user_entity_created_idx
  on public.workspace_audit_log(user_id,entity_type,created_at desc);
create index if not exists audit_requests_user_status_created_idx
  on public.audit_requests(user_id,status,created_at desc);
create index if not exists api_usage_daily_user_date_idx
  on public.api_usage_daily(user_id,usage_date desc);

-- Maintenance helper for bounded operational tables. Run from a trusted service
-- account/cron; it is intentionally unavailable to browser roles.
create or replace function public.flowpay_prune_operational_data()
returns table(rate_limit_rows bigint, api_log_rows bigint, system_log_rows bigint)
language plpgsql
security definer
set search_path = ''
as $$
declare
  r1 bigint := 0;
  r2 bigint := 0;
  r3 bigint := 0;
begin
  delete from public.flowpay_rate_limit_counters where updated_at < now() - interval '7 days';
  get diagnostics r1 = row_count;
  delete from public.api_request_logs where created_at < now() - interval '30 days';
  get diagnostics r2 = row_count;
  delete from public.system_event_logs where created_at < now() - interval '30 days';
  get diagnostics r3 = row_count;
  return query select r1,r2,r3;
end;
$$;
revoke all on function public.flowpay_prune_operational_data() from public;
grant execute on function public.flowpay_prune_operational_data() to service_role;

-- Browser-write hardening ---------------------------------------------------
-- Financial state changes are only allowed through the validated RPC surface.
-- This prevents an authenticated browser from bypassing lifecycle checks with
-- a direct PostgREST UPDATE/INSERT request.
drop policy if exists "payment drafts own insert" on public.payment_drafts;
drop policy if exists "payment drafts own update" on public.payment_drafts;
drop policy if exists "payment drafts own delete" on public.payment_drafts;
drop policy if exists "counterparties own insert" on public.counterparties;
drop policy if exists "counterparties own update" on public.counterparties;
drop policy if exists "counterparties own delete" on public.counterparties;
drop policy if exists "invoices own insert" on public.invoices;
drop policy if exists "invoices own update" on public.invoices;
drop policy if exists "invoices own delete" on public.invoices;
drop policy if exists "api keys own insert" on public.api_keys;
drop policy if exists "api keys own update" on public.api_keys;
drop policy if exists "api keys own delete" on public.api_keys;
drop policy if exists "calculations own insert" on public.calculations;

revoke insert, update, delete on public.payment_drafts from authenticated;
revoke insert, update, delete on public.counterparties from authenticated;
revoke insert, update, delete on public.invoices from authenticated;
revoke insert, update, delete on public.api_keys from authenticated;
revoke insert, update, delete on public.calculations from authenticated;

-- API-key hashes are server-only even for the owning account. The browser may
-- read only the metadata needed by the Developer page.
revoke select on public.api_keys from authenticated;
grant select (id,user_id,name,key_prefix,last_used_at,created_at,revoked_at) on public.api_keys to authenticated;

-- Validated payment upsert. SECURITY DEFINER is deliberate: authenticated has
-- no direct table write grants after this migration; ownership is checked here.
create or replace function public.flowpay_upsert_payment(
  p_payment_id uuid,
  p_idempotency_key text,
  p_counterparty_id uuid,
  p_supplier_name text,
  p_invoice_number text,
  p_amount numeric,
  p_currency text,
  p_due_date date,
  p_route_provider_code text,
  p_estimated_fee numeric,
  p_notes text,
  p_route_from_country text,
  p_route_to_country text,
  p_recipient_currency text,
  p_recipient_amount numeric,
  p_reference text,
  p_route_snapshot jsonb,
  p_payment_method text,
  p_charge_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result_id uuid;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if length(trim(coalesce(p_supplier_name,''))) < 1 or length(trim(p_supplier_name)) > 160 then raise exception 'INVALID_SUPPLIER' using errcode='22023'; end if;
  if length(coalesce(p_invoice_number,'')) > 120 or length(coalesce(p_reference,'')) > 160 or length(coalesce(p_notes,'')) > 4000 then raise exception 'FIELD_TOO_LONG' using errcode='22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then raise exception 'INVALID_AMOUNT' using errcode='22023'; end if;
  if length(trim(coalesce(p_currency,''))) <> 3 then raise exception 'INVALID_CURRENCY' using errcode='22023'; end if;
  if p_recipient_currency is not null and length(trim(p_recipient_currency)) <> 3 then raise exception 'INVALID_RECIPIENT_CURRENCY' using errcode='22023'; end if;
  if p_estimated_fee is not null and (p_estimated_fee < 0 or p_estimated_fee > p_amount) then raise exception 'INVALID_FEE' using errcode='22023'; end if;
  if p_recipient_amount is not null and p_recipient_amount < 0 then raise exception 'INVALID_RECIPIENT_AMOUNT' using errcode='22023'; end if;
  if length(coalesce(p_idempotency_key,'')) > 100 or length(coalesce(p_route_provider_code,'')) > 80 then raise exception 'FIELD_TOO_LONG' using errcode='22023'; end if;
  if p_route_snapshot is not null and octet_length(p_route_snapshot::text) > 65536 then raise exception 'ROUTE_SNAPSHOT_TOO_LARGE' using errcode='22023'; end if;
  if p_payment_method not in ('bank_transfer','swift','local') then raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  if p_charge_type not in ('shared','sender','recipient') then raise exception 'INVALID_CHARGE_TYPE' using errcode='22023'; end if;
  if p_counterparty_id is not null and not exists(select 1 from public.counterparties where id=p_counterparty_id and user_id=actor) then raise exception 'COUNTERPARTY_NOT_FOUND' using errcode='42501'; end if;

  if p_payment_id is null and nullif(trim(coalesce(p_idempotency_key,'')),'') is not null then
    select id into result_id from public.payment_drafts where user_id=actor and idempotency_key=trim(p_idempotency_key) limit 1;
    if result_id is not null then return result_id; end if;
  end if;

  if p_payment_id is null then
    insert into public.payment_drafts(
      user_id,idempotency_key,counterparty_id,supplier_name,invoice_number,amount,currency,due_date,
      route_provider_code,estimated_fee,notes,route_from_country,route_to_country,recipient_currency,
      recipient_amount,reference,route_snapshot,payment_method,charge_type,status
    ) values(
      actor,nullif(trim(coalesce(p_idempotency_key,'')),''),p_counterparty_id,trim(p_supplier_name),trim(coalesce(p_invoice_number,'')),p_amount,upper(trim(p_currency)),p_due_date,
      nullif(trim(coalesce(p_route_provider_code,'')),''),p_estimated_fee,trim(coalesce(p_notes,'')),nullif(upper(trim(coalesce(p_route_from_country,''))),''),nullif(upper(trim(coalesce(p_route_to_country,''))),''),nullif(upper(trim(coalesce(p_recipient_currency,''))),''),
      p_recipient_amount,trim(coalesce(p_reference,'')),p_route_snapshot,p_payment_method,p_charge_type,'draft'
    ) returning id into result_id;
  else
    update public.payment_drafts set
      counterparty_id=p_counterparty_id,
      supplier_name=trim(p_supplier_name),
      invoice_number=trim(coalesce(p_invoice_number,'')),
      amount=p_amount,
      currency=upper(trim(p_currency)),
      due_date=p_due_date,
      route_provider_code=nullif(trim(coalesce(p_route_provider_code,'')),''),
      estimated_fee=p_estimated_fee,
      notes=trim(coalesce(p_notes,'')),
      route_from_country=nullif(upper(trim(coalesce(p_route_from_country,''))),''),
      route_to_country=nullif(upper(trim(coalesce(p_route_to_country,''))),''),
      recipient_currency=nullif(upper(trim(coalesce(p_recipient_currency,''))),''),
      recipient_amount=p_recipient_amount,
      reference=trim(coalesce(p_reference,'')),
      route_snapshot=p_route_snapshot,
      payment_method=p_payment_method,
      charge_type=p_charge_type
    where id=p_payment_id and user_id=actor and status in ('draft','ready')
    returning id into result_id;
    if result_id is null then raise exception 'PAYMENT_NOT_EDITABLE' using errcode='22023'; end if;
  end if;
  return result_id;
end;
$$;
revoke all on function public.flowpay_upsert_payment(uuid,text,uuid,text,text,numeric,text,date,text,numeric,text,text,text,text,numeric,text,jsonb,text,text) from public;
grant execute on function public.flowpay_upsert_payment(uuid,text,uuid,text,text,numeric,text,date,text,numeric,text,text,text,text,numeric,text,jsonb,text,text) to authenticated;

create or replace function public.flowpay_upsert_counterparty(
  p_counterparty_id uuid,
  p_name text,
  p_country text,
  p_currency text,
  p_bank_country text,
  p_bank_name text,
  p_account_number text,
  p_account_holder text,
  p_bic text,
  p_email text,
  p_tax_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result_id uuid;
  normalized_bic text := upper(trim(coalesce(p_bic,'')));
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 1 or length(trim(p_name)) > 160 then raise exception 'INVALID_NAME' using errcode='22023'; end if;
  if length(trim(coalesce(p_country,''))) <> 2 or length(trim(coalesce(p_bank_country,''))) <> 2 then raise exception 'COUNTRY_REQUIRED' using errcode='22023'; end if;
  if length(trim(coalesce(p_currency,''))) <> 3 then raise exception 'CURRENCY_REQUIRED' using errcode='22023'; end if;
  if length(coalesce(p_bank_name,'')) > 160 or length(coalesce(p_account_number,'')) > 80 or length(coalesce(p_account_holder,'')) > 160 or length(coalesce(p_email,'')) > 254 or length(coalesce(p_tax_id,'')) > 100 then raise exception 'FIELD_TOO_LONG' using errcode='22023'; end if;
  if normalized_bic <> '' and length(normalized_bic) not in (8,11) then raise exception 'INVALID_BIC' using errcode='22023'; end if;

  if p_counterparty_id is null then
    insert into public.counterparties(user_id,name,country,currency,bank_country,bank_name,account_number,account_holder,bic,email,tax_id,verification_status)
    values(actor,trim(p_name),upper(trim(p_country)),upper(trim(p_currency)),upper(trim(p_bank_country)),trim(coalesce(p_bank_name,'')),trim(coalesce(p_account_number,'')),trim(coalesce(p_account_holder,'')),normalized_bic,lower(trim(coalesce(p_email,''))),trim(coalesce(p_tax_id,'')),'unverified')
    returning id into result_id;
  else
    update public.counterparties set
      name=trim(p_name),country=upper(trim(p_country)),currency=upper(trim(p_currency)),bank_country=upper(trim(p_bank_country)),
      bank_name=trim(coalesce(p_bank_name,'')),account_number=trim(coalesce(p_account_number,'')),account_holder=trim(coalesce(p_account_holder,'')),
      bic=normalized_bic,email=lower(trim(coalesce(p_email,''))),tax_id=trim(coalesce(p_tax_id,'')),verification_status='unverified'
    where id=p_counterparty_id and user_id=actor
    returning id into result_id;
    if result_id is null then raise exception 'COUNTERPARTY_NOT_FOUND' using errcode='42501'; end if;
  end if;
  return result_id;
end;
$$;
revoke all on function public.flowpay_upsert_counterparty(uuid,text,text,text,text,text,text,text,text,text,text) from public;
grant execute on function public.flowpay_upsert_counterparty(uuid,text,text,text,text,text,text,text,text,text,text) to authenticated;

create or replace function public.flowpay_upsert_invoice(
  p_invoice_id uuid,
  p_counterparty_id uuid,
  p_invoice_number text,
  p_supplier_name text,
  p_issue_date date,
  p_due_date date,
  p_amount numeric,
  p_currency text,
  p_reference text,
  p_notes text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  result_id uuid;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if length(trim(coalesce(p_supplier_name,''))) < 1 or length(trim(p_supplier_name)) > 160 then raise exception 'INVALID_INVOICE' using errcode='22023'; end if;
  if p_amount is null or p_amount <= 0 or p_amount > 1000000000 then raise exception 'INVALID_AMOUNT' using errcode='22023'; end if;
  if length(trim(coalesce(p_currency,''))) <> 3 then raise exception 'INVALID_CURRENCY' using errcode='22023'; end if;
  if length(coalesce(p_invoice_number,'')) > 120 or length(coalesce(p_reference,'')) > 160 or length(coalesce(p_notes,'')) > 4000 then raise exception 'FIELD_TOO_LONG' using errcode='22023'; end if;
  if p_issue_date is not null and p_due_date is not null and p_due_date < p_issue_date then raise exception 'INVALID_DATE_RANGE' using errcode='22023'; end if;
  if p_counterparty_id is not null and not exists(select 1 from public.counterparties where id=p_counterparty_id and user_id=actor) then raise exception 'COUNTERPARTY_NOT_FOUND' using errcode='42501'; end if;

  if p_invoice_id is null then
    insert into public.invoices(user_id,counterparty_id,invoice_number,supplier_name,issue_date,due_date,amount,currency,reference,notes,status)
    values(actor,p_counterparty_id,trim(coalesce(p_invoice_number,'')),trim(p_supplier_name),p_issue_date,p_due_date,p_amount,upper(trim(p_currency)),trim(coalesce(p_reference,'')),trim(coalesce(p_notes,'')),'open')
    returning id into result_id;
  else
    update public.invoices set counterparty_id=p_counterparty_id,invoice_number=trim(coalesce(p_invoice_number,'')),supplier_name=trim(p_supplier_name),issue_date=p_issue_date,due_date=p_due_date,amount=p_amount,currency=upper(trim(p_currency)),reference=trim(coalesce(p_reference,'')),notes=trim(coalesce(p_notes,''))
    where id=p_invoice_id and user_id=actor and status in ('open','scheduled')
    returning id into result_id;
    if result_id is null then raise exception 'INVOICE_NOT_EDITABLE' using errcode='22023'; end if;
  end if;
  return result_id;
end;
$$;
revoke all on function public.flowpay_upsert_invoice(uuid,uuid,text,text,date,date,numeric,text,text,text) from public;
grant execute on function public.flowpay_upsert_invoice(uuid,uuid,text,text,date,date,numeric,text,text,text) to authenticated;

create or replace function public.flowpay_set_payment_status(p_payment_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_payment public.payment_drafts%rowtype;
  now_at timestamptz := now();
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if p_status not in ('ready','paid','received','cancelled','failed') then raise exception 'INVALID_PAYMENT_STATUS' using errcode='22023'; end if;
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=actor for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
  if current_payment.status='draft' and p_status not in ('ready','cancelled') then raise exception 'INVALID_PAYMENT_TRANSITION' using errcode='22023'; end if;
  if current_payment.status='ready' and p_status not in ('paid','failed','cancelled') then raise exception 'INVALID_PAYMENT_TRANSITION' using errcode='22023'; end if;
  if current_payment.status='failed' and p_status not in ('ready','cancelled') then raise exception 'INVALID_PAYMENT_TRANSITION' using errcode='22023'; end if;
  if current_payment.status='paid' and p_status<>'received' then raise exception 'INVALID_PAYMENT_TRANSITION' using errcode='22023'; end if;
  if current_payment.status in ('received','cancelled') then raise exception 'INVALID_PAYMENT_TRANSITION' using errcode='22023'; end if;

  update public.payment_drafts set
    status=p_status,
    paid_at=case when p_status in ('paid','received') then coalesce(paid_at,now_at) when p_status in ('cancelled','failed') then null else paid_at end,
    received_at=case when p_status='received' then coalesce(received_at,now_at) when p_status in ('cancelled','failed') then null else received_at end
  where id=current_payment.id and user_id=actor;

  if p_status in ('paid','received') then
    update public.invoices set status='paid' where payment_draft_id=current_payment.id and user_id=actor and status<>'cancelled';
  elsif p_status='cancelled' then
    update public.invoices set payment_draft_id=null,status=case when status='scheduled' then 'open' else status end where payment_draft_id=current_payment.id and user_id=actor and status not in ('paid','cancelled');
  end if;
end;
$$;
revoke all on function public.flowpay_set_payment_status(uuid,text) from public;
grant execute on function public.flowpay_set_payment_status(uuid,text) to authenticated;

create or replace function public.flowpay_set_invoice_status(p_invoice_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_invoice public.invoices%rowtype;
  now_at timestamptz := now();
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if p_status not in ('paid','cancelled') then raise exception 'INVALID_INVOICE_STATUS' using errcode='22023'; end if;
  select * into current_invoice from public.invoices where id=p_invoice_id and user_id=actor for update;
  if not found then raise exception 'INVOICE_NOT_FOUND' using errcode='42501'; end if;
  if current_invoice.status='paid' and p_status<>'paid' then raise exception 'INVALID_INVOICE_TRANSITION' using errcode='22023'; end if;
  if current_invoice.status='cancelled' and p_status<>'cancelled' then raise exception 'INVALID_INVOICE_TRANSITION' using errcode='22023'; end if;
  if p_status='cancelled' and current_invoice.payment_draft_id is not null then raise exception 'INVOICE_HAS_LINKED_PAYMENT' using errcode='22023'; end if;

  update public.invoices set status=p_status where id=current_invoice.id and user_id=actor;
  if p_status='paid' and current_invoice.payment_draft_id is not null then
    update public.payment_drafts set
      status=case when status='received' then status else 'paid' end,
      paid_at=coalesce(paid_at,now_at)
    where id=current_invoice.payment_draft_id and user_id=actor and status<>'cancelled';
  end if;
end;
$$;
revoke all on function public.flowpay_set_invoice_status(uuid,text) from public;
grant execute on function public.flowpay_set_invoice_status(uuid,text) to authenticated;

create or replace function public.flowpay_link_invoice_payment(p_invoice_id uuid, p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_invoice public.invoices%rowtype;
  current_payment public.payment_drafts%rowtype;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  select * into current_invoice from public.invoices where id=p_invoice_id and user_id=actor for update;
  if not found then raise exception 'INVOICE_NOT_FOUND' using errcode='42501'; end if;
  if current_invoice.status in ('paid','cancelled') then raise exception 'INVOICE_CANNOT_BE_LINKED' using errcode='22023'; end if;
  if current_invoice.payment_draft_id is not null and current_invoice.payment_draft_id<>p_payment_id then raise exception 'INVOICE_ALREADY_LINKED' using errcode='23505'; end if;
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=actor for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
  if current_payment.status in ('paid','received','cancelled') then raise exception 'PAYMENT_CANNOT_BE_LINKED' using errcode='22023'; end if;
  if exists(select 1 from public.invoices where payment_draft_id=p_payment_id and id<>p_invoice_id and user_id=actor) then raise exception 'PAYMENT_ALREADY_LINKED' using errcode='23505'; end if;
  update public.invoices set payment_draft_id=current_payment.id,status='scheduled' where id=current_invoice.id and user_id=actor;
end;
$$;
revoke all on function public.flowpay_link_invoice_payment(uuid,uuid) from public;
grant execute on function public.flowpay_link_invoice_payment(uuid,uuid) to authenticated;

create or replace function public.flowpay_delete_payment_draft(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_payment public.payment_drafts%rowtype;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=actor for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
  if current_payment.status<>'draft' then raise exception 'ONLY_DRAFT_PAYMENT_CAN_BE_DELETED' using errcode='22023'; end if;
  update public.invoices set payment_draft_id=null,status=case when status='scheduled' then 'open' else status end where payment_draft_id=current_payment.id and user_id=actor;
  delete from public.payment_drafts where id=current_payment.id and user_id=actor;
end;
$$;
revoke all on function public.flowpay_delete_payment_draft(uuid) from public;
grant execute on function public.flowpay_delete_payment_draft(uuid) to authenticated;

create or replace function public.flowpay_delete_counterparty(p_counterparty_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_counterparty public.counterparties%rowtype;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  select * into current_counterparty from public.counterparties where id=p_counterparty_id and user_id=actor for update;
  if not found then raise exception 'COUNTERPARTY_NOT_FOUND' using errcode='42501'; end if;
  if exists(select 1 from public.payment_drafts where counterparty_id=p_counterparty_id and user_id=actor) or exists(select 1 from public.invoices where counterparty_id=p_counterparty_id and user_id=actor) then raise exception 'COUNTERPARTY_HAS_HISTORY' using errcode='23503'; end if;
  delete from public.counterparties where id=p_counterparty_id and user_id=actor;
end;
$$;
revoke all on function public.flowpay_delete_counterparty(uuid) from public;
grant execute on function public.flowpay_delete_counterparty(uuid) to authenticated;

-- Atomic CSV imports keep browser clients away from direct INSERT grants and
-- execute the whole batch in one transaction.
create or replace function public.flowpay_import_counterparties(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  item jsonb;
  total integer := 0;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_IMPORT' using errcode='22023'; end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 500 then raise exception 'INVALID_IMPORT_SIZE' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    perform public.flowpay_upsert_counterparty(
      null,
      item->>'name',item->>'country',item->>'currency',item->>'bank_country',item->>'bank_name',
      item->>'account_number',item->>'account_holder',item->>'bic',item->>'email',item->>'tax_id'
    );
    total := total + 1;
  end loop;
  return total;
end;
$$;
revoke all on function public.flowpay_import_counterparties(jsonb) from public;
grant execute on function public.flowpay_import_counterparties(jsonb) to authenticated;

create or replace function public.flowpay_import_invoices(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  item jsonb;
  total integer := 0;
  invoice_id uuid;
  requested_status text;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'INVALID_IMPORT' using errcode='22023'; end if;
  if jsonb_array_length(p_rows) < 1 or jsonb_array_length(p_rows) > 500 then raise exception 'INVALID_IMPORT_SIZE' using errcode='22023'; end if;
  for item in select value from jsonb_array_elements(p_rows) loop
    requested_status := lower(coalesce(item->>'status','open'));
    if requested_status not in ('open','paid','cancelled') then raise exception 'INVALID_IMPORT_STATUS' using errcode='22023'; end if;
    invoice_id := public.flowpay_upsert_invoice(
      null,null,item->>'invoice_number',item->>'supplier_name',
      nullif(item->>'issue_date','')::date,nullif(item->>'due_date','')::date,
      nullif(item->>'amount','')::numeric,item->>'currency',item->>'reference',item->>'notes'
    );
    if requested_status <> 'open' then
      update public.invoices set status=requested_status where id=invoice_id and user_id=actor;
    end if;
    total := total + 1;
  end loop;
  return total;
end;
$$;
revoke all on function public.flowpay_import_invoices(jsonb) from public;
grant execute on function public.flowpay_import_invoices(jsonb) to authenticated;

-- Bounded text/JSON invariants are enforced for new and changed rows even if a
-- future code path is added outside the current RPC surface.
do $$ begin
  if not exists (select 1 from pg_constraint where conname='payment_drafts_route_snapshot_size_chk') then
    alter table public.payment_drafts add constraint payment_drafts_route_snapshot_size_chk check (route_snapshot is null or octet_length(route_snapshot::text) <= 65536) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='counterparties_field_lengths_chk') then
    alter table public.counterparties add constraint counterparties_field_lengths_chk check (length(name) <= 160 and length(account_number) <= 80 and length(email) <= 254 and length(tax_id) <= 100) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname='invoices_field_lengths_chk') then
    alter table public.invoices add constraint invoices_field_lengths_chk check (length(supplier_name) <= 160 and length(invoice_number) <= 120 and length(reference) <= 160 and length(notes) <= 4000) not valid;
  end if;
end $$;

begin;
-- Company profile writes also go through validated backend/onboarding paths.
drop policy if exists "company own insert" on public.company_profiles;
drop policy if exists "company own update" on public.company_profiles;
revoke insert, update on public.company_profiles from authenticated;

drop function if exists public.flowpay_complete_onboarding(text,text,text,text);

create or replace function public.flowpay_complete_onboarding(
  p_name text,
  p_country text,
  p_currency text,
  p_timezone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 160 then raise exception 'INVALID_COMPANY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_country,''))) !~ '^[A-Z]{2}$' then raise exception 'INVALID_COUNTRY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_currency,''))) !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY' using errcode='22023'; end if;
  if length(trim(coalesce(p_timezone,''))) > 80 then raise exception 'INVALID_TIMEZONE' using errcode='22023'; end if;
  insert into public.company_profiles(user_id,name,country,preferred_currency,timezone,onboarding_completed_at)
  values(actor,trim(p_name),upper(trim(p_country)),upper(trim(p_currency)),trim(coalesce(p_timezone,'')),now())
  on conflict(user_id) do update set
    name=excluded.name,country=excluded.country,preferred_currency=excluded.preferred_currency,timezone=excluded.timezone,
    onboarding_completed_at=coalesce(public.company_profiles.onboarding_completed_at,now()),updated_at=now();
end;
$$;
revoke all on function public.flowpay_complete_onboarding(text,text,text,text) from public;
grant execute on function public.flowpay_complete_onboarding(text,text,text,text) to authenticated;
commit;

-- Provider-rule browser exposure hardening ----------------------------------
-- Signed-in clients only need a small non-pricing summary for product labels.
-- Fee/FX/limit/route-step fields remain server-only and are used by the quote engine.
revoke select on public.provider_rules from anon, authenticated;
grant select (id,provider_code,display_name,from_country,to_country,currencies,active,source_updated_at)
  on public.provider_rules to authenticated;

-- Maintenance scans need global time indexes; user-scoped indexes cannot serve
-- retention deletes efficiently because their leading column is user_id.
create index if not exists flowpay_rate_limit_counters_updated_idx
  on public.flowpay_rate_limit_counters(updated_at);
create index if not exists api_request_logs_created_at_idx
  on public.api_request_logs(created_at);
create index if not exists system_event_logs_created_at_idx
  on public.system_event_logs(created_at);

-- v1.2 used one row per request for rate limiting. v1.3 replaced it with a
-- bounded atomic counter, so remove the obsolete write-heavy event table.
drop table if exists public.flowpay_rate_limit_events;
