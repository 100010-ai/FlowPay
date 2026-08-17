-- FlowPay 1.6 — mandatory MFA, least privilege and API credential hardening
-- Run after upgrade-v15.sql. This migration does not inspect or modify env values.
-- AAL2 is enforced in Postgres so an aal1 JWT cannot bypass the application UI.
-- Deadlock-safe R2: lock-heavy DDL is committed in short, table-scoped transactions.
-- Safe to rerun after a failed v1.6 attempt; statements are idempotent by design.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Public schema is usable by API roles but cannot be used by browser roles to
-- create shadow objects/functions that could later be referenced accidentally.
revoke create on schema public from public, anon, authenticated;
revoke usage on schema public from public, anon;
grant usage on schema public to authenticated, service_role;
alter default privileges in schema public revoke execute on functions from public;

create or replace function public.flowpay_require_aal2()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'MFA_REQUIRED' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.flowpay_require_aal2() from public, anon;
grant execute on function public.flowpay_require_aal2() to authenticated;

commit;

-- Every sensitive workspace table requires an AAL2 JWT even for SELECT. Existing
-- ownership policies still apply; this is an additional RESTRICTIVE gate.
-- Each table is handled in its own transaction. The ACCESS EXCLUSIVE lock is
-- acquired first, so this migration never accumulates strong locks on multiple
-- workspace tables while waiting for live application queries.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.calculations in access exclusive mode;
alter table public.calculations enable row level security;
alter table public.calculations force row level security;
drop policy if exists "mfa aal2 gate" on public.calculations;
create policy "mfa aal2 gate" on public.calculations
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.audit_requests in access exclusive mode;
alter table public.audit_requests enable row level security;
alter table public.audit_requests force row level security;
drop policy if exists "mfa aal2 gate" on public.audit_requests;
create policy "mfa aal2 gate" on public.audit_requests
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.company_profiles in access exclusive mode;
alter table public.company_profiles enable row level security;
alter table public.company_profiles force row level security;
drop policy if exists "mfa aal2 gate" on public.company_profiles;
create policy "mfa aal2 gate" on public.company_profiles
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.counterparties in access exclusive mode;
alter table public.counterparties enable row level security;
alter table public.counterparties force row level security;
drop policy if exists "mfa aal2 gate" on public.counterparties;
create policy "mfa aal2 gate" on public.counterparties
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.payment_drafts in access exclusive mode;
alter table public.payment_drafts enable row level security;
alter table public.payment_drafts force row level security;
drop policy if exists "mfa aal2 gate" on public.payment_drafts;
create policy "mfa aal2 gate" on public.payment_drafts
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.api_keys in access exclusive mode;
alter table public.api_keys enable row level security;
alter table public.api_keys force row level security;
drop policy if exists "mfa aal2 gate" on public.api_keys;
create policy "mfa aal2 gate" on public.api_keys
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.workspace_invitations in access exclusive mode;
alter table public.workspace_invitations enable row level security;
alter table public.workspace_invitations force row level security;
drop policy if exists "mfa aal2 gate" on public.workspace_invitations;
create policy "mfa aal2 gate" on public.workspace_invitations
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.invoices in access exclusive mode;
alter table public.invoices enable row level security;
alter table public.invoices force row level security;
drop policy if exists "mfa aal2 gate" on public.invoices;
create policy "mfa aal2 gate" on public.invoices
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.api_request_logs in access exclusive mode;
alter table public.api_request_logs enable row level security;
alter table public.api_request_logs force row level security;
drop policy if exists "mfa aal2 gate" on public.api_request_logs;
create policy "mfa aal2 gate" on public.api_request_logs
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.workspace_audit_log in access exclusive mode;
alter table public.workspace_audit_log enable row level security;
alter table public.workspace_audit_log force row level security;
drop policy if exists "mfa aal2 gate" on public.workspace_audit_log;
create policy "mfa aal2 gate" on public.workspace_audit_log
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '60s';
lock table public.api_usage_daily in access exclusive mode;
alter table public.api_usage_daily enable row level security;
alter table public.api_usage_daily force row level security;
drop policy if exists "mfa aal2 gate" on public.api_usage_daily;
create policy "mfa aal2 gate" on public.api_usage_daily
  as restrictive for all to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2')
  with check ((select auth.jwt()->>'aal') = 'aal2');
