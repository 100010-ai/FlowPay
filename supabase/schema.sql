-- FlowPay v1.0 — Supabase schema
-- Safe to run on a fresh project and safe to re-run after the v0.1 schema.

create extension if not exists pgcrypto;

create table if not exists public.provider_rules (
  id uuid primary key default gen_random_uuid(),
  provider_code text not null,
  from_country text not null default '*',
  to_country text not null default '*',
  currencies text[] not null default array[]::text[],
  fee_percent numeric(8,4) not null default 0,
  fixed_fee numeric(12,2) not null default 0,
  fx_markup_percent numeric(8,4) not null default 0,
  speed_minutes integer not null default 1440,
  min_amount numeric(14,2) not null default 1,
  max_amount numeric(14,2) not null default 10000000,
  priority integer not null default 5 check (priority between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.provider_rules add column if not exists rule_key text;
create unique index if not exists provider_rules_rule_key_uidx on public.provider_rules(rule_key) where rule_key is not null;

create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id uuid not null,
  from_country text not null,
  to_country text not null,
  amount numeric(14,2) not null,
  currency text not null,
  best_provider_code text not null,
  best_fee numeric(14,2) not null,
  best_total_cost numeric(14,2) not null,
  best_speed_minutes integer not null,
  routes_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.calculations add column if not exists estimated_saving numeric(14,2) not null default 0;
alter table public.calculations add column if not exists recipient_currency text;

create table if not exists public.audit_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  from_country text not null,
  to_country text not null,
  amount numeric(14,2) not null,
  currency text not null,
  actual_fee numeric(14,2) not null,
  status text not null default 'new',
  notes text,
  created_at timestamptz not null default now()
);

alter table public.audit_requests add column if not exists recipient_currency text;
alter table public.audit_requests add column if not exists best_provider_code text;
alter table public.audit_requests add column if not exists estimated_best_fee numeric(14,2);
alter table public.audit_requests add column if not exists potential_saving numeric(14,2) not null default 0;
alter table public.audit_requests add column if not exists estimated_result jsonb not null default '[]'::jsonb;
alter table public.audit_requests add column if not exists auto_analyzed_at timestamptz;

create table if not exists public.company_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '',
  country text not null default '',
  preferred_currency text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.provider_rules enable row level security;
alter table public.calculations enable row level security;
alter table public.audit_requests enable row level security;
alter table public.company_profiles enable row level security;

-- Pricing and route rules are never exposed to anonymous browser clients.
-- Public quote/audit endpoints read them server-side; signed-in product screens may read active coverage.
drop policy if exists "provider rules public read" on public.provider_rules;
drop policy if exists "provider rules authenticated read" on public.provider_rules;
create policy "provider rules authenticated read" on public.provider_rules
for select to authenticated using (active = true);

-- Saved calculations are private to each authenticated user.
drop policy if exists "calculations own read" on public.calculations;
create policy "calculations own read" on public.calculations
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "calculations own insert" on public.calculations;
create policy "calculations own insert" on public.calculations
for insert to authenticated with check ((select auth.uid()) = user_id);

-- Audit requests are written only by the server-side audit endpoint.
-- Browser clients cannot write directly to the audit table.
drop policy if exists "audit public insert" on public.audit_requests;
drop policy if exists "audit own insert" on public.audit_requests;

drop policy if exists "audit own read" on public.audit_requests;
create policy "audit own read" on public.audit_requests
for select to authenticated using ((select auth.uid()) = user_id);

-- Company profile is fully private to its owner.
drop policy if exists "company own read" on public.company_profiles;
create policy "company own read" on public.company_profiles
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "company own insert" on public.company_profiles;
create policy "company own insert" on public.company_profiles
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "company own update" on public.company_profiles;
create policy "company own update" on public.company_profiles
for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Provider pricing is intentionally not seeded. Insert only verified live/provider-configured rules.

create index if not exists provider_rules_lookup_idx on public.provider_rules (active, from_country, to_country, min_amount, max_amount);
create index if not exists calculations_user_created_idx on public.calculations (user_id, created_at desc);
create index if not exists audit_requests_user_created_idx on public.audit_requests (user_id, created_at desc);

-- FlowPay v0.4 workspace tables
create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  country text not null,
  currency text not null default '',
  bank_country text not null,
  account_number text not null default '',
  bic text not null default '',
  email text not null default '',
  total_sent numeric(14,2) not null default 0,
  last_payment_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  supplier_name text not null,
  invoice_number text not null default '',
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  due_date date,
  route_provider_code text,
  estimated_fee numeric(14,2),
  status text not null default 'draft' check (status in ('draft','ready','paid','received')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.counterparties enable row level security;
alter table public.payment_drafts enable row level security;

drop policy if exists "counterparties own read" on public.counterparties;
create policy "counterparties own read" on public.counterparties for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "counterparties own insert" on public.counterparties;
create policy "counterparties own insert" on public.counterparties for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "counterparties own update" on public.counterparties;
create policy "counterparties own update" on public.counterparties for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "counterparties own delete" on public.counterparties;
create policy "counterparties own delete" on public.counterparties for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "payment drafts own read" on public.payment_drafts;
create policy "payment drafts own read" on public.payment_drafts for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "payment drafts own insert" on public.payment_drafts;
create policy "payment drafts own insert" on public.payment_drafts for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "payment drafts own update" on public.payment_drafts;
create policy "payment drafts own update" on public.payment_drafts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "payment drafts own delete" on public.payment_drafts;
create policy "payment drafts own delete" on public.payment_drafts for delete to authenticated using ((select auth.uid()) = user_id);

create index if not exists counterparties_user_updated_idx on public.counterparties(user_id, updated_at desc);
create index if not exists payment_drafts_user_due_idx on public.payment_drafts(user_id, due_date);
create index if not exists payment_drafts_user_updated_idx on public.payment_drafts(user_id, updated_at desc);


-- v0.5 additions
-- FlowPay v0.5 — production-data UI upgrade
-- Removes v0.2-v0.4 illustrative provider rules and adds fields used by the approved UI.

-- Never leave demo routing prices in a production workspace.
delete from public.provider_rules
where rule_key in (
  'bank-global-v1','global-transfer-v1','fx-route-v1','regional-fr-tr-v1','regional-de-tr-v1',
  'regional-fr-cn-v1','regional-any-us-v1','regional-any-gb-v1','regional-any-ae-v1',
  'regional-any-sg-v1','regional-any-in-v1','regional-any-jp-v1','regional-any-hk-v1'
);

alter table public.provider_rules add column if not exists display_name text;
alter table public.provider_rules add column if not exists reliability_percent numeric(5,2);
alter table public.provider_rules add column if not exists intermediary_banks integer;
alter table public.provider_rules add column if not exists route_steps jsonb not null default '[]'::jsonb;
alter table public.provider_rules add column if not exists source text not null default 'manual';
alter table public.provider_rules add column if not exists source_updated_at timestamptz;

alter table public.company_profiles add column if not exists registration_number text not null default '';
alter table public.company_profiles add column if not exists business_address text not null default '';
alter table public.company_profiles add column if not exists default_payment_method text not null default 'bank_transfer';
alter table public.company_profiles add column if not exists default_charge_type text not null default 'shared';
alter table public.company_profiles add column if not exists beneficiary_notifications boolean not null default true;
alter table public.company_profiles add column if not exists notify_payment_confirmations boolean not null default true;
alter table public.company_profiles add column if not exists notify_payment_failures boolean not null default true;
alter table public.company_profiles add column if not exists notify_security_alerts boolean not null default true;
alter table public.company_profiles add column if not exists notify_weekly_reports boolean not null default false;

alter table public.counterparties add column if not exists verification_status text not null default 'unverified'
  check (verification_status in ('unverified','in_review','verified','rejected'));
alter table public.counterparties add column if not exists bank_name text not null default '';
alter table public.counterparties add column if not exists account_holder text not null default '';
alter table public.counterparties add column if not exists tax_id text not null default '';

alter table public.payment_drafts add column if not exists payment_method text not null default 'bank_transfer' check (payment_method in ('bank_transfer','swift','local'));
alter table public.payment_drafts add column if not exists charge_type text not null default 'shared' check (charge_type in ('shared','sender','recipient'));
alter table public.payment_drafts add column if not exists route_from_country text;
alter table public.payment_drafts add column if not exists route_to_country text;
alter table public.payment_drafts add column if not exists recipient_currency text;
alter table public.payment_drafts add column if not exists recipient_amount numeric(14,2);
alter table public.payment_drafts add column if not exists reference text not null default '';
alter table public.payment_drafts add column if not exists route_snapshot jsonb;
alter table public.payment_drafts add column if not exists paid_at timestamptz;
alter table public.payment_drafts add column if not exists received_at timestamptz;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);
alter table public.api_keys enable row level security;
drop policy if exists "api keys own read" on public.api_keys;
create policy "api keys own read" on public.api_keys for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "api keys own insert" on public.api_keys;
create policy "api keys own insert" on public.api_keys for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "api keys own update" on public.api_keys;
create policy "api keys own update" on public.api_keys for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "api keys own delete" on public.api_keys;
create policy "api keys own delete" on public.api_keys for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists api_keys_user_created_idx on public.api_keys(user_id, created_at desc);

create table if not exists public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  role text not null default 'viewer' check (role in ('admin','finance_manager','analyst','viewer')),
  status text not null default 'pending' check (status in ('pending','accepted','cancelled')),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.workspace_invitations enable row level security;
drop policy if exists "workspace invitations own read" on public.workspace_invitations;
create policy "workspace invitations own read" on public.workspace_invitations for select to authenticated using ((select auth.uid()) = owner_user_id);
drop policy if exists "workspace invitations own insert" on public.workspace_invitations;
create policy "workspace invitations own insert" on public.workspace_invitations for insert to authenticated with check ((select auth.uid()) = owner_user_id);
drop policy if exists "workspace invitations own update" on public.workspace_invitations;
create policy "workspace invitations own update" on public.workspace_invitations for update to authenticated using ((select auth.uid()) = owner_user_id) with check ((select auth.uid()) = owner_user_id);
drop policy if exists "workspace invitations own delete" on public.workspace_invitations;
create policy "workspace invitations own delete" on public.workspace_invitations for delete to authenticated using ((select auth.uid()) = owner_user_id);
create unique index if not exists workspace_invites_pending_uidx on public.workspace_invitations(owner_user_id, lower(email)) where status='pending';

-- v1.0 removes geographic/currency assumptions from future rows. Existing values are preserved.
alter table public.provider_rules alter column currencies set default array[]::text[];
alter table public.company_profiles alter column country set default '';
alter table public.company_profiles alter column preferred_currency set default '';

-- FlowPay v1.0 additions -----------------------------------------------------
-- No provider pricing, invoices, API logs or analytics rows are seeded.

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete set null,
  invoice_number text not null default '',
  supplier_name text not null,
  issue_date date,
  due_date date,
  amount numeric(14,2) not null check (amount > 0),
  currency text not null,
  status text not null default 'open' check (status in ('open','scheduled','paid','cancelled')),
  reference text not null default '',
  notes text not null default '',
  payment_draft_id uuid references public.payment_drafts(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.invoices enable row level security;
drop policy if exists "invoices own read" on public.invoices;
create policy "invoices own read" on public.invoices for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "invoices own insert" on public.invoices;
create policy "invoices own insert" on public.invoices for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "invoices own update" on public.invoices;
create policy "invoices own update" on public.invoices for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "invoices own delete" on public.invoices;
create policy "invoices own delete" on public.invoices for delete to authenticated using ((select auth.uid()) = user_id);
create index if not exists invoices_user_due_idx on public.invoices(user_id, due_date);
create index if not exists invoices_user_created_idx on public.invoices(user_id, created_at desc);

create table if not exists public.api_request_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null,
  status_code integer not null,
  duration_ms integer,
  created_at timestamptz not null default now()
);
alter table public.api_request_logs enable row level security;
drop policy if exists "api logs own read" on public.api_request_logs;
create policy "api logs own read" on public.api_request_logs for select to authenticated using ((select auth.uid()) = user_id);
create index if not exists api_request_logs_user_created_idx on public.api_request_logs(user_id, created_at desc);

create table if not exists public.workspace_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  created_at timestamptz not null default now()
);
alter table public.workspace_audit_log enable row level security;
drop policy if exists "workspace audit own read" on public.workspace_audit_log;
create policy "workspace audit own read" on public.workspace_audit_log for select to authenticated using ((select auth.uid()) = user_id);
create index if not exists workspace_audit_user_created_idx on public.workspace_audit_log(user_id, created_at desc);

