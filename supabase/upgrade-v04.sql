-- FlowPay v0.4 upgrade. Safe to run after v0.3.
create extension if not exists pgcrypto;

create table if not exists public.counterparties (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null, country text not null, currency text not null default 'EUR', bank_country text not null,
  account_number text not null default '', bic text not null default '', email text not null default '',
  total_sent numeric(14,2) not null default 0, last_payment_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.payment_drafts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  counterparty_id uuid references public.counterparties(id) on delete set null, supplier_name text not null,
  invoice_number text not null default '', amount numeric(14,2) not null check(amount>0), currency text not null,
  due_date date, route_provider_code text, estimated_fee numeric(14,2),
  status text not null default 'draft' check(status in ('draft','ready','paid','received')),
  notes text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.counterparties enable row level security;
alter table public.payment_drafts enable row level security;
drop policy if exists "counterparties own read" on public.counterparties; create policy "counterparties own read" on public.counterparties for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "counterparties own insert" on public.counterparties; create policy "counterparties own insert" on public.counterparties for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "counterparties own update" on public.counterparties; create policy "counterparties own update" on public.counterparties for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "counterparties own delete" on public.counterparties; create policy "counterparties own delete" on public.counterparties for delete to authenticated using ((select auth.uid())=user_id);
drop policy if exists "payment drafts own read" on public.payment_drafts; create policy "payment drafts own read" on public.payment_drafts for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "payment drafts own insert" on public.payment_drafts; create policy "payment drafts own insert" on public.payment_drafts for insert to authenticated with check ((select auth.uid())=user_id);
drop policy if exists "payment drafts own update" on public.payment_drafts; create policy "payment drafts own update" on public.payment_drafts for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id);
drop policy if exists "payment drafts own delete" on public.payment_drafts; create policy "payment drafts own delete" on public.payment_drafts for delete to authenticated using ((select auth.uid())=user_id);
create index if not exists counterparties_user_updated_idx on public.counterparties(user_id,updated_at desc);
create index if not exists payment_drafts_user_due_idx on public.payment_drafts(user_id,due_date);
create index if not exists payment_drafts_user_updated_idx on public.payment_drafts(user_id,updated_at desc);
