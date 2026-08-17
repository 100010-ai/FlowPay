# FlowPay 1.6.1 — security hardening + Vercel runtime compatibility audit report

Дата прохода: 2026-08-17.

## Privacy boundary

`.env`, `.env.local` и другие env-файлы не открывались, не читались, не анализировались и не изменялись. `npm run check:env` намеренно не запускался. Рабочая security-копия собрана из env-free FlowPay 1.5 release archive.

## Реализовано

- mandatory AAL2/TOTP перед workspace data;
- multiple TOTP factors + backup authenticator selection;
- AAL2 server gates на sensitive mutations/admin/account/API keys;
- AAL2 restrictive + ownership RLS, `FORCE RLS` и AAL2 mutation RPCs;
- server-controlled same-origin `/api/register` вместо browser `auth.signUp()`;
- server-trusted legal acceptance receipts; v1.5 metadata trigger отключается, старые receipts помечаются `legacy_registration`;
- rollback свежего Auth-пользователя при неуспешной записи server-trusted legal receipts;
- одноразовый onboarding RPC: AAL1 bootstrap нельзя повторно использовать как обход AAL2 profile update;
- global session invalidation после password reset и удаления MFA factor;
- request-scoped nonce CSP на HTML, production script CSP без `unsafe-inline`;
- tab-scoped Supabase Auth storage (`sessionStorage`) вместо persistent browser `localStorage`;
- hardened browser headers/HSTS/source-map policy + `/.well-known/security.txt`;
- API-key `quote:read` scope, 30/60/90-day expiry, active-key cap and expiry enforcement;
- application/database rate limits and bounded bodies; server-log redaction для credential/email/IBAN-like данных;
- reduced service-role surface;
- pinned Node/CI GitHub Action SHAs, CodeQL and blocked automated semver-major jumps;
- automatic removal of legacy workspace form-dialog files.

## Проверки

- UI audit: PASS — 110 source files.
- Commercial copy audit: PASS — 46 customer-facing files.
- Project audit: PASS — local imports and production-data invariants.
- Backend audit: PASS.
- Runtime audit: PASS.
- Launch audit: PASS.
- Security audit: PASS — 19 API routes.
- Performance audit: PASS.
- Strict-mode audit: PASS — 44 files.
- FlowPay v1.4 feature audit: PASS.
- FlowPay v1.5 feature audit: PASS.
- FlowPay v1.6 security audit: PASS.
- Raw TypeScript `tsc --noEmit`: PASS using only `node_modules` from the user's previously uploaded Windows FlowPay archive. No env file was extracted for this check.

## SQL validation boundary

`supabase/upgrade-v16.sql` прошёл source/contract structural checks и включён в общий security audit. В этой sandbox-среде нет подключённого Supabase project tool/psql, поэтому миграция не применялась к production database автоматически. Её нужно выполнить в Supabase SQL Editor и затем проверить Database/Auth advisors.

## Production build boundary

Полный Linux `next build` нельзя честно отметить PASS в этой среде: доступный dependency tree содержит Windows SWC, а sandbox не может скачать Linux SWC из npm registry. Direct TypeScript проходит; окончательный `npm run build` нужно подтвердить на Windows и Vercel.

## Обязательная миграция существующей базы

```text
supabase/upgrade-v15.sql
supabase/upgrade-v16.sql
```

Если v1.5 уже применена — запускается только `upgrade-v16.sql`.

## Platform boundary

Исходный код не доказывает состояние Supabase Auth settings, Vercel WAF или GitHub repository rules. Ручные production checks перечислены в `SECURITY_HARDENING.md` и `SECURITY_DEPLOYMENT.md`.

## Перед deploy

```powershell
npm ci
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```

`npm run check:env` остаётся отдельной приватной проверкой владельца и в этом аудите не запускался.


## v1.6.1 runtime compatibility patch

- Vercel engine declaration: `24.x` (platform-supported major-line selector).
- Local/CI pin: Node `24.19.0`.
- The exact Vercel patch is platform-controlled and must be verified from deployment/runtime output.