commit;

-- Team invitations are not exposed as a direct browser write surface in v1.6.
begin;
set local lock_timeout = '10s';
lock table public.workspace_invitations in access exclusive mode;
drop policy if exists "workspace invitations own insert" on public.workspace_invitations;
drop policy if exists "workspace invitations own update" on public.workspace_invitations;
drop policy if exists "workspace invitations own delete" on public.workspace_invitations;
revoke insert, update, delete on public.workspace_invitations from authenticated;
commit;

-- API credentials are least-privilege and short-lived. Existing active keys get
-- a fresh 90-day migration window rather than being invalidated immediately.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
lock table public.api_keys in access exclusive mode;
alter table public.api_keys add column if not exists scope text;
alter table public.api_keys add column if not exists expires_at timestamptz;
update public.api_keys set scope='quote:read' where scope is null or trim(scope)='';
update public.api_keys set expires_at=clock_timestamp()+interval '90 days' where expires_at is null and revoked_at is null;
update public.api_keys set expires_at=greatest(created_at + interval '1 second', clock_timestamp()) where expires_at is null;
alter table public.api_keys alter column scope set default 'quote:read';
alter table public.api_keys alter column scope set not null;
alter table public.api_keys alter column expires_at set default (now()+interval '90 days');
alter table public.api_keys alter column expires_at set not null;
do $$ begin
  if not exists(select 1 from pg_constraint where conname='api_keys_scope_chk') then
    alter table public.api_keys add constraint api_keys_scope_chk check(scope in ('quote:read')) not valid;
  end if;
  if not exists(select 1 from pg_constraint where conname='api_keys_expiry_chk') then
    alter table public.api_keys add constraint api_keys_expiry_chk check(expires_at > created_at) not valid;
  end if;
end $$;
alter table public.api_keys validate constraint api_keys_scope_chk;
alter table public.api_keys validate constraint api_keys_expiry_chk;
create index if not exists api_keys_hash_state_idx on public.api_keys(key_hash,revoked_at,expires_at);
revoke select on public.api_keys from authenticated;
grant select (id,user_id,name,key_prefix,scope,expires_at,last_used_at,created_at,revoked_at) on public.api_keys to authenticated;

commit;

-- Legal evidence must be minted by FlowPay's same-origin registration endpoint,
-- not from caller-controlled Auth user_metadata. Existing v1.5 metadata-backed
-- receipts are preserved as legacy evidence but are NOT promoted to trusted
-- registration receipts; incomplete legacy accounts must use the v1.6 legal flow.
begin;
set local lock_timeout = '10s';
drop trigger if exists flowpay_record_signup_legal_acceptances on auth.users;
drop function if exists public.flowpay_record_signup_legal_acceptances();
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
lock table public.legal_acceptances in access exclusive mode;
do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid='public.legal_acceptances'::regclass
      and c.contype='c'
      and pg_get_constraintdef(c.oid) ilike '%source%'
  loop
    execute format('alter table public.legal_acceptances drop constraint %I',constraint_name);
  end loop;
end $$;
alter table public.legal_acceptances alter column source set default 'registration_server';
update public.legal_acceptances set source='legacy_registration' where source='registration';
alter table public.legal_acceptances add constraint legal_acceptances_source_check
  check (source in ('registration_server','reacceptance','legacy_registration')) not valid;
alter table public.legal_acceptances validate constraint legal_acceptances_source_check;

commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
-- This minimal status RPC is intentionally available at AAL1 so login can decide
-- whether onboarding must run without exposing the company profile row.
create or replace function public.flowpay_onboarding_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.company_profiles
    where user_id=auth.uid() and onboarding_completed_at is not null
  );
$$;
revoke all on function public.flowpay_onboarding_status() from public, anon;
grant execute on function public.flowpay_onboarding_status() to authenticated;


