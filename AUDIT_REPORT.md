# FlowPay 1.5.0 — auth, legal and workspace UX audit report

Дата прохода: 2026-08-17.

## Privacy boundary

Файлы окружения не открывались, не читались, не анализировались и не изменялись. Рабочая копия создана из env-free FlowPay 1.4 release archive. `npm run check:env` намеренно не запускался.

## Что изменено в 1.5

- Полностью переработан `/login`: исправлена композиция, убрана старая склейка навигации/бренда, добавлены security/trust surface, понятный reset-password UX и отдельная регистрация.
- Добавлен `/register` с последовательностью Privacy Policy → Terms of Service → Account. Checkbox каждого legal шага заблокирован до прокрутки документа до конца.
- Privacy и Terms централизованы и версионируются в `lib/legal.ts`; `/privacy` и `/terms` получили содержание, нормальную читаемую верстку и Print/PDF.
- Регистрация отправляет версии Privacy/Terms и явные acknowledgement/acceptance flags.
- `supabase/upgrade-v15.sql` добавляет `public.legal_acceptances` и trigger на `auth.users`. Время принятия формируется сервером из `auth.users.created_at`; authenticated/anon не имеют INSERT/UPDATE/DELETE к журналу.
- Платежи, контрагенты, счета и создание API-ключей перенесены с form-modals на отдельные `(workspace)` routes. Sidebar/topbar сохраняются через общий workspace layout.
- Добавлены `/payments/new`, `/payments/:id/edit`, `/counterparties/new`, `/counterparties/:id/edit`, `/invoices/new`, `/invoices/:id/edit`, `/developer/keys/new`.
- Workspace data loader стал nested-route aware, чтобы прямой переход на `/new`/`/:id/edit` загружал нужные full-detail datasets. Edit pages имеют loading guard до проверки entity ID.
- Старые `PaymentDialog`, `CounterpartyDialog`, `InvoiceDialog` удалены. Destructive actions остаются confirmation flows.
- Signed-out primary CTA на landing ведет в `/register`; явный Sign in ведет в `/login`.
- Добавлен `scripts/v15-feature-audit.mjs` / `npm run audit:v15`.
- Версия проекта и lock metadata: `1.5.0`.

## Пройденные проверки

- `full-contract-audit`: PASS — 77 source modules, 18 API files.
- `ui-audit`: PASS — 106 source files.
- `commercial-copy-audit`: PASS — 45 customer-facing source files.
- `project-audit`: PASS — local imports and production-data invariants.
- `backend-audit`: PASS — database/API-key/rate-limit/RLS contracts.
- `runtime-audit`: PASS — routing/FX/IBAN/BIC/CSV invariants.
- `launch-audit`: PASS.
- `security-audit`: PASS — 18 API routes, RLS/headers/body limits/rate limits/request IDs.
- `performance-audit`: PASS.
- `strict-mode-audit`: PASS — 42 files.
- `v14-feature-audit`: PASS.
- `v15-feature-audit`: PASS — legal scroll gate, server-side acceptance ledger, nested workspace forms/no legacy form dialogs.
- Raw TypeScript `tsc --noEmit`: PASS using only the dependency tree from the user's uploaded FlowPay archive; no env files were extracted.
- `npm ls --package-lock-only react react-dom react-is next postcss sharp`: PASS; React family 19.1.9, Next 15.5.23, PostCSS 8.5.25, Sharp 0.35.3.
- Package/package-lock version coherence: PASS (`1.5.0`).
- Env-file release guard: PASS — 0 env files in release tree.
- High-confidence embedded-secret scan: PASS.
- Legacy form-dialog reference scan: PASS — 0 app/component references.

## Production-build sandbox limitation

`next build` was attempted. Next tried to fetch `@next/swc-linux-x64-gnu`, because the available dependency tree came from the user's Windows project. The sandbox cannot resolve `registry.npmjs.org` (`EAI_AGAIN`), so the Linux SWC package could not be downloaded and the build stopped before compiling application code.

Therefore this report does **not** mark local `next build` or online `npm audit` as PASS. Run both on Windows/Vercel after `npm ci`.

## Database migration required for existing FlowPay 1.3/1.4 database

Run once in Supabase SQL Editor:

```text
supabase/upgrade-v15.sql
```

A fresh database may use the complete `supabase/schema.sql` instead.

## Legal launch boundary

The project now contains substantial Privacy/Terms pages and a tamper-resistant browser boundary for recording acceptance. They are still product legal drafts, not a substitute for jurisdiction-specific legal review. Before paid public launch, fill in the actual operator legal name, address, privacy contact, governing law/dispute forum, relevant subprocessors/retention details and commercial/payment-provider terms.

## Проверка перед deploy

```powershell
npm ci
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```

`npm run check:env` remains a separate private owner check and was intentionally not executed during this audit.
