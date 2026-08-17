# Changelog

## 1.7.3

- Fixed a production redirect loop between `/onboarding` and `/settings/security` for existing accounts that are still at AAL1.
- `WorkspaceShell` no longer interprets an intentionally RLS-hidden `company_profiles` row as missing onboarding before AAL2 is established.
- Auth/onboarding/MFA boundary transitions now use same-tab hard navigation so a stalled App Router transition cannot leave the preflight spinner on screen indefinitely.
- Added bounded workspace auth, MFA and data-loading deadlines to prevent a hanging Supabase request from pinning the workspace loader.
- Added a regression audit for the exact AAL1/profile/onboarding loop observed in production.

## 1.7.2

- Fixed onboarding and MFA screens that could remain in an infinite loading/saving state when Supabase/Auth or a FlowPay endpoint stopped responding.
- Added bounded 8–12 second client deadlines and explicit Retry states for onboarding preflight/save, MFA session checks, enrollment, challenge and verification.
- Rebalanced the onboarding layout with fixed desktop columns, equal-height setup rows and consistent form spacing.
- Rebuilt Security Center into equal-height columns with a stable QR/TOTP grid and clearer loading/error states.
- Preserves the v1.7.1 legacy company recovery behavior and the v1.6 AAL2/RLS security boundary.

## 1.7.1

- Fixed legacy account/company compatibility after the v1.6 AAL2 hardening.
- Existing valid company profiles without `onboarding_completed_at` are safely grandfathered by `supabase/upgrade-v171.sql`; company rows are not recreated or overwritten.
- `flowpay_onboarding_status()` now recognizes a valid legacy company profile even before the compatibility backfill is complete.
- Onboarding checks existing account state before showing/saving the setup form and routes completed accounts through MFA instead of creating a second setup flow.
- `/api/onboarding` is idempotent for already-completed accounts and returns explicit legal-acceptance errors instead of an opaque 500.

# FlowPay changelog

## 1.7.0

- Rebuilt `/admin` into a launch and operations console with Overview, Users, Operations, API, Security and Routes sections.
- Added an AAL2 + immutable-admin allowlist access probe so the Admin console appears in workspace navigation only for authorized operators.
- Expanded admin telemetry to real Supabase Auth users, company onboarding, payments, invoices, counterparties, API keys, API usage/logs, workspace audit trail, system events, legal acceptance receipts and provider coverage.
- Added Launch Center gates for application/database availability, routing coverage, recent system errors plus explicit manual SMTP/legal checks.
- Added client-side search and CSV export for admin user/operation views without introducing a new data-export backend.
- Kept operational totals currency-safe: the console never sums unrelated currencies into a fake global payment volume.
- Added `audit:v17` and expanded the full audit suite to 20 API routes.
- No new external provider API or database migration is required for v1.7.

## 1.6.1

- Fixed Vercel `EBADENGINE`: `package.json` now declares the Vercel-supported Node major line `24.x` instead of an unavailable exact patch floor.
- Updated local/CI pin to the real current Node.js 24 LTS release `24.19.0`.
- Kept production security guidance explicit: Vercel controls the exact patch inside `24.x`, so the deployed `process.version` must be checked after release.
- Retains the v1.6 R2 deadlock-safe Supabase migration unchanged.

## 1.6.0

- Added mandatory TOTP/AAL2 step-up before workspace financial data and sensitive mutations.
- Added Postgres restrictive AAL2 RLS gates, FORCE RLS and AAL2 checks inside financial SECURITY DEFINER RPCs.
- Added multiple TOTP factors with backup-authenticator selection and global session invalidation after MFA removal.
- Password recovery now globally signs out active sessions after credential rotation.
- Replaced direct browser Supabase signup with same-origin, rate-limited `/api/register`; legal receipts are minted server-side and no longer trust caller-controlled Auth metadata.
- Hardened API credentials with `quote:read` scope, 30/60/90-day expiry, active-key cap and expiry enforcement.
- Applied request-scoped nonce CSP across HTML, removed `unsafe-inline` from production `script-src`, disabled production source maps and expanded security headers.
- Reduced service-role usage on normal user flows and enforced AAL2 before authenticated quote/audit persistence.
- Pinned the Node 24 LTS line and CI actions to exact commit SHAs, added CodeQL and blocked automated semver-major dependency jumps.
- Added `supabase/upgrade-v16.sql`, `SECURITY_HARDENING.md` and `npm run audit:v16`.

