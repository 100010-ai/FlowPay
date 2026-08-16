FlowPay v1.3.3 Full Audit Hotfix R4

Fixes added in R4:
- Zod 4 refined-schema runtime crash: .extend() -> .safeExtend() across Zod sources
- hard-pins patched PostCSS 8.5.25 and Sharp 0.35.3
- npm overrides force Next.js transitive copies to the patched versions
- requires Node.js >=20.9.0 <25 (Sharp 0.35 runtime requirement)
- reinstalls dependency graph, then runs contract/strict/env/security/typecheck/build/npm-audit

Usage from D:\flowpay-mvp:
  powershell -ExecutionPolicy Bypass -File .\APPLY_FULL_FIX.ps1

Only push after: [full-audit] ALL CHECKS PASSED
