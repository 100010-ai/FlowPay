# FlowPay 1.7.1 — legacy account/company compatibility hotfix

## Root cause

Existing company profiles created before `onboarding_completed_at` could remain valid but have that field set to NULL. v1.6 began using the field as the AAL1-safe onboarding completion signal, causing those legacy users to be redirected to onboarding. The new v1.6 onboarding RPC correctly required server-trusted legal receipts, which legacy users did not have, so the save request failed instead of overwriting the existing company.

## Fix

- `supabase/upgrade-v171.sql` safely backfills only structurally valid legacy company profiles.
- No company rows are deleted or recreated.
- No Privacy/Terms receipts are fabricated.
- `flowpay_onboarding_status()` recognizes a structurally valid legacy company as complete.
- Login and `/onboarding` use `/api/onboarding/status`, which has a bounded server-side fallback scoped to the authenticated user ID.
- `/api/onboarding` is idempotent when the account is already complete and distinguishes legal-acceptance failures from generic server failures.

## Verification

- Full FlowPay audit suite: PASS
- Security audit: PASS (21 API routes)
- TypeScript `tsc --noEmit`: PASS
- v1.7.1 compatibility regression: PASS

