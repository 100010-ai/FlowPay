# FlowPay 1.7.0 — launch + admin console audit report

Дата прохода: 2026-08-17.

## Privacy boundary

`.env`, `.env.local` и другие env-файлы не открывались, не читались и не изменялись. Для TypeScript-проверки использовался только `node_modules` из ранее загруженного Windows-архива FlowPay; env из него не извлекался.

## Реализовано

- полноценный `/admin` с Overview / Users / Operations / API / Security / Routes;
- AAL2 + immutable user-ID allowlist для всех admin reads и route-rule mutations;
- скрытая для обычных пользователей admin-ссылка в workspace navigation через `/api/admin/access`;
- реальные Supabase Auth users + company onboarding status;
- глобальные counts по payments/invoices/counterparties/audits/calculations/API keys/routing;
- recent payments/invoices, API-key inventory, API logs, 7-day usage aggregates;
- system events, workspace audit trail, legal acceptance receipts;
- Launch Center с production gates и явными manual SMTP/legal gates;
- admin search + bounded CSV export;
- currency-safe metrics: разные валюты не агрегируются в фиктивный global volume;
- существующий provider-rule editor сохранён внутри нового admin console;
- новый `audit:v17`.

## Проверки

- UI audit: PASS — 113 source files.
- Commercial copy audit: PASS — 47 customer-facing source files.
- Project audit: PASS.
- Backend audit: PASS.
- Runtime audit: PASS.
- Launch audit: PASS.
- Security audit: PASS — 20 API routes.
- Performance audit: PASS.
- Strict-mode audit: PASS — 46 files.
- FlowPay v1.4 feature audit: PASS.
- FlowPay v1.5 feature audit: PASS.
- FlowPay v1.6 security audit: PASS.
- FlowPay v1.7 admin/launch audit: PASS.
- Raw TypeScript `tsc --noEmit`: PASS.

## Production build boundary

Полный Linux `next build` не дошёл до компиляции проекта: доступный dependency tree содержит Windows SWC, а sandbox не смог скачать `@next/swc-linux-x64-gnu` из npm (`EAI_AGAIN`). Это platform/dependency limitation данной среды; TypeScript и все source/contract audits проходят. Финальный `npm run build` нужно подтвердить на Windows/Vercel.

## Database boundary

v1.7 не добавляет новую миграцию. Он использует таблицы и hardening из уже применённого `upgrade-v16.sql` R2.

## Перед deploy

```powershell
npm ci
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```
