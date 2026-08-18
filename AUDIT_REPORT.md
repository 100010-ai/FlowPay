# FlowPay v2.1.0 audit report

Release focus: first-run product clarity, guided payment workflow, settlement reconciliation, explicit approval currency, payment event history and safer high-volume operations while preserving the v2.0 control plane and strict production-only routing.

## Verified

- Full FlowPay source/regression audit suite: **PASS**, including v1.4 through v2.1 contracts.
- Security audit: **PASS** (23 API routes).
- Runtime/strict-routing audit: **PASS**.
- Strict-mode audit: **PASS** (54 files).
- TypeScript `tsc --noEmit`: **PASS**.
- FlowPay v2.1 clarity/reconciliation regression audit: **PASS**.
- Public landing and workspace expose one explicit mental model: supplier → payment → options → approval → settlement → reconciliation.
- Desktop and mobile both expose the “How FlowPay works” guide.
- Reconciliation requires bank evidence before a payment can be marked `matched`; actual fee/recipient values are never synthesized.
- `payment_events` is owner-scoped, FORCE RLS-protected and restricted to AAL2 reads; direct authenticated writes are revoked.
- Bulk payment status changes remain transactional and delegate every transition to the existing server-side status/approval gate.
- Approval threshold currency is explicitly persisted and used independently from reporting currency.
- Cross-currency approval does not fabricate FX conversion.
- Provider network catalog remains separate from `provider_rules`; quotes still require an active matching production rule.
- No fallback provider, synthetic fee, synthetic FX rate or fabricated corridor was added.

## Additional defect fixed during v2.1 verification

The first bulk-status SQL draft used an unqualified `payment_id` inside `array_agg` while a PL/pgSQL variable had the same name. That can become an ambiguous reference under PostgreSQL PL/pgSQL name resolution. The query now explicitly uses `u.payment_id` in both `upgrade-v21.sql` and the integrated schema.

## Build environment limitation

A full `npm run build` was attempted in the sandbox. The uploaded dependency tree originated on Windows, so its `.bin/next` entry is not executable on Linux (`Permission denied`). Running Next directly with `node node_modules/next/dist/bin/next build` reached the same environment boundary seen in v2.0: the dependency tree does not include Linux/x64 Next.js SWC, Next attempted to download `@next/swc-linux-x64-gnu`, and the sandbox could not resolve `registry.npmjs.org` (`EAI_AGAIN`). The failure occurs before application compilation.

The sandbox runtime is also Node 22 while the project intentionally targets Node 24.x. Production verification must therefore run from a clean install on Node 24.x.

Production gate:

```bash
npm ci
npm run check:env
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```

For an existing FlowPay 2.0 database, apply `supabase/upgrade-v21.sql` before deploying the 2.1 application bundle.
