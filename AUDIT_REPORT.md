# FlowPay 1.3.4 — final audit report

Дата финального прохода: 2026-08-16.

## Privacy boundary

Файлы окружения не открывались, не читались, не анализировались и не изменялись. Рабочая копия для аудита была создана без `.env` / `.env.*`, а итоговый архив также их не содержит. Проверка `check:env` намеренно не запускалась.

## Что очищено

- `node_modules`, `.next`, `.git`, `tsconfig.tsbuildinfo` и прочие generated/local artifacts исключены из дистрибутива.
- Удалены одноразовые `APPLY_*`/hotfix-скрипты и временные README, использовавшиеся только во время ремонта предыдущих сборок.
- Удалён неиспользуемый helper URL с резервными ветками.
- Windows launcher и CI переведены на `npm ci` для воспроизводимой установки по lock-файлу.
- Публичный API-пример использует production-домен FlowPay.

## Исправления

- Проект поднят до `1.3.4`; `package.json` и `package-lock.json` синхронизированы.
- React / React DOM / React Is закреплены на `19.1.9`.
- Next.js оставлен на текущей линии `15.5.23`.
- PostCSS и Sharp закреплены/override-нуты на исправленных версиях, уже выбранных проектом.
- Исправлена несовместимость PostgreSQL `42P13` для `flowpay_complete_onboarding(text,text,text,text)`.
- `upgrade-v13.sql` безопасно удаляет старую сигнатуру перед пересозданием функции без `CASCADE`; критический блок заключён в транзакцию.
- `schema.sql` больше не создаёт раннюю версию onboarding-функции с default-параметром, который конфликтует с поздней hardened-версией.
- Усилены проверки SQL-регрессии в backend audit.
- Исправлены строгие контракты payment/FX/provider routes, request ID, no-store и server-only проверки из предыдущих ремонтных итераций.
- Числовые KPI используют `0` там, где ноль семантически корректен; смысловые «нет данных» по-прежнему отображаются отдельно.

## Пройденные проверки

- `cleanup-legacy`: PASS — 14 legacy paths checked.
- `cleanup-generated`: PASS.
- `full-contract-audit`: PASS — 67 source files, 17 API files.
- `zero-ui-audit`: PASS.
- `ui-audit`: PASS — 95 source files.
- `commercial-copy-audit`: PASS — 37 customer-facing files.
- `project-audit`: PASS — local imports and production-data invariants.
- `backend-audit`: PASS — database/API-key/rate-limit/RLS contracts.
- `runtime-audit`: PASS — routing/FX/IBAN/BIC/CSV invariants.
- `launch-audit`: PASS.
- `security-audit`: PASS — 17 API routes, RLS/headers/body limits/rate limits/request IDs.
- `performance-audit`: PASS.
- `strict-mode-audit`: PASS — 40 files.
- Raw TypeScript `tsc --noEmit`: PASS.
- `npm ls --package-lock-only react react-dom react-is next postcss sharp`: PASS; lock tree coherent at FlowPay 1.3.4.
- High-confidence embedded-secret literal scan on the final env-free source tree: PASS.

## Что нельзя было доказать в sandbox

Полный `next build` / `next typegen` не был завершён в Linux sandbox: исходный архив содержал Windows-native `node_modules`, поэтому Linux SWC binary отсутствовал. Sandbox также не смог обратиться к npm registry (`EAI_AGAIN`), чтобы установить Linux-native SWC. По той же сетевой причине online `npm audit` не получил ответ от npm audit endpoint.

Это ограничение проверочной среды, поэтому production build и online dependency audit должны быть окончательно подтверждены после чистого `npm ci` в Windows/Vercel/CI.

## Финальная проверка перед production

В окружении владельца проекта:

```bash
npm ci
npm run check:env
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```

`check:env` оставлен отдельной приватной проверкой и в этом аудите не запускался.
