# FlowPay 1.4.0 — product upgrade audit report

Дата прохода: 2026-08-17.

## Privacy boundary

Файлы окружения не открывались, не читались, не анализировались и не изменялись. Рабочая копия создана из env-free release-архива. `npm run check:env` намеренно не запускался.

## Что изменено в 1.4

- Убран тяжёлый blurred backdrop у `Dialog`, command palette и mobile drawer. Overlay оставлен лёгким и без размытия контента страницы.
- Добавлен `/api/geo`, использующий `x-vercel-ip-country`, `x-vercel-ip-timezone` и `x-vercel-ip-country-region` от Vercel. Невалидные/отсутствующие значения не подменяются выдуманными.
- Onboarding автоматически предлагает страну, timezone и базовую валюту; пользователь может изменить страну и валюту перед сохранением.
- Developer/API page получила настоящий API Playground для `/api/v1/quote`: API key остаётся только в React state вкладки, показываются HTTP status, latency и JSON body.
- На Developer page добавлена live-проверка `/api/health` для application/database/routing.
- Dashboard получил 30-дневный прогноз активных платёжных обязательств; если reference FX для части валют отсутствует, сумма не подменяется неполным значением.
- Settings/Security Center показывает auth provider, дату создания аккаунта, verified MFA state, expiration текущей сессии и последние изменения API/profile из `workspace_audit_log`.
- API empty states получили явные действия и объяснение интеграционного сценария.
- Добавлен `scripts/v14-feature-audit.mjs` / `npm run audit:v14` для защиты новых функций от регрессий.
- Версия проекта и lock metadata подняты до `1.4.0`.

## Пройденные проверки

- `full-contract-audit`: PASS — 68 source files, 18 API files.
- `zero-ui-audit`: PASS.
- `ui-audit`: PASS — 96 source files.
- `commercial-copy-audit`: PASS — 37 customer-facing files.
- `project-audit`: PASS — local imports and production-data invariants.
- `backend-audit`: PASS — database/API-key/rate-limit/RLS contracts.
- `runtime-audit`: PASS — routing/FX/IBAN/BIC/CSV invariants.
- `launch-audit`: PASS.
- `security-audit`: PASS — 18 API routes, RLS/headers/body limits/rate limits/request IDs.
- `performance-audit`: PASS.
- `strict-mode-audit`: PASS — 41 files.
- `v14-feature-audit`: PASS.
- Raw TypeScript `tsc --noEmit`: PASS using the dependency tree from the uploaded FlowPay project.
- `npm ls --package-lock-only react react-dom react-is next postcss sharp`: PASS; lock tree coherent at FlowPay 1.4.0.
- Env-file release guard: PASS — 0 env files in release tree.
- High-confidence embedded-secret scan: PASS.

## Ограничение sandbox

Полный `next typegen` / `next build` не может быть доказан в этой Linux-среде: загруженный локальный dependency tree содержит Windows-native Next SWC, а npm registry из sandbox недоступен (`EAI_AGAIN`), поэтому Linux SWC невозможно скачать. По той же причине здесь нельзя повторно выполнить online `npm audit`.

Это ограничение среды проверки, а не скрытый PASS. Финальный production build нужно подтвердить на Windows/Vercel после `npm ci`.

## Проверка перед deploy

```powershell
npm ci
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```

`npm run check:env` оставлен отдельной приватной командой владельца и в этом проходе не выполнялся.
