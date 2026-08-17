# FlowPay 1.7.3 — auth/onboarding redirect-loop hotfix

## Production incident

Vercel production logs showed repeated requests to `/onboarding`, `/settings/security` and `/api/onboarding/status` in the same session. The root cause was an AAL1/RLS interaction: `WorkspaceProvider` intentionally hid `company_profiles` until AAL2, while `WorkspaceShell` interpreted the resulting `profile = null` as an incomplete onboarding state and redirected back to `/onboarding`.

## Fix

- onboarding completeness is inferred from workspace profile data only after AAL2;
- `/settings/security` can render while the session is AAL1 without being redirected to onboarding;
- auth-boundary redirects use `window.location.replace()` so they do not depend on a soft-router transition completing;
- workspace auth/MFA/data waits are bounded;
- dedicated v1.7.3 regression checks guard the loop.

## Verification

Run `npm run audit`, `npm run typecheck`, `npm run build`, and `npm run audit:deps` locally before push. No new SQL migration or environment variable is required.
