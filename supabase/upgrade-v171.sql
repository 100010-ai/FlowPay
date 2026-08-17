-- FlowPay v1.7.1 account compatibility hotfix
-- Purpose: restore legacy company profiles that predate onboarding_completed_at
-- without weakening the v1.6 AAL2/RLS security model or fabricating legal receipts.
-- Safe to run more than once.

begin;
set local lock_timeout = '10s';
set local statement_timeout = '120s';

-- Older FlowPay releases could have a fully configured company row before the
-- onboarding_completed_at column existed. Those accounts were already usable
-- before v1.6, so treat a structurally valid legacy profile as completed.
-- We intentionally do NOT create Privacy/Terms receipts here.
update public.company_profiles
set onboarding_completed_at = coalesce(onboarding_completed_at, updated_at, created_at, now()),
    updated_at = greatest(coalesce(updated_at, created_at, now()), coalesce(created_at, now()))
where onboarding_completed_at is null
  and length(trim(coalesce(name, ''))) between 2 and 160
  and upper(trim(coalesce(country, ''))) ~ '^[A-Z]{2}$'
  and upper(trim(coalesce(preferred_currency, ''))) ~ '^[A-Z]{3}$';

-- Keep login fail-safe even if a valid legacy row is observed before the
-- compatibility UPDATE above acquires its row lock. The RPC only returns a
-- boolean and does not expose company data at AAL1.
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

commit;
