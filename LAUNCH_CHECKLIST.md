# FlowPay 1.2 — launch checklist

The repository now contains the product pieces that can be completed without your legal entity, domain, mail provider or payment-provider contracts.

## Required before private beta

- [ ] Run `supabase/upgrade-v12.sql` after the v1.1 migration.
- [ ] Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` in Vercel.
- [ ] Set `FLOWPAY_ADMIN_EMAILS` to the operator accounts that may open `/admin`.
- [ ] Set `NEXT_PUBLIC_APP_URL` to the production HTTPS domain.
- [ ] Configure at least one verified real payment corridor in `/admin` with source/date information.
- [ ] Verify email authentication settings and your production redirect URL. Configure production SMTP so signup/reset emails do not depend on development mail limits.
- [ ] Enable the authentication abuse-protection options appropriate for your launch (for example CAPTCHA/bot protection) in your auth provider.
- [ ] Have `/privacy`, `/terms`, and `/security` reviewed for your legal entity, target jurisdictions and actual provider agreements. See `LEGAL_REVIEW_REQUIRED.md`.
- [ ] Add a real support/privacy/security email on your domain.
- [ ] Run `npm run check:env`, `npm run audit`, `npm run typecheck`, and `npm run build`.
- [ ] Deploy to a Vercel Preview URL and complete the smoke flow below before production.

## Smoke flow

1. Create a new user and confirm email if confirmation is enabled.
2. Complete `/onboarding` and verify dashboard reporting currency.
3. Create a counterparty with valid bank details.
4. Create an invoice.
5. Create a payment from the invoice.
6. Request a route and verify only configured provider rules are returned.
7. Move payment `draft → ready → paid → received`; confirm linked invoice becomes paid.
8. Create/revoke an API key and call `POST /api/v1/quote`.
9. Export Payments/Reports CSV and verify values.
10. Open `/status` and verify core systems show operational.
11. Open `/admin` with an operator account and verify route-rule CRUD.
12. Test desktop and mobile viewport, logout/login, empty states and rate-limit error handling.

## External work FlowPay cannot complete by code alone

- A licensed payment provider/PSP contract if you want FlowPay to execute or custody funds.
- Legal review and jurisdiction-specific Terms/Privacy/compliance language.
- Domain ownership, DNS, company email and support process.
- Real provider tariffs/APIs and commercial permission to display or route through them.
- Production incident monitoring destination (for example Sentry/Datadog) if you want alerts outside the built-in event log.
