# FlowPay 1.7.2 — onboarding/MFA UX timeout hotfix

## Root cause

The onboarding preflight/save flow and Supabase MFA SDK calls were awaited without a client-side deadline. A stalled network/Auth request could therefore leave the interface in `checking`, `saving` or `busy` indefinitely even though the application itself had not crashed. The onboarding and Security Center grids also used different column proportions, which made the setup screens look visually unbalanced.

## Fix

- Added `lib/client-timeout.ts` with bounded Promise and fetch helpers.
- Onboarding account-status and session checks stop after 8 seconds; profile save stops after 12 seconds and exposes Retry/error UI instead of an endless spinner.
- MFA user/AAL/factor/enroll/challenge/verify/remove flows are bounded to 8–10 seconds and fail visibly.
- `/mfa` exposes an explicit Retry state when initial factor discovery fails or times out.
- Onboarding now uses a fixed 420px desktop setup rail plus a flexible form column, equal-height setup rows and consistent field sizing.
- Security Center uses equal-height two-column cards and a stable QR/secret/code layout.
- v1.7.1 company recovery and v1.6 AAL2/RLS contracts remain intact.

## Verification

- Full FlowPay audit suite: PASS
- Security audit: PASS (21 API routes)
- Strict-mode audit: PASS
- v1.7.1 compatibility regression: PASS
- v1.7.2 timeout/layout regression: PASS
- TypeScript `tsc --noEmit`: PASS
