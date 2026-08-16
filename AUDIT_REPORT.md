# FlowPay Full Audit Hotfix R4

R4 adds two remediations on top of R3:

1. **Zod runtime safety**
   - Migrates `.extend()` to `.safeExtend()` in source files importing Zod.
   - Contract audit rejects remaining Zod `.extend()` calls so refined schemas cannot crash during Next.js page-data collection.

2. **Production dependency hardening**
   - Pins `postcss` to `8.5.25`.
   - Pins `sharp` to `0.35.3`.
   - Adds npm overrides so Next.js transitive copies resolve to the patched versions.
   - Requires Node.js `>=20.9.0 <25`.
   - Reinstalls the dependency graph before typecheck/build/audit.

Static validation performed on the FlowPay test tree:
- full contract audit: PASS
- strict no-fallback audit: PASS
- UI audit: PASS
- commercial copy audit: PASS
- project audit: PASS
- backend audit: PASS
- runtime audit: PASS
- launch audit: PASS
- security audit: PASS
- performance audit: PASS

The final `npm install`, `npm run typecheck`, `npm run build`, and `npm audit --omit=dev --audit-level=high` must run on the user's current local project because that checkout contains the latest route files and installed dependency graph.