-- Onboarding requires receipts for the current legal documents. The signup
-- trigger writes these receipts using server time; incomplete accounts cannot
-- enter the financial workspace.
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
declare
  actor uuid := auth.uid();
  touched_user uuid;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if not exists(
    select 1 from public.legal_acceptances
    where user_id=actor and document_type='privacy' and document_version='2026-08-17' and action='acknowledged' and source='registration_server'
  ) or not exists(
    select 1 from public.legal_acceptances
    where user_id=actor and document_type='terms' and document_version='2026-08-17' and action='accepted' and source='registration_server'
  ) then
    raise exception 'LEGAL_ACCEPTANCE_REQUIRED' using errcode='42501';
  end if;
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 160 then raise exception 'INVALID_COMPANY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_country,''))) !~ '^[A-Z]{2}$' then raise exception 'INVALID_COUNTRY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_currency,''))) !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY' using errcode='22023'; end if;
  if length(trim(coalesce(p_timezone,''))) > 80 then raise exception 'INVALID_TIMEZONE' using errcode='22023'; end if;
  insert into public.company_profiles(user_id,name,country,preferred_currency,timezone,onboarding_completed_at)
  values(actor,trim(p_name),upper(trim(p_country)),upper(trim(p_currency)),trim(coalesce(p_timezone,'')),now())
  on conflict(user_id) do update set
    name=excluded.name,country=excluded.country,preferred_currency=excluded.preferred_currency,timezone=excluded.timezone,
    onboarding_completed_at=now(),updated_at=now()
  where public.company_profiles.onboarding_completed_at is null
  returning user_id into touched_user;
  if touched_user is null then
    raise exception 'ONBOARDING_ALREADY_COMPLETED' using errcode='42501';
  end if;
end;
$$;
revoke all on function public.flowpay_complete_onboarding(text,text,text,text) from public, anon;
grant execute on function public.flowpay_complete_onboarding(text,text,text,text) to authenticated;

-- Profile updates are AAL2-only and validated inside Postgres. Onboarding remains
-- a separate AAL1 bootstrap operation and cannot change advanced account fields.
create or replace function public.flowpay_update_profile(
  p_name text,
  p_country text,
  p_preferred_currency text,
  p_registration_number text,
  p_business_address text,
  p_default_payment_method text,
  p_default_charge_type text,
  p_beneficiary_notifications boolean,
  p_notify_payment_confirmations boolean,
  p_notify_payment_failures boolean,
  p_notify_security_alerts boolean,
  p_notify_weekly_reports boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  perform public.flowpay_require_aal2();
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 160 then raise exception 'INVALID_COMPANY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_country,''))) !~ '^[A-Z]{2}$' then raise exception 'INVALID_COUNTRY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_preferred_currency,''))) !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY' using errcode='22023'; end if;
  if length(coalesce(p_registration_number,'')) > 100 or length(coalesce(p_business_address,'')) > 300 then raise exception 'FIELD_TOO_LONG' using errcode='22023'; end if;
  if p_default_payment_method not in ('bank_transfer','swift','local') then raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  if p_default_charge_type not in ('shared','sender','recipient') then raise exception 'INVALID_CHARGE_TYPE' using errcode='22023'; end if;
  update public.company_profiles set
    name=trim(p_name),
    country=upper(trim(p_country)),
    preferred_currency=upper(trim(p_preferred_currency)),
    registration_number=trim(coalesce(p_registration_number,'')),
    business_address=trim(coalesce(p_business_address,'')),
    default_payment_method=p_default_payment_method,
    default_charge_type=p_default_charge_type,
    beneficiary_notifications=coalesce(p_beneficiary_notifications,true),
    notify_payment_confirmations=coalesce(p_notify_payment_confirmations,true),
    notify_payment_failures=coalesce(p_notify_payment_failures,true),
    notify_security_alerts=coalesce(p_notify_security_alerts,true),
    notify_weekly_reports=coalesce(p_notify_weekly_reports,false),
    updated_at=clock_timestamp()
  where user_id=actor;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='22023'; end if;
end;
$$;
revoke all on function public.flowpay_update_profile(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean) from public, anon;
grant execute on function public.flowpay_update_profile(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean) to authenticated;

commit;

