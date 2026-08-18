-- FlowPay 2.0 — Operations control plane, payment approvals and policy gates.
-- Apply BEFORE deploying the v2.0 application bundle.

alter table public.company_profiles add column if not exists approval_enabled boolean not null default false;
alter table public.company_profiles add column if not exists approval_threshold numeric(14,2) not null default 10000;
alter table public.company_profiles add column if not exists approval_currency text not null default '';
update public.company_profiles set approval_currency = preferred_currency where approval_currency = '' and preferred_currency <> '';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'company_profiles_approval_threshold_chk') then
    alter table public.company_profiles add constraint company_profiles_approval_threshold_chk check (approval_threshold >= 0 and approval_threshold <= 1000000000) not valid;
  end if;
end $$;

alter table public.payment_drafts add column if not exists approval_status text not null default 'not_required';
alter table public.payment_drafts add column if not exists approval_requested_at timestamptz;
alter table public.payment_drafts add column if not exists approval_decided_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_drafts_approval_status_chk') then
    alter table public.payment_drafts add constraint payment_drafts_approval_status_chk
      check (approval_status in ('not_required','required','pending','approved','rejected')) not valid;
  end if;
end $$;

create table if not exists public.payment_approval_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null references public.payment_drafts(id) on delete cascade,
  event text not null check (event in ('requested','approved','rejected')),
  note text not null default '',
  payment_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.payment_approval_events add column if not exists payment_snapshot jsonb not null default '{}'::jsonb;

alter table public.payment_approval_events enable row level security;
alter table public.payment_approval_events force row level security;
drop policy if exists "approval events own read" on public.payment_approval_events;
create policy "approval events own read" on public.payment_approval_events for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "approval events aal2 gate" on public.payment_approval_events;
create policy "approval events aal2 gate" on public.payment_approval_events
  as restrictive for select to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2');
revoke insert, update, delete on public.payment_approval_events from authenticated;
create index if not exists payment_approval_events_user_created_idx on public.payment_approval_events(user_id, created_at desc);
create index if not exists payment_approval_events_payment_created_idx on public.payment_approval_events(payment_id, created_at desc);
create index if not exists payment_drafts_user_approval_idx on public.payment_drafts(user_id, approval_status, updated_at desc);

-- A policy decision never relies on an invented FX rate. If the payment currency differs
-- from the policy currency, approval is conservatively required while the policy is enabled.
create or replace function public.flowpay_apply_payment_approval_policy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  enabled boolean := false;
  threshold numeric := 0;
  policy_currency text := '';
  material_change boolean := true;
begin
  if tg_op = 'UPDATE' then
    material_change := new.supplier_name is distinct from old.supplier_name
      or new.invoice_number is distinct from old.invoice_number
      or new.amount is distinct from old.amount
      or new.currency is distinct from old.currency
      or new.due_date is distinct from old.due_date
      or new.counterparty_id is distinct from old.counterparty_id
      or new.route_provider_code is distinct from old.route_provider_code
      or new.estimated_fee is distinct from old.estimated_fee
      or new.route_snapshot is distinct from old.route_snapshot
      or new.route_from_country is distinct from old.route_from_country
      or new.route_to_country is distinct from old.route_to_country
      or new.recipient_currency is distinct from old.recipient_currency
      or new.recipient_amount is distinct from old.recipient_amount
      or new.payment_method is distinct from old.payment_method
      or new.charge_type is distinct from old.charge_type
      or new.reference is distinct from old.reference;
  end if;

  if not material_change then return new; end if;

  select coalesce(p.approval_enabled,false), coalesce(p.approval_threshold,0), upper(coalesce(nullif(p.approval_currency,''),p.preferred_currency,''))
    into enabled, threshold, policy_currency
  from public.company_profiles p where p.user_id = new.user_id;

  if enabled and (policy_currency = '' or upper(new.currency) <> policy_currency or new.amount >= threshold) then
    new.approval_status := 'required';
    new.approval_requested_at := null;
    new.approval_decided_at := null;
  else
    new.approval_status := 'not_required';
    new.approval_requested_at := null;
    new.approval_decided_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists flowpay_payment_approval_policy on public.payment_drafts;
