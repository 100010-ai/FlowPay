-- If FlowPay v0.1 was already installed, simply run this file.
-- It delegates to the same idempotent v0.2 schema operations.
-- For easiest setup, copy/paste supabase/schema.sql into Supabase SQL Editor.

alter table if exists public.provider_rules add column if not exists rule_key text;
create unique index if not exists provider_rules_rule_key_uidx on public.provider_rules(rule_key) where rule_key is not null;
alter table if exists public.calculations add column if not exists estimated_saving numeric(14,2) not null default 0;
alter table if exists public.audit_requests add column if not exists best_provider_code text;
alter table if exists public.audit_requests add column if not exists estimated_best_fee numeric(14,2);
alter table if exists public.audit_requests add column if not exists potential_saving numeric(14,2) not null default 0;
alter table if exists public.audit_requests add column if not exists estimated_result jsonb not null default '[]'::jsonb;
alter table if exists public.audit_requests add column if not exists auto_analyzed_at timestamptz;

create table if not exists public.company_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  name text not null default '', country text not null default 'FR', preferred_currency text not null default 'EUR',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.company_profiles enable row level security;

drop policy if exists "company own read" on public.company_profiles;
create policy "company own read" on public.company_profiles for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "company own insert" on public.company_profiles;
create policy "company own insert" on public.company_profiles for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "company own update" on public.company_profiles;
create policy "company own update" on public.company_profiles for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "audit public insert" on public.audit_requests;
create policy "audit public insert" on public.audit_requests for insert to anon, authenticated with check (user_id is null or (select auth.uid()) = user_id);