## 1.4.0

- Reworked modal and command-palette overlays to remove the heavy blurred backdrop while preserving focus and accessibility.
- Added Vercel geolocation onboarding: country/timezone detection with editable country and automatic reporting-currency suggestion.
- Added a real API Playground for `/api/v1/quote` with local-only key entry, HTTP status, latency and formatted JSON response.
- Added live API health diagnostics for application, database and routing checks.
- Added a 30-day payment commitments forecast to Dashboard using existing payment and FX data.
- Expanded Security Center with sign-in provider, account creation date, verified MFA state, current-session expiry and recent access/profile audit events.
- Improved API empty states and localized one-time secret guidance.

## 1.3.4

- Final release cleanup: removed generated build output, repository internals, bundled dependencies and one-off hotfix utilities from the distributable source archive.
- Source audits no longer read environment files; environment validation remains an explicit private command.
- Fixed the v1.3 onboarding migration/schema signature conflict that could raise PostgreSQL 42P13 when replacing a function that previously had argument defaults.
- Updated React, React DOM and react-is to the 19.1.9 security backport while keeping the existing Next.js line.
- Hardened payment FX handling and server error redaction, removed an unused application-URL fallback helper, and tightened provider summary invariants.
- CI now uses `npm ci` for reproducible installs.
- Updated production API documentation and operational-pruning function naming.

## 1.3.2

- Restored the `noStoreJson` HTTP helper expected by the newer payment API routes, with compatibility for both numeric status and `ResponseInit` call styles.
- Added cached `getProviderRuleSummaries()` for the provider API, returning active non-pricing route metadata only.
- Kept provider pricing, fees, limits and routing internals server-only.
- Made the launch audit version-safe so patch releases no longer fail solely because the package version changed.
- Added launch-audit guards for the API helper exports that caused the Vercel import failures.
- Includes the v1.3.1 startup/prerender fixes: ASCII-safe Windows launcher, environment placeholder checks and lazy browser-only Supabase workspace initialization.

## 1.3.0

- Upgraded Recharts from the deprecated 2.x branch to 3.10.1.
- Added CSP/HSTS/anti-framing/permissions headers, request IDs, body-size limits and redacted backend logging.
- Replaced event-per-request rate limiting with an atomic fixed-window counter.
- Revoked direct authenticated browser mutations for payments, invoices, counterparties, API keys and calculations; validated SECURITY DEFINER RPCs now enforce ownership and lifecycle rules.
- Hid API-key hashes from browser-readable columns.
- Added atomic CSV import RPCs with a 500-row bound.
- Added provider-rule caching, cached health checks, ECB timeout handling and sampled detailed API logs with exact daily usage counters.
- Added query-pattern indexes, operational-data pruning, route-aware workspace loading, CI, Dependabot, security/performance audits and a load-smoke utility.
- Localized the public service-status page and removed deployment-variable wording from the operator UI.
- Added `react-is` 19.1.1 for the Recharts v3 peer contract and exact-pinned all direct dependencies/package-manager version to reduce surprise upgrades.
- Batched workspace FX lookups into one browser request instead of one request per currency.
- Added lazy-loaded chart bundles so Recharts does not inflate the initial workspace JavaScript unnecessarily.
- Added a bounded in-process hot-burst prefilter ahead of the authoritative database rate limiter to reduce write amplification during abuse.
- Restricted authenticated `provider_rules` reads to non-pricing summary columns; fee/FX/limit/route internals stay server-only.
- Hardened `/admin` with immutable user-ID allowlisting only.
- Added retention indexes and removed the obsolete v1.2 event-per-request rate-limit table.
- Added protected daily maintenance cron and optional quote-engine Preview load-smoke testing.