create or replace function public.flowpay_audit_change()
returns trigger
language plpgsql
security definer
set search_path = public
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
    insert into public.workspace_audit_log(user_id, entity_type, entity_id, action)
    values (owner_id, TG_TABLE_NAME, row_id, lower(TG_OP));
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end;
$$;

-- Audit metadata only; sensitive row contents are intentionally not copied.
drop trigger if exists flowpay_audit_payment_drafts on public.payment_drafts;
create trigger flowpay_audit_payment_drafts after insert or update or delete on public.payment_drafts for each row execute function public.flowpay_audit_change();
drop trigger if exists flowpay_audit_counterparties on public.counterparties;
create trigger flowpay_audit_counterparties after insert or update or delete on public.counterparties for each row execute function public.flowpay_audit_change();
drop trigger if exists flowpay_audit_invoices on public.invoices;
create trigger flowpay_audit_invoices after insert or update or delete on public.invoices for each row execute function public.flowpay_audit_change();
drop trigger if exists flowpay_audit_calculations on public.calculations;
create trigger flowpay_audit_calculations after insert or delete on public.calculations for each row execute function public.flowpay_audit_change();
drop trigger if exists flowpay_audit_api_keys on public.api_keys;
create trigger flowpay_audit_api_keys after insert or update or delete on public.api_keys for each row execute function public.flowpay_audit_change();
drop trigger if exists flowpay_audit_workspace_invitations on public.workspace_invitations;
create trigger flowpay_audit_workspace_invitations after insert or update or delete on public.workspace_invitations for each row execute function public.flowpay_audit_change();
drop trigger if exists flowpay_audit_company_profiles on public.company_profiles;
create trigger flowpay_audit_company_profiles after insert or update on public.company_profiles for each row execute function public.flowpay_audit_change();