-- Browser table writes stay revoked; mutations go through validated RPCs below.
begin;
set local lock_timeout = '10s';
lock table public.payment_drafts in access exclusive mode;
revoke insert, update, delete on public.payment_drafts from authenticated;
commit;
begin;
set local lock_timeout = '10s';
lock table public.counterparties in access exclusive mode;
revoke insert, update, delete on public.counterparties from authenticated;
commit;
begin;
set local lock_timeout = '10s';
lock table public.invoices in access exclusive mode;
revoke insert, update, delete on public.invoices from authenticated;
commit;
begin;
set local lock_timeout = '10s';
lock table public.api_keys in access exclusive mode;
revoke insert, update, delete on public.api_keys from authenticated;
commit;
begin;
set local lock_timeout = '10s';
lock table public.calculations in access exclusive mode;
revoke insert, update, delete on public.calculations from authenticated;
commit;
begin;
set local lock_timeout = '10s';
lock table public.company_profiles in access exclusive mode;
revoke insert, update on public.company_profiles from authenticated;
commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '180s';

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
  perform public.flowpay_require_aal2();
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
  perform public.flowpay_require_aal2();
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
  perform public.flowpay_require_aal2();
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
  perform public.flowpay_require_aal2();
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
  perform public.flowpay_require_aal2();
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
  perform public.flowpay_require_aal2();
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
  perform public.flowpay_require_aal2();
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
  perform public.flowpay_require_aal2();
  select * into current_counterparty from public.counterparties where id=p_counterparty_id and user_id=actor for update;
  if not found then raise exception 'COUNTERPARTY_NOT_FOUND' using errcode='42501'; end if;
  if exists(select 1 from public.payment_drafts where counterparty_id=p_counterparty_id and user_id=actor) or exists(select 1 from public.invoices where counterparty_id=p_counterparty_id and user_id=actor) then raise exception 'COUNTERPARTY_HAS_HISTORY' using errcode='23503'; end if;
  delete from public.counterparties where id=p_counterparty_id and user_id=actor;
end;
$$;
revoke all on function public.flowpay_delete_counterparty(uuid) from public;
grant execute on function public.flowpay_delete_counterparty(uuid) to authenticated;


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
  perform public.flowpay_require_aal2();
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
  perform public.flowpay_require_aal2();
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

commit;

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
-- Revoke callable access to every FlowPay function first, including legacy
-- trigger helpers. Then grant only the explicit RPC allowlist. This prevents an
-- older SECURITY DEFINER function from retaining PostgreSQL's default PUBLIC
-- EXECUTE privilege.
do $$
declare fn regprocedure;
begin
  for fn in
    select p.oid::regprocedure
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname like 'flowpay_%'
  loop
    execute format('revoke all on function %s from public, anon, authenticated',fn);
  end loop;
end $$;

grant execute on function public.flowpay_require_aal2() to authenticated;
grant execute on function public.flowpay_onboarding_status() to authenticated;
grant execute on function public.flowpay_complete_onboarding(text,text,text,text) to authenticated;
grant execute on function public.flowpay_update_profile(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean) to authenticated;
grant execute on function public.flowpay_upsert_payment(uuid,text,uuid,text,text,numeric,text,date,text,numeric,text,text,text,text,numeric,text,jsonb,text,text) to authenticated;
grant execute on function public.flowpay_upsert_counterparty(uuid,text,text,text,text,text,text,text,text,text,text) to authenticated;
grant execute on function public.flowpay_upsert_invoice(uuid,uuid,text,text,date,date,numeric,text,text,text) to authenticated;
grant execute on function public.flowpay_set_payment_status(uuid,text) to authenticated;
grant execute on function public.flowpay_set_invoice_status(uuid,text) to authenticated;
grant execute on function public.flowpay_link_invoice_payment(uuid,uuid) to authenticated;
grant execute on function public.flowpay_delete_payment_draft(uuid) to authenticated;
grant execute on function public.flowpay_delete_counterparty(uuid) to authenticated;
grant execute on function public.flowpay_import_counterparties(jsonb) to authenticated;
grant execute on function public.flowpay_import_invoices(jsonb) to authenticated;

grant execute on function public.flowpay_check_rate_limit(text,text,integer,integer) to service_role;
grant execute on function public.flowpay_record_api_usage(uuid,text,integer,integer) to service_role;
grant execute on function public.flowpay_prune_operational_data() to service_role;
commit;

reset lock_timeout;
reset statement_timeout;