## 1.2.1

- Fixed admin route-rule editor TypeScript state inference for nullable fields.
- Upgrade cleanup now removes the obsolete pre-1.2 Team route when archives are extracted over older project folders.
- Prevents stale Team source files from breaking `npm run typecheck`.

# FlowPay 1.2.0

- Added launch onboarding with company, country, reporting currency and timezone persistence.
- Added an operator-only route catalogue and operational console at `/admin`.
- Added database-backed request limiting for public quote/audit, API quote and account deletion endpoints; limiter failures now fail closed instead of silently disabling protection.
- Added backend system-event logging and a public service-status surface.
- Added idempotent payment creation and transactional database RPCs for payments, counterparties and invoices.
- Added strict payment transitions including failed and cancelled states, plus invoice synchronization.
- Added authenticated profile updates, password recovery and irreversible account deletion with explicit confirmation.
- Added privacy, terms and security pages, robots, sitemap and web manifest for launch packaging.
- Public payment coverage now fails explicitly when required backend data is unavailable.
- Added launch/environment audits, deployment checklist and legal-review handoff.
- No demo pricing, providers or financial records are inserted by this release.

# FlowPay 1.1.0

- Route-comparison history for signed-in users is now persisted server-side from the verified quote response, so browser clients cannot rewrite calculated fees, savings or route snapshots.
- Added real summary KPI rows to Payments, Counterparties, Invoices and API using account data rather than placeholders.
- Rebuilt first-use states across the workspace into commercial onboarding and action-oriented empty states instead of developer diagnostics.
- Redesigned report cards, recent route comparisons and account-readiness surfaces for a more complete finance-operations workflow.
- Counterparty deletion is now protected both in the UI and database when financial history exists.
- Payment-method and charge-type defaults from Settings now persist into newly created payments.
- Reworked the authenticated dashboard into a denser commercial finance workspace with clearer hierarchy, larger typography and more useful empty-account onboarding.
- Dashboard KPIs now remain useful even before a reporting currency is selected: payment counts, route-comparison activity and payment pipeline replace repeated placeholder dashes.
- Analytics now works without a reporting currency by switching monetary breakdowns to real operation counts until normalized reporting is enabled.
- Added commercial empty, error and loading copy across customer-facing screens and removed customer-facing implementation jargon.
- Localized payment, invoice, verification and API statuses across RU / EN / FR / DE / ES.
- Provider codes shown in payment and route views are translated into configured partner display names when available.
- Refined Payments, Counterparties, Routes, Analytics, Reports, Invoices, API and Settings layouts with larger controls, spacing and mobile-friendly states.
- Payment and invoice lifecycle actions synchronize their linked records where applicable.
- Counterparty create/edit/delete, CSV import, payment create/edit/delete, invoice create/edit/import and API-key create/revoke are backed by authenticated server/database operations.
- Activity-center preferences now control real top-bar activity signals.
- Public payment audit copy is fully commercialized and no longer exposes backend error codes.
- Added commercial-copy and backend-contract audits to the release verification suite.
- Team collaboration is not exposed in this release until shared-data authorization is production-ready.
- Added `upgrade-v11.sql`: public route pricing is now served only through server-side FlowPay endpoints; anonymous browser access to pricing tables is removed.

# FlowPay 1.0.3

- Replaced the landing-page native language `<select>` with the FlowPay menu component.
- Replaced every remaining browser-native `<select>` in the workspace with consistent searchable/menu controls.
- Redesigned the landing product preview and corrected the lower preview control: it is a real currency-pair selector, not a route diagram.
- Currency preview options are derived only from active Supabase provider rules; no demo currencies are injected.
- Added localized currency names and symbols to currency controls.
- Improved hero spacing, product-preview hierarchy, borders, shadows and interaction states.
- Preserved real SVG country flags and real-data/empty-state behavior.