create trigger flowpay_payment_approval_policy
before insert or update on public.payment_drafts
for each row execute function public.flowpay_apply_payment_approval_policy();

create or replace function public.flowpay_request_payment_approval(p_payment_id uuid, p_note text default '')
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
  if length(coalesce(p_note,'')) > 500 then raise exception 'NOTE_TOO_LONG' using errcode='22023'; end if;
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=actor for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
  if current_payment.status not in ('draft','ready','failed') then raise exception 'PAYMENT_NOT_APPROVABLE' using errcode='22023'; end if;
  if current_payment.approval_status not in ('required','rejected') then raise exception 'APPROVAL_NOT_REQUIRED' using errcode='22023'; end if;

  update public.payment_drafts
  set approval_status='pending', approval_requested_at=clock_timestamp(), approval_decided_at=null
  where id=current_payment.id and user_id=actor;

  insert into public.payment_approval_events(user_id,payment_id,event,note,payment_snapshot)
  values(actor,current_payment.id,'requested',trim(coalesce(p_note,'')),jsonb_build_object(
    'supplier_name', current_payment.supplier_name,
    'invoice_number', current_payment.invoice_number,
    'amount', current_payment.amount,
    'currency', current_payment.currency,
    'due_date', current_payment.due_date,
    'counterparty_id', current_payment.counterparty_id,
    'route_provider_code', current_payment.route_provider_code,
    'route_from_country', current_payment.route_from_country,
    'route_to_country', current_payment.route_to_country,
    'recipient_currency', current_payment.recipient_currency,
    'recipient_amount', current_payment.recipient_amount,
    'estimated_fee', current_payment.estimated_fee,
    'payment_method', current_payment.payment_method,
    'charge_type', current_payment.charge_type,
    'reference', current_payment.reference
  ));
end;
$$;
revoke all on function public.flowpay_request_payment_approval(uuid,text) from public, anon;
grant execute on function public.flowpay_request_payment_approval(uuid,text) to authenticated;

create or replace function public.flowpay_decide_payment_approval(p_payment_id uuid, p_decision text, p_note text default '')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  current_payment public.payment_drafts%rowtype;
  event_name text;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  perform public.flowpay_require_aal2();
  if p_decision not in ('approved','rejected') then raise exception 'INVALID_APPROVAL_DECISION' using errcode='22023'; end if;
  if length(coalesce(p_note,'')) > 500 then raise exception 'NOTE_TOO_LONG' using errcode='22023'; end if;
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=actor for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
  if current_payment.status not in ('draft','ready','failed') then raise exception 'PAYMENT_NOT_APPROVABLE' using errcode='22023'; end if;
  if current_payment.approval_status <> 'pending' then raise exception 'APPROVAL_NOT_PENDING' using errcode='22023'; end if;

  update public.payment_drafts
  set approval_status=p_decision, approval_decided_at=clock_timestamp()
  where id=current_payment.id and user_id=actor;

  event_name := case when p_decision='approved' then 'approved' else 'rejected' end;
  insert into public.payment_approval_events(user_id,payment_id,event,note,payment_snapshot)
  values(actor,current_payment.id,event_name,trim(coalesce(p_note,'')),jsonb_build_object(
    'supplier_name', current_payment.supplier_name,
    'invoice_number', current_payment.invoice_number,
    'amount', current_payment.amount,
    'currency', current_payment.currency,
    'due_date', current_payment.due_date,
    'counterparty_id', current_payment.counterparty_id,
    'route_provider_code', current_payment.route_provider_code,
    'route_from_country', current_payment.route_from_country,
    'route_to_country', current_payment.route_to_country,
    'recipient_currency', current_payment.recipient_currency,
    'recipient_amount', current_payment.recipient_amount,
    'estimated_fee', current_payment.estimated_fee,
    'payment_method', current_payment.payment_method,
    'charge_type', current_payment.charge_type,
    'reference', current_payment.reference
  ));
