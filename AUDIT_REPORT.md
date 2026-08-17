# FlowPay v1.8.0 audit report

Release focus: branded TOTP identity, bank-directory UX, currency flags and consistent status badges.

## Verified

- Full FlowPay audit suite: PASS
- Security audit: PASS (22 API routes)
- TypeScript `tsc --noEmit`: PASS
- Lockfile dependency tree: PASS
- v1.8 product-polish regression audit: PASS
- Bank directory endpoint requires AAL2 and rate limiting.
- TOTP enrollment explicitly sets `issuer: FlowPay`.
- Currency selectors use `CurrencyFlag`.
- Release contains no env files, node_modules, .next or .git.

## Build environment limitation

The available dependency archive contains Windows native Next.js binaries. A Linux `next build` attempted to download the matching SWC package, but registry access in the sandbox failed with `EAI_AGAIN`. The source-level TypeScript compile and all project audits pass; run `npm ci` and `npm run build` on Windows/Vercel as the final build gate.