# FlowPay changelog

## 1.7.0

- Rebuilt `/admin` into a launch and operations console with Overview, Users, Operations, API, Security and Routes sections.
- Added an AAL2 + immutable-admin allowlist access probe so the Admin console appears in workspace navigation only for authorized operators.
- Expanded admin telemetry to real Supabase Auth users, company onboarding, payments, invoices, counterparties, API keys, API usage/logs, workspace audit trail, system events, legal acceptance receipts and provider coverage.
- Added Launch Center gates for application/database availability, routing coverage, recent system errors plus explicit manual SMTP/legal checks.
- Added client-side search and CSV export for admin user/operation views without introducing a new data-export backend.
- Kept operational totals currency-safe: the console never sums unrelated currencies into a fake global payment volume.
- Added `audit:v17` and expanded the full audit suite to 20 API routes.
- No new external provider API or database migration is required for v1.7.

## 1.0.2

- Fixed stale `.next/types/validator.ts` references after moving authenticated routes into `app/(workspace)`.
- Added cross-platform generated-artifact cleanup for `.next` and `tsconfig.tsbuildinfo`.
- `npm run typecheck` now runs `next typegen` before `tsc --noEmit`, so route validators are regenerated from the current filesystem.
- `npm run build` also starts from a clean generated-output state.
- Project audit now verifies the type-generation/cleanup contract.

# Changelog
## 1.0.4
- Rebuilt searchable currency selectors with a dedicated currency presentation, larger controls, clearer symbols, codes and localized names.
- Increased UI typography across public and workspace screens.
- Increased form control and button heights for better readability and touch targets.
- Refined dropdown shadows, scrolling, focus and selected states.


## 1.0.1

- Fixed the Overview chart translation reference that caused `TS2339` during `npm run typecheck`.
- Added an automatic cross-platform legacy cleanup before `typecheck` and `build`. This removes obsolete pre-v1 pages/components when v1 is extracted over an older FlowPay folder.
- Prevents duplicate `/dashboard`, `/payments`, `/routes`, `/analytics`, `/counterparties` and `/settings` route trees left by overlay upgrades.
- Removes obsolete `DashboardPage`, `Header`, `WorkspaceApp`, `ThemeToggle`, `FlowSelect`, `Reveal` and old `lib/i18n` sources before TypeScript/Next.js scans.
- No database migration is required from 1.0.0.

## 1.0.0

- Rebuilt the entire product around the approved light FlowPay design system.
- Removed legacy dark-theme surfaces and old visual CSS.
- Added Tailwind CSS v4, local shadcn-style primitives, Lucide icons, Inter Variable, Recharts and SVG country flags.
- Added responsive desktop/mobile app shell and mobile bottom navigation.
- Rebuilt landing, auth, overview, payments, counterparties, routes, analytics and settings screens.
- Added reports, invoices, team and developer/API surfaces.
- Added real Supabase-backed empty/loading/error states; no demo financial records or route-price seeds.
- Added dual-currency route quotes and ECB reference conversion for recipient estimates.
- Added API key hashing, API request logs, workspace audit log and v1.0 Supabase migration.
- Added CSV import/export, IBAN/BIC validation and runtime/static audit scripts.

## 1.5.0 — Auth, legal and workspace navigation
- Redesigned sign-in page and separated registration into `/register`.
- Added versioned Privacy Policy and Terms of Service with printable public pages.
- Registration requires scrolling each legal document to the end before acknowledgement/acceptance.
- Stores accepted document versions and timestamps in Supabase Auth user metadata.
- Replaced payment, counterparty, invoice and API-key creation form modals with dedicated workspace pages while preserving the left navigation shell.
- Kept destructive actions as confirmation flows instead of form modals.

### 1.6.0 migration R2
- Reworked `supabase/upgrade-v16.sql` to avoid long-lived multi-table DDL locks.
- MFA policy installation now commits one sensitive table at a time with bounded lock waits.
- Safe to rerun after PostgreSQL `40P01` deadlock failures.

