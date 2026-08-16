# FlowPay 1.2.1

FlowPay is a production-oriented Next.js + Supabase + Vercel workspace for international business-payment operations. Version 1.2.1 is the launch-readiness and production-hardening release built on the commercial 1.1 UI: a denser finance workspace, clearer onboarding, larger typography, customer-facing copy, real database-backed operations, responsive desktop/mobile layouts, and no legacy dark theme.

## What is in 1.2.1

- Guided `/onboarding` flow with company country, reporting currency and timezone persistence.
- Operator-only `/admin` console for real payment-corridor rule CRUD and operational events; access is controlled with `FLOWPAY_ADMIN_EMAILS`.
- Distributed database-backed rate limiting for public audit/quote endpoints and the authenticated quote API.
- Server-side operational event log for backend failures.
- Idempotent/transactional payment creation plus server-side counterparty and invoice write RPCs.
- Strict payment lifecycle including `failed` and `cancelled` states.
- Public `/status`, `/privacy`, `/terms` and `/security` surfaces.
- Production security headers and a launch audit/checklist.

- Commercial product polish across every visible workspace tab, with larger controls, clearer spacing and responsive empty/loading/error states.
- Real payment/invoice lifecycle synchronization, counterparty CRUD/import, API-key lifecycle and activity-center behavior.
- Authenticated route-comparison history is persisted by the server from the verified quote response; the browser does not write calculated fee/savings snapshots directly.
- Payments, Counterparties, Invoices and API surfaces include real account KPIs and commercial first-use states instead of diagnostic placeholders.
- Counterparty deletion is guarded against removing entities with payment or invoice history.
- Settings payment defaults are persisted into newly created payments.
- Payment-provider identifiers are presented as human partner names when configured.
- Team collaboration is intentionally not surfaced until shared-data authorization is production-ready.
- Next.js App Router + React + TypeScript.
- Tailwind CSS v4 and local shadcn-style UI primitives.
- Lucide SVG icons, Inter Variable, Recharts, `country-flag-icons` SVG flags.
- Supabase Auth, Postgres and Row Level Security. Public pricing/routing rules stay server-side; browser clients do not receive direct anonymous table access.
- Public landing, localized auth, Overview, Payments, Counterparties, Routes, Analytics, Reports, Invoices, API and Settings.
- RU / EN / FR / DE / ES interface support.
- Separate responsive mobile layouts including bottom navigation, card-based payment views, drawers/dialogs and touch-sized controls.
- Real ECB reference FX through `/api/fx`; ECB rates are always presented as reference data, never as executable quotes.
- Route Engine uses only active `provider_rules` stored in Supabase. No seeded/demo prices are included.
- Dual-currency quotes: source currency and recipient currency are explicit.
- Dashboard and analytics use authenticated account data only. Before a reporting currency is selected, FlowPay shows real operation counts instead of fabricated monetary totals or repeated placeholder warnings.
- Customer-facing text avoids database, policy and implementation jargon; internal infrastructure details stay internal.
- Counterparty bank details with IBAN checksum and BIC validation.
- Payment draft lifecycle: draft → ready → paid → received.
- Real CSV import/export helpers and printable/PDF report view.
- API-key creation with one-time raw secret display and SHA-256 hash storage.
- Authenticated `POST /api/v1/quote` with API-request logs.
- Metadata-only audit log for workspace changes.

## Data integrity rules

FlowPay 1.2.1 deliberately does **not** fabricate financial data.

- No sample customers, payments, providers, commissions or dashboard totals are inserted.
- No fallback payment route is generated when `provider_rules` has no match.
- No synthetic FX rate is generated when ECB has no reference conversion.
- `recipient_amount` is stored only when a real route quote supplied a reference conversion.
- Charts and KPIs omit unsupported currency conversions instead of estimating them.

A provider rule used for a cross-currency route should list **both** the source and recipient ISO 4217 currencies in its `currencies` array. Example: an EUR → TRY corridor should contain both `EUR` and `TRY`.


## Upgrading an existing local folder

FlowPay 1.0 changed the route/component structure substantially. If you extract this archive **over** a pre-v1 project directory, old files can remain on disk because ZIP extraction does not delete files that no longer exist. Those leftovers can create duplicate routes or TypeScript errors.