end;
$$;
revoke all on function public.flowpay_decide_payment_approval(uuid,text,text) from public, anon;
grant execute on function public.flowpay_decide_payment_approval(uuid,text,text) to authenticated;

create or replace function public.flowpay_update_profile_v2(
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
  p_notify_weekly_reports boolean,
  p_approval_enabled boolean,
  p_approval_threshold numeric
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  policy_currency text;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  perform public.flowpay_require_aal2();
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 160 then raise exception 'INVALID_COMPANY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_country,''))) !~ '^[A-Z]{2}$' then raise exception 'INVALID_COUNTRY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_preferred_currency,''))) !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY' using errcode='22023'; end if;
  if length(coalesce(p_registration_number,'')) > 100 or length(coalesce(p_business_address,'')) > 300 then raise exception 'FIELD_TOO_LONG' using errcode='22023'; end if;
  if p_default_payment_method not in ('bank_transfer','swift','local') then raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  if p_default_charge_type not in ('shared','sender','recipient') then raise exception 'INVALID_CHARGE_TYPE' using errcode='22023'; end if;
  if p_approval_threshold is null or p_approval_threshold < 0 or p_approval_threshold > 1000000000 then raise exception 'INVALID_APPROVAL_THRESHOLD' using errcode='22023'; end if;
  policy_currency := upper(trim(p_preferred_currency));

  update public.company_profiles set
    name=trim(p_name),
    country=upper(trim(p_country)),
    preferred_currency=policy_currency,
    registration_number=trim(coalesce(p_registration_number,'')),
    business_address=trim(coalesce(p_business_address,'')),
    default_payment_method=p_default_payment_method,
    default_charge_type=p_default_charge_type,
    beneficiary_notifications=coalesce(p_beneficiary_notifications,true),
    notify_payment_confirmations=coalesce(p_notify_payment_confirmations,true),
    notify_payment_failures=coalesce(p_notify_payment_failures,true),
    notify_security_alerts=coalesce(p_notify_security_alerts,true),
    notify_weekly_reports=coalesce(p_notify_weekly_reports,false),
    approval_enabled=coalesce(p_approval_enabled,false),
    approval_threshold=p_approval_threshold,
    approval_currency=policy_currency,
    updated_at=clock_timestamp()
  where user_id=actor;
  if not found then raise exception 'PROFILE_NOT_FOUND' using errcode='22023'; end if;

  -- Re-evaluate active, not-yet-approved payments when the policy changes.
  update public.payment_drafts d set
    approval_status = case
      when d.approval_status='approved' then 'approved'
      when not coalesce(p_approval_enabled,false) then 'not_required'
      when upper(d.currency) <> policy_currency or d.amount >= p_approval_threshold then 'required'
      else 'not_required'
    end,
    approval_requested_at = case when d.approval_status='approved' then d.approval_requested_at else null end,
    approval_decided_at = case when d.approval_status='approved' then d.approval_decided_at else null end
  where d.user_id=actor and d.status in ('draft','ready','failed');
end;
$$;
revoke all on function public.flowpay_update_profile_v2(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,numeric) from public, anon;
grant execute on function public.flowpay_update_profile_v2(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,numeric) to authenticated;

-- Override the transition function with an approval gate. Status writes remain transactional.
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

  if p_status in ('ready','paid') and current_payment.approval_status in ('required','pending') then
    raise exception 'PAYMENT_APPROVAL_REQUIRED' using errcode='22023';
  end if;
  if p_status in ('ready','paid') and current_payment.approval_status='rejected' then
    raise exception 'PAYMENT_APPROVAL_REJECTED' using errcode='22023';
  end if;

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