-- Protect updated_at consistency for client writes.
create or replace function public.flowpay_touch_updated_at()
returns trigger language plpgsql as $$ begin NEW.updated_at = now(); return NEW; end; $$;
drop trigger if exists flowpay_touch_company_profiles on public.company_profiles;
create trigger flowpay_touch_company_profiles before update on public.company_profiles for each row execute function public.flowpay_touch_updated_at();
drop trigger if exists flowpay_touch_counterparties on public.counterparties;
create trigger flowpay_touch_counterparties before update on public.counterparties for each row execute function public.flowpay_touch_updated_at();
drop trigger if exists flowpay_touch_payment_drafts on public.payment_drafts;
create trigger flowpay_touch_payment_drafts before update on public.payment_drafts for each row execute function public.flowpay_touch_updated_at();
drop trigger if exists flowpay_touch_invoices on public.invoices;
create trigger flowpay_touch_invoices before update on public.invoices for each row execute function public.flowpay_touch_updated_at();

-- v1.0 provider data integrity. NOT VALID keeps upgrades safe for existing workspaces,
-- while PostgreSQL still enforces these checks for new/updated rows.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'provider_rules_nonnegative_fees_chk') then
    alter table public.provider_rules add constraint provider_rules_nonnegative_fees_chk
      check (fee_percent >= 0 and fixed_fee >= 0 and fx_markup_percent >= 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'provider_rules_amount_range_chk') then
    alter table public.provider_rules add constraint provider_rules_amount_range_chk
      check (min_amount > 0 and max_amount >= min_amount) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'provider_rules_speed_chk') then
    alter table public.provider_rules add constraint provider_rules_speed_chk
      check (speed_minutes > 0) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'provider_rules_reliability_chk') then
    alter table public.provider_rules add constraint provider_rules_reliability_chk
      check (reliability_percent is null or (reliability_percent between 0 and 100)) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'provider_rules_intermediaries_chk') then
    alter table public.provider_rules add constraint provider_rules_intermediaries_chk
      check (intermediary_banks is null or intermediary_banks >= 0) not valid;
  end if;
end $$;

