-- FlowPay v1.0 upgrade from v0.5.x
-- Run once in Supabase SQL Editor. Safe to re-run.

-- v1.0 removes geographic/currency assumptions from future rows. Existing values are preserved.
alter table public.provider_rules alter column currencies set default array[]::text[];
alter table public.company_profiles alter column country set default '';
alter table public.company_profiles alter column preferred_currency set default '';
alter table public.counterparties alter column currency set default '';

-- FlowPay v1.0 additions -----------------------------------------------------
-- No provider pricing, invoices, API logs or analytics rows are seeded.

-- v1.0 dual-currency quote metadata. Existing rows remain null rather than being guessed.
alter table public.calculations add column if not exists recipient_currency text;
alter table public.audit_requests add column if not exists recipient_currency text;

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

-- Provider data integrity for new/updated rules. Existing rows are not force-validated during upgrade.
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
