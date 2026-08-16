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