-- FlowPay 1.1 transactional payment/invoice operations.
-- These RPCs keep linked payment and invoice state changes in one PostgreSQL transaction.
create or replace function public.flowpay_set_payment_status(p_payment_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_payment public.payment_drafts%rowtype;
  now_at timestamptz := now();
begin
  if p_status not in ('ready','paid','received') then
    raise exception 'INVALID_PAYMENT_STATUS' using errcode = '22023';
  end if;

  select * into current_payment
  from public.payment_drafts
  where id = p_payment_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = '42501';
  end if;

  if current_payment.status = 'received' and p_status <> 'received' then
    raise exception 'INVALID_PAYMENT_TRANSITION' using errcode = '22023';
  end if;
  if current_payment.status = 'paid' and p_status not in ('paid','received') then
    raise exception 'INVALID_PAYMENT_TRANSITION' using errcode = '22023';
  end if;

  update public.payment_drafts
  set status = p_status,
      paid_at = case
        when p_status in ('paid','received') then coalesce(paid_at, now_at)
        else paid_at
      end,
      received_at = case
        when p_status = 'received' then coalesce(received_at, now_at)
        else received_at
      end
  where id = current_payment.id and user_id = auth.uid();

  if p_status in ('paid','received') then
    update public.invoices
    set status = 'paid'
    where payment_draft_id = current_payment.id
      and user_id = auth.uid()
      and status <> 'cancelled';
  end if;
end;
$$;

create or replace function public.flowpay_set_invoice_status(p_invoice_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_invoice public.invoices%rowtype;
  now_at timestamptz := now();
begin
  if p_status not in ('paid','cancelled') then
    raise exception 'INVALID_INVOICE_STATUS' using errcode = '22023';
  end if;

  select * into current_invoice
  from public.invoices
  where id = p_invoice_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = '42501';
  end if;

  if current_invoice.status = 'paid' and p_status <> 'paid' then
    raise exception 'INVALID_INVOICE_TRANSITION' using errcode = '22023';
  end if;
  if current_invoice.status = 'cancelled' and p_status <> 'cancelled' then
    raise exception 'INVALID_INVOICE_TRANSITION' using errcode = '22023';
  end if;
  if p_status = 'cancelled' and current_invoice.payment_draft_id is not null then
    raise exception 'INVOICE_HAS_LINKED_PAYMENT' using errcode = '22023';
  end if;

  update public.invoices
  set status = p_status
  where id = current_invoice.id and user_id = auth.uid();

  if p_status = 'paid' and current_invoice.payment_draft_id is not null then
    update public.payment_drafts
    set status = case when status = 'received' then status else 'paid' end,
        paid_at = coalesce(paid_at, now_at)
    where id = current_invoice.payment_draft_id
      and user_id = auth.uid();
  end if;
end;
$$;

create or replace function public.flowpay_link_invoice_payment(p_invoice_id uuid, p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_invoice public.invoices%rowtype;
  current_payment public.payment_drafts%rowtype;
begin
  select * into current_invoice
  from public.invoices
  where id = p_invoice_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'INVOICE_NOT_FOUND' using errcode = '42501';
  end if;
  if current_invoice.status in ('paid','cancelled') then
    raise exception 'INVOICE_CANNOT_BE_LINKED' using errcode = '22023';
  end if;
  if current_invoice.payment_draft_id is not null and current_invoice.payment_draft_id <> p_payment_id then
    raise exception 'INVOICE_ALREADY_LINKED' using errcode = '23505';
  end if;

  select * into current_payment
  from public.payment_drafts
  where id = p_payment_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.invoices
    where payment_draft_id = p_payment_id
      and id <> p_invoice_id
      and user_id = auth.uid()
  ) then
    raise exception 'PAYMENT_ALREADY_LINKED' using errcode = '23505';
  end if;

  update public.invoices
  set payment_draft_id = current_payment.id,
      status = 'scheduled'
  where id = current_invoice.id and user_id = auth.uid();
end;
$$;

create or replace function public.flowpay_delete_payment_draft(p_payment_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_payment public.payment_drafts%rowtype;
begin
  select * into current_payment
  from public.payment_drafts
  where id = p_payment_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND' using errcode = '42501';
  end if;
  if current_payment.status <> 'draft' then
    raise exception 'ONLY_DRAFT_PAYMENT_CAN_BE_DELETED' using errcode = '22023';
  end if;

  update public.invoices
  set payment_draft_id = null,
      status = case when status = 'scheduled' then 'open' else status end
  where payment_draft_id = current_payment.id and user_id = auth.uid();

  delete from public.payment_drafts
  where id = current_payment.id and user_id = auth.uid();
end;
$$;


create or replace function public.flowpay_delete_counterparty(p_counterparty_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_counterparty public.counterparties%rowtype;
begin
  select * into current_counterparty
  from public.counterparties
  where id = p_counterparty_id and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'COUNTERPARTY_NOT_FOUND' using errcode = '42501';
  end if;
  if exists (select 1 from public.payment_drafts where counterparty_id = p_counterparty_id and user_id = auth.uid())
     or exists (select 1 from public.invoices where counterparty_id = p_counterparty_id and user_id = auth.uid()) then
    raise exception 'COUNTERPARTY_HAS_HISTORY' using errcode = '23503';
  end if;

  delete from public.counterparties where id = p_counterparty_id and user_id = auth.uid();
end;
$$;


revoke all on function public.flowpay_delete_counterparty(uuid) from public;
grant execute on function public.flowpay_delete_counterparty(uuid) to authenticated;

revoke all on function public.flowpay_set_payment_status(uuid,text) from public;
revoke all on function public.flowpay_set_invoice_status(uuid,text) from public;
revoke all on function public.flowpay_link_invoice_payment(uuid,uuid) from public;
revoke all on function public.flowpay_delete_payment_draft(uuid) from public;
grant execute on function public.flowpay_set_payment_status(uuid,text) to authenticated;
grant execute on function public.flowpay_set_invoice_status(uuid,text) to authenticated;
grant execute on function public.flowpay_link_invoice_payment(uuid,uuid) to authenticated;
grant execute on function public.flowpay_delete_payment_draft(uuid) to authenticated;

-- FlowPay 1.2 launch-readiness additions -----------------------------------
-- FlowPay 1.2 launch-readiness migration.
-- Adds onboarding state, idempotent payment creation, distributed API rate limiting
-- and server-only operational event storage. No demo/provider data is inserted.

alter table public.company_profiles add column if not exists onboarding_completed_at timestamptz;
alter table public.company_profiles add column if not exists timezone text not null default '';

alter table public.payment_drafts add column if not exists idempotency_key text;
create unique index if not exists payment_drafts_user_idempotency_uidx
  on public.payment_drafts(user_id, idempotency_key)
  where idempotency_key is not null;

create table if not exists public.flowpay_rate_limit_events (
  id bigint generated by default as identity primary key,
  key_hash text not null,
  bucket text not null,
  created_at timestamptz not null default now()
);
create index if not exists flowpay_rate_limit_events_lookup_idx
  on public.flowpay_rate_limit_events(bucket, key_hash, created_at desc);
alter table public.flowpay_rate_limit_events enable row level security;
-- Intentionally no client policies. Service role/RPC only.

create or replace function public.flowpay_check_rate_limit(
  p_key_hash text,
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  cutoff timestamptz := now() - make_interval(secs => greatest(1, p_window_seconds));
  used integer;
begin
  if p_limit < 1 or p_limit > 10000 then
    raise exception 'INVALID_RATE_LIMIT' using errcode='22023';
  end if;
  delete from public.flowpay_rate_limit_events where created_at < now() - interval '24 hours';
  select count(*)::integer into used
  from public.flowpay_rate_limit_events
  where key_hash = p_key_hash and bucket = p_bucket and created_at >= cutoff;

  if used >= p_limit then
    return query select false, 0;
    return;
  end if;

  insert into public.flowpay_rate_limit_events(key_hash,bucket) values(p_key_hash,p_bucket);
  return query select true, greatest(0, p_limit - used - 1);
end;
$$;
revoke all on function public.flowpay_check_rate_limit(text,text,integer,integer) from public;
grant execute on function public.flowpay_check_rate_limit(text,text,integer,integer) to service_role;
-- Service-role callers bypass grants; do not expose this RPC to anon/authenticated.

create table if not exists public.system_event_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  level text not null check (level in ('info','warning','error')),
  source text not null,
  code text not null,
  message text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists system_event_logs_created_idx on public.system_event_logs(created_at desc);
create index if not exists system_event_logs_level_created_idx on public.system_event_logs(level,created_at desc);
alter table public.system_event_logs enable row level security;
-- Intentionally no client policies. Service role only.

create or replace function public.flowpay_complete_onboarding(
  p_name text,
  p_country text,
  p_currency text,
  p_timezone text
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if length(trim(p_name)) < 2 then raise exception 'COMPANY_NAME_REQUIRED' using errcode='22023'; end if;
  if length(trim(p_country)) <> 2 then raise exception 'COUNTRY_REQUIRED' using errcode='22023'; end if;
  if length(trim(p_currency)) <> 3 then raise exception 'CURRENCY_REQUIRED' using errcode='22023'; end if;

  insert into public.company_profiles(user_id,name,country,preferred_currency,timezone,onboarding_completed_at)
  values(auth.uid(),trim(p_name),upper(trim(p_country)),upper(trim(p_currency)),trim(p_timezone),now())
  on conflict(user_id) do update set
    name=excluded.name,
    country=excluded.country,
    preferred_currency=excluded.preferred_currency,
    timezone=excluded.timezone,
    onboarding_completed_at=coalesce(public.company_profiles.onboarding_completed_at,now());
end;
$$;
revoke all on function public.flowpay_complete_onboarding(text,text,text,text) from public;
grant execute on function public.flowpay_complete_onboarding(text,text,text,text) to authenticated;

-- Create/update a payment in one server/RLS-aware operation with optional idempotency.
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
security invoker
set search_path = public
as $$
declare
  result_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if length(trim(p_supplier_name)) < 1 then raise exception 'SUPPLIER_REQUIRED' using errcode='22023'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'INVALID_AMOUNT' using errcode='22023'; end if;
  if p_payment_method not in ('bank_transfer','swift','local') then raise exception 'INVALID_PAYMENT_METHOD' using errcode='22023'; end if;
  if p_charge_type not in ('shared','sender','recipient') then raise exception 'INVALID_CHARGE_TYPE' using errcode='22023'; end if;
  if p_counterparty_id is not null and not exists(select 1 from public.counterparties where id=p_counterparty_id and user_id=auth.uid()) then
    raise exception 'COUNTERPARTY_NOT_FOUND' using errcode='42501';
  end if;

  if p_payment_id is null and nullif(trim(coalesce(p_idempotency_key,'')),'') is not null then
    select id into result_id from public.payment_drafts
      where user_id=auth.uid() and idempotency_key=trim(p_idempotency_key)
      limit 1;
    if result_id is not null then return result_id; end if;
  end if;

  if p_payment_id is null then
    insert into public.payment_drafts(
      user_id,idempotency_key,counterparty_id,supplier_name,invoice_number,amount,currency,due_date,
      route_provider_code,estimated_fee,notes,route_from_country,route_to_country,recipient_currency,
      recipient_amount,reference,route_snapshot,payment_method,charge_type,status
    ) values(
      auth.uid(),nullif(trim(coalesce(p_idempotency_key,'')),''),p_counterparty_id,trim(p_supplier_name),coalesce(p_invoice_number,''),p_amount,upper(p_currency),p_due_date,
      p_route_provider_code,p_estimated_fee,coalesce(p_notes,''),p_route_from_country,p_route_to_country,p_recipient_currency,
      p_recipient_amount,coalesce(p_reference,''),p_route_snapshot,p_payment_method,p_charge_type,'draft'
    ) returning id into result_id;
  else
    update public.payment_drafts set
      counterparty_id=p_counterparty_id,
      supplier_name=trim(p_supplier_name),
      invoice_number=coalesce(p_invoice_number,''),
      amount=p_amount,
      currency=upper(p_currency),
      due_date=p_due_date,
      route_provider_code=p_route_provider_code,
      estimated_fee=p_estimated_fee,
      notes=coalesce(p_notes,''),
      route_from_country=p_route_from_country,
      route_to_country=p_route_to_country,
      recipient_currency=p_recipient_currency,
      recipient_amount=p_recipient_amount,
      reference=coalesce(p_reference,''),
      route_snapshot=p_route_snapshot,
      payment_method=p_payment_method,
      charge_type=p_charge_type
    where id=p_payment_id and user_id=auth.uid() and status in ('draft','ready')
    returning id into result_id;
    if result_id is null then raise exception 'PAYMENT_NOT_EDITABLE' using errcode='22023'; end if;
  end if;
  return result_id;
end;
$$;
revoke all on function public.flowpay_upsert_payment(uuid,text,uuid,text,text,numeric,text,date,text,numeric,text,text,text,text,numeric,text,jsonb,text,text) from public;
grant execute on function public.flowpay_upsert_payment(uuid,text,uuid,text,text,numeric,text,date,text,numeric,text,text,text,text,numeric,text,jsonb,text,text) to authenticated;

-- FlowPay 1.2 additional server-side write RPCs.
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
security invoker
set search_path = public
as $$
declare result_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if length(trim(p_name)) < 1 then raise exception 'NAME_REQUIRED' using errcode='22023'; end if;
  if length(trim(p_country)) <> 2 or length(trim(p_bank_country)) <> 2 then raise exception 'COUNTRY_REQUIRED' using errcode='22023'; end if;
  if length(trim(p_currency)) <> 3 then raise exception 'CURRENCY_REQUIRED' using errcode='22023'; end if;
  if p_counterparty_id is null then
    insert into public.counterparties(user_id,name,country,currency,bank_country,bank_name,account_number,account_holder,bic,email,tax_id,verification_status)
    values(auth.uid(),trim(p_name),upper(p_country),upper(p_currency),upper(p_bank_country),trim(coalesce(p_bank_name,'')),trim(coalesce(p_account_number,'')),trim(coalesce(p_account_holder,'')),upper(trim(coalesce(p_bic,''))),lower(trim(coalesce(p_email,''))),trim(coalesce(p_tax_id,'')),'unverified')
    returning id into result_id;
  else
    update public.counterparties set name=trim(p_name),country=upper(p_country),currency=upper(p_currency),bank_country=upper(p_bank_country),bank_name=trim(coalesce(p_bank_name,'')),account_number=trim(coalesce(p_account_number,'')),account_holder=trim(coalesce(p_account_holder,'')),bic=upper(trim(coalesce(p_bic,''))),email=lower(trim(coalesce(p_email,''))),tax_id=trim(coalesce(p_tax_id,''))
    where id=p_counterparty_id and user_id=auth.uid()
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
security invoker
set search_path = public
as $$
declare result_id uuid;
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='42501'; end if;
  if length(trim(p_supplier_name)) < 1 or p_amount is null or p_amount <= 0 then raise exception 'INVALID_INVOICE' using errcode='22023'; end if;
  if p_counterparty_id is not null and not exists(select 1 from public.counterparties where id=p_counterparty_id and user_id=auth.uid()) then raise exception 'COUNTERPARTY_NOT_FOUND' using errcode='42501'; end if;
  if p_invoice_id is null then
    insert into public.invoices(user_id,counterparty_id,invoice_number,supplier_name,issue_date,due_date,amount,currency,reference,notes,status)
    values(auth.uid(),p_counterparty_id,coalesce(p_invoice_number,''),trim(p_supplier_name),p_issue_date,p_due_date,p_amount,upper(p_currency),coalesce(p_reference,''),coalesce(p_notes,''),'open')
    returning id into result_id;
  else
    update public.invoices set counterparty_id=p_counterparty_id,invoice_number=coalesce(p_invoice_number,''),supplier_name=trim(p_supplier_name),issue_date=p_issue_date,due_date=p_due_date,amount=p_amount,currency=upper(p_currency),reference=coalesce(p_reference,''),notes=coalesce(p_notes,'')
    where id=p_invoice_id and user_id=auth.uid() and status in ('open','scheduled')
    returning id into result_id;
    if result_id is null then raise exception 'INVOICE_NOT_EDITABLE' using errcode='22023'; end if;
  end if;
  return result_id;
end;
$$;
revoke all on function public.flowpay_upsert_invoice(uuid,uuid,text,text,date,date,numeric,text,text,text) from public;
grant execute on function public.flowpay_upsert_invoice(uuid,uuid,text,text,date,date,numeric,text,text,text) to authenticated;

-- Expanded launch lifecycle: explicit cancellation/failure states and strict transitions.
alter table public.payment_drafts drop constraint if exists payment_drafts_status_check;
alter table public.payment_drafts add constraint payment_drafts_status_check
  check (status in ('draft','ready','paid','received','cancelled','failed')) not valid;

create or replace function public.flowpay_set_payment_status(p_payment_id uuid, p_status text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_payment public.payment_drafts%rowtype;
  now_at timestamptz := now();
begin
  if p_status not in ('ready','paid','received','cancelled','failed') then raise exception 'INVALID_PAYMENT_STATUS' using errcode='22023'; end if;
  select * into current_payment from public.payment_drafts where id=p_payment_id and user_id=auth.uid() for update;
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
  where id=current_payment.id and user_id=auth.uid();

  if p_status in ('paid','received') then
    update public.invoices set status='paid' where payment_draft_id=current_payment.id and user_id=auth.uid() and status<>'cancelled';
  elsif p_status='cancelled' then
    update public.invoices set payment_draft_id=null,status=case when status='scheduled' then 'open' else status end
    where payment_draft_id=current_payment.id and user_id=auth.uid() and status not in ('paid','cancelled');
  end if;
end;
$$;
revoke all on function public.flowpay_set_payment_status(uuid,text) from public;
grant execute on function public.flowpay_set_payment_status(uuid,text) to authenticated;
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

-- Company profile writes also go through validated backend/onboarding paths.
drop policy if exists "company own insert" on public.company_profiles;
drop policy if exists "company own update" on public.company_profiles;
revoke insert, update on public.company_profiles from authenticated;

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

-- FlowPay 1.3 final provider-read and retention-index hardening.
revoke select on public.provider_rules from anon, authenticated;
grant select (id,provider_code,display_name,from_country,to_country,currencies,active,source_updated_at)
  on public.provider_rules to authenticated;
create index if not exists flowpay_rate_limit_counters_updated_idx
  on public.flowpay_rate_limit_counters(updated_at);
create index if not exists api_request_logs_created_at_idx
  on public.api_request_logs(created_at);
create index if not exists system_event_logs_created_at_idx
  on public.system_event_logs(created_at);
-- Obsolete v1.2 event-per-request rate-limit storage is not kept in v1.3.
drop table if exists public.flowpay_rate_limit_events;

-- FlowPay 1.5 legal acceptance ledger ---------------------------------------
-- Immutable browser-facing receipt of the legal versions acknowledged/accepted
-- during signup. The trigger writes server time from auth.users.created_at.
create table if not exists public.legal_acceptances (
  id bigint generated by default as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_type text not null check (document_type in ('privacy','terms')),
  document_version text not null check (document_version ~ '^\\d{4}-\\d{2}-\\d{2}$'),
  action text not null check (action in ('acknowledged','accepted')),
  locale text not null default 'en' check (length(locale) between 2 and 12),
  source text not null default 'registration' check (source in ('registration','reacceptance')),
  accepted_at timestamptz not null,
  created_at timestamptz not null default now(),
  unique(user_id,document_type,document_version)
);
alter table public.legal_acceptances enable row level security;
drop policy if exists "legal acceptance own read" on public.legal_acceptances;
create policy "legal acceptance own read" on public.legal_acceptances
for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;
create index if not exists legal_acceptances_user_time_idx on public.legal_acceptances(user_id,accepted_at desc);

create or replace function public.flowpay_record_signup_legal_acceptances()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  privacy_version text := nullif(trim(coalesce(new.raw_user_meta_data->>'privacy_version','')), '');
  terms_version text := nullif(trim(coalesce(new.raw_user_meta_data->>'terms_version','')), '');
  legal_locale text := left(trim(coalesce(new.raw_user_meta_data->>'legal_locale','en')),12);
  signup_at timestamptz := coalesce(new.created_at,clock_timestamp());
begin
  if lower(coalesce(new.raw_user_meta_data->>'privacy_acknowledged','false')) = 'true'
     and privacy_version ~ '^\\d{4}-\\d{2}-\\d{2}$' then
    insert into public.legal_acceptances(user_id,document_type,document_version,action,locale,source,accepted_at)
    values(new.id,'privacy',privacy_version,'acknowledged',coalesce(nullif(legal_locale,''),'en'),'registration',signup_at)
    on conflict(user_id,document_type,document_version) do nothing;
  end if;
  if lower(coalesce(new.raw_user_meta_data->>'terms_accepted','false')) = 'true'
     and terms_version ~ '^\\d{4}-\\d{2}-\\d{2}$' then
    insert into public.legal_acceptances(user_id,document_type,document_version,action,locale,source,accepted_at)
    values(new.id,'terms',terms_version,'accepted',coalesce(nullif(legal_locale,''),'en'),'registration',signup_at)
    on conflict(user_id,document_type,document_version) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function public.flowpay_record_signup_legal_acceptances() from public, anon, authenticated;
drop trigger if exists flowpay_record_signup_legal_acceptances on auth.users;
create trigger flowpay_record_signup_legal_acceptances after insert on auth.users
for each row execute function public.flowpay_record_signup_legal_acceptances();
-- FlowPay 1.6 — mandatory MFA, least privilege and API credential hardening
-- Run after upgrade-v15.sql. This migration does not inspect or modify env values.
-- AAL2 is enforced in Postgres so an aal1 JWT cannot bypass the application UI.

begin;

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

-- Every sensitive workspace table requires an AAL2 JWT even for SELECT. Existing
-- ownership policies still apply; this is an additional RESTRICTIVE gate.
do $$
declare t text;
begin
  foreach t in array array[
    'calculations','audit_requests','company_profiles','counterparties','payment_drafts',
    'api_keys','workspace_invitations','invoices','api_request_logs','workspace_audit_log','api_usage_daily'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists "mfa aal2 gate" on public.%I', t);
    execute format(
      'create policy "mfa aal2 gate" on public.%I as restrictive for all to authenticated using ((select auth.jwt()->>''aal'') = ''aal2'') with check ((select auth.jwt()->>''aal'') = ''aal2'')',
      t
    );
  end loop;
end $$;

-- Team invitations are not exposed as a direct browser write surface in v1.6.
drop policy if exists "workspace invitations own insert" on public.workspace_invitations;
drop policy if exists "workspace invitations own update" on public.workspace_invitations;
drop policy if exists "workspace invitations own delete" on public.workspace_invitations;
revoke insert, update, delete on public.workspace_invitations from authenticated;

-- API credentials are least-privilege and short-lived. Existing active keys get
-- a fresh 90-day migration window rather than being invalidated immediately.
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

-- Legal evidence must be minted by FlowPay's same-origin registration endpoint,
-- not from caller-controlled Auth user_metadata. Existing v1.5 metadata-backed
-- receipts are preserved as legacy evidence but are NOT promoted to trusted
-- registration receipts; incomplete legacy accounts must use the v1.6 legal flow.
drop trigger if exists flowpay_record_signup_legal_acceptances on auth.users;
drop function if exists public.flowpay_record_signup_legal_acceptances();
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

-- Browser table writes stay revoked; mutations go through validated RPCs below.
revoke insert, update, delete on public.payment_drafts from authenticated;
revoke insert, update, delete on public.counterparties from authenticated;
revoke insert, update, delete on public.invoices from authenticated;
revoke insert, update, delete on public.api_keys from authenticated;
revoke insert, update, delete on public.calculations from authenticated;
revoke insert, update on public.company_profiles from authenticated;

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

-- FlowPay v1.7.1 — legacy account/company compatibility.
-- Existing valid company profiles created before onboarding_completed_at was
-- introduced are grandfathered without creating legal acceptance receipts.
update public.company_profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, created_at, now()),
    updated_at = greatest(coalesce(updated_at, created_at, now()), coalesce(created_at, now()))
where onboarding_completed_at is null
  and length(trim(coalesce(name, ''))) between 2 and 160
  and upper(trim(coalesce(country, ''))) ~ '^[A-Z]{2}$'
  and upper(trim(coalesce(preferred_currency, ''))) ~ '^[A-Z]{3}$';

create or replace function public.flowpay_onboarding_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.company_profiles
    where user_id = auth.uid()
      and (
        onboarding_completed_at is not null
        or (
          length(trim(coalesce(name, ''))) between 2 and 160
          and upper(trim(coalesce(country, ''))) ~ '^[A-Z]{2}$'
          and upper(trim(coalesce(preferred_currency, ''))) ~ '^[A-Z]{3}$'
        )
      )
  );
$$;
revoke all on function public.flowpay_onboarding_status() from public, anon;
grant execute on function public.flowpay_onboarding_status() to authenticated;

-- FlowPay 1.9 registration hardening ---------------------------------------
-- Keep fresh installs equivalent to upgrade-v19.sql. Registration intentionally
-- has no fallback when this server-owned legal ledger is unavailable.
begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';
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
  if p_user_id is null then raise exception 'REGISTRATION_USER_REQUIRED' using errcode='22023'; end if;
  if not exists(select 1 from auth.users where id=p_user_id) then raise exception 'REGISTRATION_USER_NOT_FOUND' using errcode='22023'; end if;
  if coalesce(p_privacy_version,'') !~ '^\d{4}-\d{2}-\d{2}$' or coalesce(p_terms_version,'') !~ '^\d{4}-\d{2}-\d{2}$' then
    raise exception 'INVALID_LEGAL_VERSION' using errcode='22023';
  end if;
  if trim(coalesce(p_locale,'')) not in ('ru','en','fr','de','es') then raise exception 'INVALID_LEGAL_LOCALE' using errcode='22023'; end if;

  insert into public.legal_acceptances(user_id,document_type,document_version,action,locale,source,accepted_at)
  values(p_user_id,'privacy',p_privacy_version,'acknowledged',trim(p_locale),'registration_server',accepted_at_value)
  on conflict(user_id,document_type,document_version) do nothing;
  insert into public.legal_acceptances(user_id,document_type,document_version,action,locale,source,accepted_at)
  values(p_user_id,'terms',p_terms_version,'accepted',trim(p_locale),'registration_server',accepted_at_value)
  on conflict(user_id,document_type,document_version) do nothing;

  if not exists(select 1 from public.legal_acceptances where user_id=p_user_id and document_type='privacy' and document_version=p_privacy_version and action='acknowledged' and source='registration_server')
     or not exists(select 1 from public.legal_acceptances where user_id=p_user_id and document_type='terms' and document_version=p_terms_version and action='accepted' and source='registration_server') then
    raise exception 'LEGAL_RECEIPT_CONFLICT' using errcode='23514';
  end if;
end;
$$;
revoke all on function public.flowpay_record_registration_legal(uuid,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.flowpay_record_registration_legal(uuid,text,text,text,timestamptz) to service_role;

create or replace function public.flowpay_registration_ready()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from pg_catalog.pg_constraint c
    where c.conrelid='public.legal_acceptances'::regclass and c.contype='c'
      and pg_catalog.pg_get_constraintdef(c.oid) ilike '%registration_server%'
  );
$$;
revoke all on function public.flowpay_registration_ready() from public, anon, authenticated;
grant execute on function public.flowpay_registration_ready() to service_role;
commit;


-- FlowPay 2.0 platform upgrade
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