This patch handles both legacy source files **and stale Next.js generated route types** automatically:

```bash
npm run typecheck
# 1) removes known pre-v1 source leftovers
# 2) removes .next + tsconfig.tsbuildinfo
# 3) runs next typegen against the current App Router tree
# 4) runs tsc --noEmit

npm run build
# also starts from a clean .next directory
```

This specifically prevents old `.next/types/validator.ts` files from importing routes that moved into `app/(workspace)`. For the cleanest upgrade, extracting the archive into a new empty directory is still recommended. FlowPay 1.1.0 introduced a security migration that moves public route-pricing access behind server-side endpoints. Run the required migrations through `supabase/upgrade-v12.sql` when upgrading. FlowPay 1.2 adds launch-readiness tables and RPCs but does not insert provider pricing.

## Environment variables

Copy `.env.example` to `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
FLOWPAY_ADMIN_EMAILS=owner@your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
```

`SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it through `NEXT_PUBLIC_*`. The normal authenticated dashboard uses the publishable key plus RLS. The service-role key is required by `/api/v1/quote` to verify hashed FlowPay API keys and write API usage logs.

## Supabase setup

### Fresh project

Run the complete file in Supabase SQL Editor:

```text
supabase/schema.sql
```

### Existing FlowPay v0.5.x database

Run the upgrades in order:

```text
supabase/upgrade-v10.sql
supabase/upgrade-v11.sql
supabase/upgrade-v12.sql
```

`upgrade-v10.sql` adds the v1 product tables/columns. `upgrade-v11.sql` moves anonymous route-pricing access behind FlowPay server endpoints. Neither migration creates provider pricing.

### Existing FlowPay 1.0.x database

Run in order:

```text
supabase/upgrade-v11.sql
supabase/upgrade-v12.sql
```

### Existing FlowPay 1.1.x database

Run once:

```text
supabase/upgrade-v12.sql
```

After the migration, sign in with an operator account configured in `FLOWPAY_ADMIN_EMAILS` and use `/admin` to configure verified payment routes.

## Local run

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Verification commands

```bash
npm run check:env
npm run audit
npm run typecheck
npm run build
```

`npm run audit` runs static UI/product invariants plus runtime checks for routing, dual-currency recipient projection, IBAN/BIC validation and CSV parsing.

## Public route quote

The public calculator uses:

```http
POST /api/quote
Content-Type: application/json
```

```json
{
  "fromCountry": "FR",
  "toCountry": "TR",
  "amount": 25000,
  "sourceCurrency": "EUR",
  "recipientCurrency": "TRY"
}
```

The response can contain zero routes. That means there is no active matching provider rule; FlowPay does not invent one.

## Authenticated API

Create an API key in **Developer → API keys**, then call:

```bash
curl -X POST https://YOUR_DOMAIN/api/v1/quote \
  -H "Authorization: Bearer $FLOWPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromCountry":"FR",
    "toCountry":"TR",
    "amount":25000,
    "sourceCurrency":"EUR",
    "recipientCurrency":"TRY"
  }'
```

The raw `fp_live_...` secret is shown once. Only its SHA-256 hash is persisted.

## Vercel deployment

1. Push/import the repository into Vercel.
2. Add all required environment variables from `.env.example` to the desired Vercel environments.
3. Run the fresh schema, or the required upgrade files for your current FlowPay version.
4. Configure real provider rules.
5. Deploy.

No separate Node server is required; the Next.js route handlers run on Vercel.

## Launch handoff

See `LAUNCH_CHECKLIST.md` for the exact private-beta smoke flow and the remaining external work that requires your domain, legal entity, real provider contracts, production email and compliance review.

## Important payment/compliance boundary

FlowPay 1.2 is an operations/routing workspace. It does not itself custody, settle, exchange or transmit customer funds. Any future real-money execution, balance or instant-payout feature should be connected through appropriately licensed payment infrastructure and reviewed for the jurisdictions in which it operates.

## Build note for this delivered archive

The source-level UI/project audits and local runtime invariants were executed in the build environment. The environment could not reach the npm registry, so a dependency install and full `next build` could not be completed there. Run `npm install && npm run typecheck && npm run build` in your normal connected environment before production deployment.
