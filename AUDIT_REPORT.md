# FlowPay v2.0.0 audit report

Release focus: payment-operations control plane, deterministic approval controls, treasury commitments, unified activity and a redesigned workspace while preserving strict production-only routing.

## Verified

- Full FlowPay audit suite: **PASS** after updating legacy version guards for the 2.0 major line.
- Security audit: **PASS** (23 API routes).
- Runtime/strict-routing audit: **PASS**.
- Strict-mode audit: **PASS** (54 files).
- TypeScript `tsc --noEmit`: **PASS**.
- FlowPay v2.0 platform regression audit: **PASS**.
- Approval state is enforced server-side by SQL/RPC transitions, not only by UI.
- Cross-currency approval policy does not fabricate FX conversions.
- Treasury normalization excludes currencies whose reference FX is unavailable instead of inventing a rate.
- Provider network catalog remains separate from `provider_rules`; quotes still require an active matching production rule.
- No fallback provider, synthetic fee, synthetic FX rate or fabricated corridor was added.
- Registration v1.9 schema preflight/legal receipt hardening remains covered by regression tests.
- Expected approval workflow conflicts are mapped to domain 4xx responses and are not misclassified as server incidents.
- Supabase/PostgREST plain-object errors preserve only a redacted top-level message in operational logging.

## Build environment limitation

A full `next build` was attempted in the sandbox after source audits. The dependency tree available from the uploaded Windows project does not contain the Linux/x64 Next.js SWC binary. Next.js attempted to download `@next/swc-linux-x64-gnu`, but the sandbox could not resolve `registry.npmjs.org` (`EAI_AGAIN`). The failure occurs before application compilation and is an environment/dependency-availability limitation.

`npm run typecheck` also invokes Next type generation; the copied Windows dependency tree exposes a non-executable `.bin/next` in this Linux sandbox, and direct `next typegen` reaches the same missing-Linux-SWC/network boundary. The underlying TypeScript compiler was therefore run directly and passes with `tsc --noEmit`.

Production gate remains:

```bash
npm ci
npm run check:env
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```

Run it with Node 24.x and network access in the target CI/Vercel environment.
