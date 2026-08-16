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
  p_timezone text default ''
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
