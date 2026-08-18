-- FlowPay 2.1 — Settlement reconciliation, payment event ledger, bulk operations and explicit approval currency.
-- Apply AFTER upgrade-v20.sql and BEFORE deploying the v2.1 application bundle.

alter table public.payment_drafts add column if not exists priority text not null default 'normal';
alter table public.payment_drafts add column if not exists reconciliation_status text not null default 'not_ready';
alter table public.payment_drafts add column if not exists reconciliation_reference text not null default '';
alter table public.payment_drafts add column if not exists reconciliation_note text not null default '';
alter table public.payment_drafts add column if not exists actual_fee numeric(14,2);
alter table public.payment_drafts add column if not exists actual_recipient_amount numeric(14,2);
alter table public.payment_drafts add column if not exists reconciled_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'payment_drafts_priority_chk') then
    alter table public.payment_drafts add constraint payment_drafts_priority_chk
      check (priority in ('low','normal','high','urgent')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_drafts_reconciliation_status_chk') then
    alter table public.payment_drafts add constraint payment_drafts_reconciliation_status_chk
      check (reconciliation_status in ('not_ready','unmatched','matched','needs_review')) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_drafts_actual_fee_chk') then
    alter table public.payment_drafts add constraint payment_drafts_actual_fee_chk
      check (actual_fee is null or actual_fee >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'payment_drafts_actual_recipient_amount_chk') then
    alter table public.payment_drafts add constraint payment_drafts_actual_recipient_amount_chk
      check (actual_recipient_amount is null or actual_recipient_amount >= 0) not valid;
  end if;
end $$;

update public.payment_drafts
set reconciliation_status = case when status in ('paid','received') then 'unmatched' else 'not_ready' end
where reconciliation_status = 'not_ready' and status in ('paid','received');

create index if not exists payment_drafts_user_reconciliation_idx
  on public.payment_drafts(user_id, reconciliation_status, updated_at desc);
create index if not exists payment_drafts_user_priority_idx
  on public.payment_drafts(user_id, priority, due_date, updated_at desc);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payment_id uuid not null references public.payment_drafts(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event text not null check (event in ('created','updated','status_changed','approval_changed','reconciliation_changed','priority_changed')),
  from_value text,
  to_value text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.payment_events enable row level security;
alter table public.payment_events force row level security;
drop policy if exists "payment events own read" on public.payment_events;
create policy "payment events own read" on public.payment_events
  for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "payment events aal2 gate" on public.payment_events;
create policy "payment events aal2 gate" on public.payment_events
  as restrictive for select to authenticated
  using ((select auth.jwt()->>'aal') = 'aal2');
revoke insert, update, delete on public.payment_events from authenticated;
create index if not exists payment_events_user_created_idx on public.payment_events(user_id, created_at desc);
create index if not exists payment_events_payment_created_idx on public.payment_events(payment_id, created_at desc);

insert into public.payment_events(user_id,payment_id,actor_user_id,event,metadata,created_at)
select d.user_id,d.id,null,'created',jsonb_build_object('source','migration_backfill'),d.created_at
from public.payment_drafts d
where not exists (
  select 1 from public.payment_events e where e.payment_id=d.id and e.event='created'
);

create or replace function public.flowpay_sync_reconciliation_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if new.status in ('paid','received') and old.status not in ('paid','received') and old.reconciliation_status='not_ready' then
      new.reconciliation_status := 'unmatched';
    elsif new.status not in ('paid','received') then
      new.reconciliation_status := 'not_ready';
      new.reconciliation_reference := '';
      new.reconciliation_note := '';
      new.actual_fee := null;
      new.actual_recipient_amount := null;
      new.reconciled_at := null;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists flowpay_payment_reconciliation_state on public.payment_drafts;
create trigger flowpay_payment_reconciliation_state
before update of status on public.payment_drafts
for each row execute function public.flowpay_sync_reconciliation_state();

create or replace function public.flowpay_log_payment_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text := 'updated';
  before_value text := null;
  after_value text := null;
  payload jsonb := '{}'::jsonb;
begin
  if tg_op='INSERT' then
    event_name := 'created';
    payload := jsonb_build_object('status',new.status,'priority',new.priority);
  elsif new.status is distinct from old.status then
    event_name := 'status_changed';
    before_value := old.status;
    after_value := new.status;
    payload := jsonb_build_object('paid_at',new.paid_at,'received_at',new.received_at);
  elsif new.approval_status is distinct from old.approval_status then
    event_name := 'approval_changed';
    before_value := old.approval_status;
    after_value := new.approval_status;
  elsif new.reconciliation_status is distinct from old.reconciliation_status
     or new.reconciliation_reference is distinct from old.reconciliation_reference
     or new.actual_fee is distinct from old.actual_fee
     or new.actual_recipient_amount is distinct from old.actual_recipient_amount then
    event_name := 'reconciliation_changed';
    before_value := old.reconciliation_status;
    after_value := new.reconciliation_status;
    payload := jsonb_build_object(
      'reference_present',length(trim(coalesce(new.reconciliation_reference,'')))>0,
      'actual_fee',new.actual_fee,
      'actual_recipient_amount',new.actual_recipient_amount
    );
  elsif new.priority is distinct from old.priority then
    event_name := 'priority_changed';
    before_value := old.priority;
    after_value := new.priority;
  else
    payload := jsonb_build_object('material_update',true);
  end if;

  insert into public.payment_events(user_id,payment_id,actor_user_id,event,from_value,to_value,metadata)
  values(new.user_id,new.id,auth.uid(),event_name,before_value,after_value,payload);
  return new;
end;
$$;

drop trigger if exists flowpay_payment_event_log on public.payment_drafts;
create trigger flowpay_payment_event_log
after insert or update on public.payment_drafts
for each row execute function public.flowpay_log_payment_event();

create or replace function public.flowpay_reconcile_payment(
  p_payment_id uuid,
  p_status text,
  p_reference text default '',
  p_actual_fee numeric default null,
  p_actual_recipient_amount numeric default null,
  p_note text default ''
)
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
  if p_status not in ('unmatched','matched','needs_review') then raise exception 'INVALID_RECONCILIATION_STATUS' using errcode='22023'; end if;
  if length(trim(coalesce(p_reference,''))) > 200 then raise exception 'RECONCILIATION_REFERENCE_TOO_LONG' using errcode='22023'; end if;
  if length(trim(coalesce(p_note,''))) > 1000 then raise exception 'RECONCILIATION_NOTE_TOO_LONG' using errcode='22023'; end if;
  if p_actual_fee is not null and (p_actual_fee < 0 or p_actual_fee > 10000000) then raise exception 'INVALID_ACTUAL_FEE' using errcode='22023'; end if;
  if p_actual_recipient_amount is not null and (p_actual_recipient_amount < 0 or p_actual_recipient_amount > 1000000000) then raise exception 'INVALID_ACTUAL_RECIPIENT_AMOUNT' using errcode='22023'; end if;
  if p_status='matched' and length(trim(coalesce(p_reference,''))) < 2 then raise exception 'RECONCILIATION_REFERENCE_REQUIRED' using errcode='22023'; end if;

  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=actor for update;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
  if current_payment.status not in ('paid','received') then raise exception 'PAYMENT_NOT_SETTLED' using errcode='22023'; end if;

  update public.payment_drafts set
    reconciliation_status=p_status,
    reconciliation_reference=trim(coalesce(p_reference,'')),
    reconciliation_note=trim(coalesce(p_note,'')),
    actual_fee=p_actual_fee,
    actual_recipient_amount=p_actual_recipient_amount,
    reconciled_at=case when p_status='matched' then clock_timestamp() else null end
  where id=current_payment.id and user_id=actor;
end;
$$;
revoke all on function public.flowpay_reconcile_payment(uuid,text,text,numeric,numeric,text) from public, anon;
grant execute on function public.flowpay_reconcile_payment(uuid,text,text,numeric,numeric,text) to authenticated;

create or replace function public.flowpay_update_payment_priority(p_payment_id uuid, p_priority text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  perform public.flowpay_require_aal2();
  if p_priority not in ('low','normal','high','urgent') then raise exception 'INVALID_PAYMENT_PRIORITY' using errcode='22023'; end if;
  update public.payment_drafts set priority=p_priority where id=p_payment_id and user_id=actor;
  if not found then raise exception 'PAYMENT_NOT_FOUND' using errcode='42501'; end if;
end;
$$;
revoke all on function public.flowpay_update_payment_priority(uuid,text) from public, anon;
grant execute on function public.flowpay_update_payment_priority(uuid,text) to authenticated;

create or replace function public.flowpay_bulk_set_payment_status(p_payment_ids uuid[], p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  ids uuid[];
  payment_id uuid;
  expected_count integer;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  perform public.flowpay_require_aal2();
  if p_payment_ids is null or cardinality(p_payment_ids)=0 then raise exception 'EMPTY_PAYMENT_SELECTION' using errcode='22023'; end if;
  if cardinality(p_payment_ids)>100 then raise exception 'TOO_MANY_PAYMENTS' using errcode='22023'; end if;
  select array_agg(distinct u.payment_id) into ids from unnest(p_payment_ids) as u(payment_id);
  expected_count := cardinality(ids);
  if (select count(*) from public.payment_drafts d where d.user_id=actor and d.id=any(ids)) <> expected_count then
    raise exception 'PAYMENT_NOT_FOUND' using errcode='42501';
  end if;
  foreach payment_id in array ids loop
    perform public.flowpay_set_payment_status(payment_id,p_status);
  end loop;
  return jsonb_build_object('updated',expected_count,'status',p_status);
end;
$$;
revoke all on function public.flowpay_bulk_set_payment_status(uuid[],text) from public, anon;
grant execute on function public.flowpay_bulk_set_payment_status(uuid[],text) to authenticated;

create or replace function public.flowpay_update_profile_v21(
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
  p_approval_threshold numeric,
  p_approval_currency text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  policy_currency text;
  reporting_currency text;
begin
  if actor is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  perform public.flowpay_require_aal2();
  if length(trim(coalesce(p_name,''))) < 2 or length(trim(p_name)) > 160 then raise exception 'INVALID_COMPANY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_country,''))) !~ '^[A-Z]{2}$' then raise exception 'INVALID_COUNTRY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_preferred_currency,''))) !~ '^[A-Z]{3}$' then raise exception 'INVALID_CURRENCY' using errcode='22023'; end if;
  if upper(trim(coalesce(p_approval_currency,''))) !~ '^[A-Z]{3}$' then raise exception 'INVALID_APPROVAL_CURRENCY' using errcode='22023'; end if;
  if length(coalesce(p_registration_number,'')) > 100 or length(coalesce(p_business_address,'')) > 300 then raise exception 'FIELD_TOO_LONG' using errcode='22023'; end if;
  if p_default_payment_method not in ('bank_transfer','swift','local') then raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  if p_default_charge_type not in ('shared','sender','recipient') then raise exception 'INVALID_CHARGE_TYPE' using errcode='22023'; end if;
  if p_approval_threshold is null or p_approval_threshold < 0 or p_approval_threshold > 1000000000 then raise exception 'INVALID_APPROVAL_THRESHOLD' using errcode='22023'; end if;
  reporting_currency := upper(trim(p_preferred_currency));
  policy_currency := upper(trim(p_approval_currency));

  update public.company_profiles set
    name=trim(p_name),
    country=upper(trim(p_country)),
    preferred_currency=reporting_currency,
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
revoke all on function public.flowpay_update_profile_v21(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,numeric,text) from public, anon;
grant execute on function public.flowpay_update_profile_v21(text,text,text,text,text,text,text,boolean,boolean,boolean,boolean,boolean,boolean,numeric,text) to authenticated;
