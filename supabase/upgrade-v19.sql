-- FlowPay v1.9.0 -----------------------------------------------------------
-- Registration hardening and legal-ledger readiness guard.
--
-- Run this migration before deploying the v1.9 application. Registration has
-- intentionally NO fallback path: if this migration is missing, /api/register
-- returns SERVICE_UNAVAILABLE before creating a Supabase Auth user.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- v1.5 used an auth.users trigger; v1.6 moved legal evidence to a server-owned
-- registration endpoint. Remove any stale copy left by a partially upgraded DB.
drop trigger if exists flowpay_record_signup_legal_acceptances on auth.users;
drop function if exists public.flowpay_record_signup_legal_acceptances();

lock table public.legal_acceptances in access exclusive mode;

do $$
declare constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_catalog.pg_constraint c
    where c.conrelid='public.legal_acceptances'::regclass
      and c.contype='c'
      and pg_catalog.pg_get_constraintdef(c.oid) ilike '%source%'
  loop
    execute format('alter table public.legal_acceptances drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.legal_acceptances alter column source set default 'registration_server';
update public.legal_acceptances set source='legacy_registration' where source='registration';
alter table public.legal_acceptances add constraint legal_acceptances_source_check
  check (source in ('registration_server','reacceptance','legacy_registration')) not valid;
alter table public.legal_acceptances validate constraint legal_acceptances_source_check;

-- One server-only RPC writes both legal receipts in a single database
-- transaction. No browser-controlled metadata and no alternate receipt source.
create or replace function public.flowpay_record_registration_legal(
  p_user_id uuid,
  p_privacy_version text,
  p_terms_version text,
  p_locale text,
  p_accepted_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  accepted_at_value timestamptz := coalesce(p_accepted_at, clock_timestamp());
begin
  if p_user_id is null then
    raise exception 'REGISTRATION_USER_REQUIRED' using errcode='22023';
  end if;
  if not exists(select 1 from auth.users where id=p_user_id) then
    raise exception 'REGISTRATION_USER_NOT_FOUND' using errcode='22023';
  end if;
  if coalesce(p_privacy_version,'') !~ '^\d{4}-\d{2}-\d{2}$'
     or coalesce(p_terms_version,'') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'INVALID_LEGAL_VERSION' using errcode='22023';
  end if;
  if trim(coalesce(p_locale,'')) not in ('ru','en','fr','de','es') then
    raise exception 'INVALID_LEGAL_LOCALE' using errcode='22023';
  end if;

  insert into public.legal_acceptances(
    user_id, document_type, document_version, action, locale, source, accepted_at
  ) values (
    p_user_id, 'privacy', p_privacy_version, 'acknowledged', trim(p_locale), 'registration_server', accepted_at_value
  ) on conflict(user_id,document_type,document_version) do nothing;

  insert into public.legal_acceptances(
    user_id, document_type, document_version, action, locale, source, accepted_at
  ) values (
    p_user_id, 'terms', p_terms_version, 'accepted', trim(p_locale), 'registration_server', accepted_at_value
  ) on conflict(user_id,document_type,document_version) do nothing;

  if not exists(
    select 1 from public.legal_acceptances
    where user_id=p_user_id and document_type='privacy' and document_version=p_privacy_version
      and action='acknowledged' and source='registration_server'
  ) or not exists(
    select 1 from public.legal_acceptances
    where user_id=p_user_id and document_type='terms' and document_version=p_terms_version
      and action='accepted' and source='registration_server'
  ) then
    raise exception 'LEGAL_RECEIPT_CONFLICT' using errcode='23514';
  end if;
end;
$$;
revoke all on function public.flowpay_record_registration_legal(uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.flowpay_record_registration_legal(uuid,text,text,text,timestamptz) to service_role;

-- Tiny service-role preflight used before auth.signUp. The application refuses
-- registration when the production legal schema is not ready.
create or replace function public.flowpay_registration_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from pg_catalog.pg_constraint c
    where c.conrelid='public.legal_acceptances'::regclass
      and c.contype='c'
      and pg_catalog.pg_get_constraintdef(c.oid) ilike '%registration_server%'
  );
$$;
revoke all on function public.flowpay_registration_ready() from public, anon, authenticated;
grant execute on function public.flowpay_registration_ready() to service_role;

commit;
