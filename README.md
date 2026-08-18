# FlowPay 2.0

FlowPay — B2B payment operations platform: сравнение production-маршрутов международных платежей, платёжный workflow, контроль согласований, обязательства, контрагенты, счета, отчётность и API. Версия 2.0 превращает workspace из набора отдельных экранов в единый **control plane** для ежедневной работы с платежами.

Ключевой инвариант не изменился: **никаких fallback-маршрутов**. Quote создаётся только из активных проверенных `provider_rules`; если подходящего правила нет, FlowPay возвращает отсутствие маршрута. Каталог платёжных сетей, справочные FX-курсы и UI никогда не подменяют production pricing.

## Что нового в 2.0

- **Operations Center (`/operations`)** — приоритетная рабочая очередь из реальных данных: просрочки, ближайшие платежи, routing gaps, approval queue, счета без платежей, неполные банковские реквизиты и устаревшие provider rules.
- **Payment Controls (`/approvals`)** — настраиваемый approval gate по сумме и reporting currency с immutable snapshot каждой request/decision записи. Для cross-currency платежей контроль не делает синтетическую FX-конвертацию: такой платёж требует явного согласования.
- **Treasury (`/treasury`)** — 7/30/90-day commitments, overdue exposure, валютная структура и календарь обязательств. Нормализация выполняется только при наличии референсного FX; отсутствующие курсы не выдумываются и остаются отдельными валютами.
- **Settlement Watch** — оплаченные платежи, которые не получили `Received` после ETA сохранённого production route, автоматически попадают в Operations. Если у платежа нет route ETA, FlowPay его не выдумывает.
- **Activity (`/activity`)** — единая timeline платежных изменений, approval events и workspace/security audit событий.
- **Duplicate Guard** — форма платежа предупреждает о вероятном дубле по контрагенту, invoice number либо комбинации amount/currency/due date. Предупреждение не скрывает данные и не делает необратимых действий.
- **Approval Preview** — ещё до сохранения форма показывает, попадёт ли платёж под текущую policy.
- **Command Palette / Global Search (`Ctrl/Cmd + K`)** — быстрый переход к разделам, действиям, платежам, контрагентам и счетам.
- **Dashboard Control Hub** — Ops Score, critical tasks, approvals, routing health и next best action прямо на главном экране.
- **Route Intelligence** — выдача маршрутов показывает только фактически подходящие production rules, freshness источников, cheapest/fastest варианты и явно фиксирует отсутствие fallback.
- **Admin 2.0 telemetry** — approval queue и контрольные статусы добавлены в operator console.
- Обновлена навигация, mobile shell, таблицы, карточки и визуальная иерархия. Интерфейс стал плотнее и ровнее без декоративного шума.
- Добавлена миграция `supabase/upgrade-v20.sql` и regression audit `npm run audit:v20`.

### Важное ограничение approval-системы

Текущая модель FlowPay остаётся user-owned workspace. Approval в 2.0 — это **явный контрольный checkpoint**, а не полноценная segregation-of-duties / maker-checker схема между разными сотрудниками. Для настоящего four-eyes контроля потребуется отдельная multi-user organization/roles модель.

## Что нового в 1.9

- Добавлен отдельный каталог из 13 международных платёжных/инфраструктурных сетей с документированным охватом и официальным источником. Каталог не содержит тарифов и сам по себе не создаёт маршрут.
- Платформенный справочник содержит 249 ISO стран/территорий и 153 валюты; route-rule editor теперь позволяет назначать весь справочник валют одному проверенному правилу, а не максимум 12.
- Public/Admin coverage разделены на **network catalog** и **production routing**, чтобы большой потенциальный охват не выдавался за реально подключённые маршруты.
- В admin Routes добавлены provider presets и источники; цены, лимиты и комиссии по-прежнему вводятся только как проверенные production rules.
- Исправлен сценарий `REGISTRATION_ROLLBACK_FAILED`: v1.9 проверяет готовность legal-ledger schema до `auth.signUp`, пишет обе legal receipts одним server-only RPC и отдельно журналирует первичную ошибку и ошибку rollback.
- Сбой `system_event_logs` больше не превращает успешную основную операцию в HTTP 500.
- Добавлена `supabase/upgrade-v19.sql` и regression audit `npm run audit:v19`.

**Fallback-маршрутов нет.** Если для страны, валют и суммы нет активного проверенного правила, FlowPay возвращает отсутствие доступного маршрута и ничего не синтезирует.

## Что нового в 1.7

- `/admin` переработан в единый operator console: Overview / Users / Operations / API / Security / Routes.
- Admin link появляется в workspace только после AAL2-проверки и подтверждения immutable user-ID allowlist на сервере.
- Панель показывает реальные Supabase Auth users, компании, платежи, счета, контрагентов, API keys/usage/logs, system events, audit trail, legal receipts и provider coverage.
- Launch Center отделяет автоматически проверяемые production gates от ручных SMTP/legal gates.
- Добавлены поиск и CSV-экспорт уже загруженных admin-данных.
- Разные валюты намеренно не складываются в фиктивный общий оборот.
- Новых внешних API и новой DB migration для v1.7 не требуется.

## Security baseline 1.6

- Workspace financial data доступен только после TOTP step-up до AAL2.
- Второй фактор проверяется не только UI: `upgrade-v16.sql` добавляет restrictive AAL2 policies, FORCE RLS и AAL2 проверки внутри mutation RPC.
- Security Center поддерживает основной и резервные TOTP-факторы; `/mfa` позволяет выбрать рабочий authenticator.
- Password reset и удаление MFA factor завершают активные sessions глобально.
- `/register` больше не вызывает Supabase signup напрямую из браузера: same-origin server endpoint ограничивает body/rate и записывает server-trusted legal receipts.
- API keys получили `quote:read`, 30/60/90-day lifetime, active-key cap и обязательный AAL2 lifecycle.
- HTML использует request-scoped nonce CSP; production `script-src` без `unsafe-inline`; расширены security headers и отключены browser source maps.
- CI hardening: Node 24.19.0 in CI/local tooling; Vercel uses the platform-managed 24.x patch, pinned GitHub Action SHA, CodeQL, no automatic semver-major Dependabot jumps.
- Добавлен отдельный `SECURITY_HARDENING.md` и `npm run audit:v16`.

## Что нового в 1.5

- Полностью переработана страница входа и отдельная `/register`.
- Privacy → Terms → Account с обязательным review документов.
- Создание/редактирование платежей, контрагентов и счетов вынесено из form-modals на отдельные workspace pages.
- `upgrade-v15.sql` добавляет legal acceptance ledger.

## Что нового в 1.4

- Модальные окна и command palette используют лёгкий overlay без сильного blur и «серой плёнки».
- Onboarding определяет страну и timezone по Vercel geolocation headers, предлагает базовую валюту и оставляет все значения редактируемыми.
- Раздел API получил рабочий API Playground с реальным `/api/v1/quote`, HTTP status, latency и JSON response. Введённый `fp_live_...` не сохраняется.
- Раздел API показывает live health приложения, базы и routing engine через `/api/health`.
- Dashboard показывает прогноз платёжных обязательств на ближайшие 30 дней по фактическим активным платежам и доступным ECB reference rates.
- Security Center показывает способ входа, состояние MFA, срок текущей сессии и последние изменения API-доступа/профиля из audit log.
- Добавлен `npm run audit:v14`, который защищает новые продуктовые функции от регрессий.

FlowPay 2.0 сохраняет security baseline v1.6, production-only routing v1.9 и добавляет `supabase/upgrade-v20.sql`. Для существующей базы миграции применяются последовательно; v2.0 migration выполняется последней.

## Что изменилось в 1.3

- Recharts обновлён с устаревшей ветки 2.x до `3.10.1`; React/React DOM/React Is закреплены на одной версии.
- Критические финансовые INSERT/UPDATE/DELETE из браузера отключены. Изменения платежей, контрагентов и счетов выполняются через валидируемые RPC/API с проверкой владельца.
- Жизненный цикл платежей и счетов проверяется транзакционно; повторные/недопустимые переходы блокируются.
- API-ключи генерируются криптографически, хранятся только как SHA-256 hash, а hash-колонка не доступна браузеру.
- Таблица правил маршрутизации больше не раскрывает клиенту комиссии, FX markup, лимиты и route steps; браузеру доступен только минимальный безопасный summary активных партнёров.
- Сервер использует только `SUPABASE_SECRET_KEY`; альтернативные серверные ключи не поддерживаются.
- Добавлен атомарный rate limiter, request ID, ограничение размера JSON body и очистка серверных логов от секретов/банковских данных.
- Добавлены CSP/HSTS/anti-framing/MIME/permissions security headers.
- Правила маршрутов и ECB FX кэшируются; внешний FX-запрос имеет timeout.
- Workspace загружает данные по вкладкам, повторно использует свежие выборки и ограничивает объём строк.
- Добавлены индексы под рабочие запросы и отдельные индексы для retention-cleanup больших operational tables.
- Детальные API-логи семплируются, точная статистика хранится дневными агрегатами.
- Добавлен защищённый maintenance cron для очистки старых rate-limit/API/system-event записей.
- Добавлены security/performance audits и безопасный Preview load-smoke test.
- В CI выполняются audit, typecheck, build и production dependency audit.

## Стек

- Next.js 15.5.23 / App Router / TypeScript
- React 19.1.9
- Supabase Auth + Postgres + RLS
- Vercel
- Recharts 3.10.1
- Tailwind CSS 4

## Переменные окружения

Файлы окружения намеренно не входят в исходный архив FlowPay. Храни реальные значения только локально и в настройках deployment-платформы. Проверка конфигурации вынесена в отдельную команду `npm run check:env` и не запускается обычным source-аудитом.

## Настройка базы

### Новый проект

Выполни целиком:

```text
supabase/schema.sql
```

### База уже на FlowPay 1.9.x

```text
supabase/upgrade-v20.sql
```

### База на FlowPay 1.8.x

```text
supabase/upgrade-v19.sql
supabase/upgrade-v20.sql
```

### База на FlowPay 1.6 / 1.7.x

```text
supabase/upgrade-v171.sql
supabase/upgrade-v19.sql
supabase/upgrade-v20.sql
```

### База на FlowPay 1.5

```text
supabase/upgrade-v16.sql
supabase/upgrade-v171.sql
supabase/upgrade-v19.sql
supabase/upgrade-v20.sql
```

### База на FlowPay 1.3/1.4

```text
supabase/upgrade-v15.sql
supabase/upgrade-v16.sql
supabase/upgrade-v171.sql
supabase/upgrade-v19.sql
supabase/upgrade-v20.sql
```

### База на FlowPay 1.2.x

```text
supabase/upgrade-v13.sql
supabase/upgrade-v15.sql
supabase/upgrade-v16.sql
supabase/upgrade-v171.sql
supabase/upgrade-v19.sql
supabase/upgrade-v20.sql
```

Для ещё более старой базы сначала последовательно выполни имеющиеся `upgrade-v10.sql` → `upgrade-v13.sql`, затем `upgrade-v15.sql`, `upgrade-v16.sql`, `upgrade-v171.sql`, `upgrade-v19.sql` и **последней** `upgrade-v20.sql`.

**Важно:** `upgrade-v19.sql` по-прежнему нужен до открытия регистрации, а `upgrade-v20.sql` должен быть применён **до деплоя UI/API FlowPay 2.0**. Код 2.0 читает approval-поля и `payment_approval_events`; без миграции workspace будет получать ошибки загрузки.

Миграции не добавляют выдуманные тарифы платёжных провайдеров. Каталог сетей — справочный; реальные маршруты и комиссии добавляются оператором через `/admin` как проверенные `provider_rules`.

## Локальный запуск

```bash
npm ci
npm run dev
```

Открой `http://localhost:3000`.

## Обязательная проверка перед deploy

```bash
npm run check:env
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```

Дополнительно на локальном/Preview окружении:

```bash
npm run load:smoke
```

Параметры smoke-нагрузки:

```bash
FLOWPAY_LOAD_BASE_URL=https://your-preview.example.com \
FLOWPAY_LOAD_CONCURRENCY=20 \
FLOWPAY_LOAD_REQUESTS=500 \
npm run load:smoke
```

Не запускай агрессивный load test против production без контроля лимитов Vercel, базы и внешних провайдеров.

## Публичный quote API

```http
POST /api/quote
Content-Type: application/json
```

```json
{
  "fromCountry": "FR",
  "toCountry": "TR",
  "amount": 25000,
  "sourceCurrency": "EUR",
  "recipientCurrency": "TRY"
}
```

FlowPay возвращает только маршруты, для которых в базе есть активные реальные правила. Если подходящих правил нет, маршрут не выдумывается.

## API для клиентов

Создай ключ в разделе **API**, затем:

```bash
curl -X POST https://flowpay-network.vercel.app/api/v1/quote \
  -H "Authorization: Bearer $FLOWPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "fromCountry":"FR",
    "toCountry":"TR",
    "amount":25000,
    "sourceCurrency":"EUR",
    "recipientCurrency":"TRY"
  }'
```

Полный `fp_live_...` показывается только при создании. В БД хранится только его hash.

## Production

1. Добавь environment variables в Vercel.
2. Прогони нужную SQL-миграцию.
3. Настрой `CRON_SECRET` — `vercel.json` содержит ежедневный maintenance cron.
4. Добавь реальные платёжные направления в `/admin`.
5. Сначала задеплой Preview и пройди `LAUNCH_CHECKLIST.md`.
6. После smoke/E2E проверки выкатывай production.

## Дополнительные документы

- `LAUNCH_CHECKLIST.md` — чеклист перед закрытой бетой.
- `SCALING_RU.md` — что уже оптимизировано и когда понадобится следующий инфраструктурный уровень.
- `SECURITY.md` — правила безопасности репозитория и релиза.
- `SECURITY_HARDENING.md` — что enforced кодом/БД и какие production security settings нужно проверить вручную.
- `SECURITY_DEPLOYMENT.md` — инфраструктурный checklist Supabase/Vercel/GitHub.
- `LEGAL_REVIEW_REQUIRED.md` — что должен проверить юрист до коммерческого запуска.

## Важная граница продукта

Текущая версия FlowPay — слой сравнения маршрутов и управления платёжными операциями. Она сама не должна принимать на хранение или самостоятельно перемещать клиентские деньги без соответствующей лицензированной платёжной инфраструктуры и юридической проверки.

## Примечание к архиву

Исходный архив поставляется без `node_modules`, `.next`, `.git` и файлов окружения. Устанавливай зависимости через `npm ci` и перед production выполняй проверки из `LAUNCH_CHECKLIST.md`. Результаты аудита этой сборки находятся в `AUDIT_REPORT.md`.


### v1.9 network & registration hardening

- Network catalog: 13 provider networks, kept separate from pricing/routing rules.
- Platform directory: 249 ISO countries/territories and 153 currencies.
- Route rules accept the complete platform currency directory; actual quotes still require active verified production rules.
- Registration requires `upgrade-v19.sql` and performs schema readiness before account creation.

### v1.8 product polish

- Authenticator apps receive `FlowPay` as the TOTP issuer.
- Counterparty bank details include country-aware bank search with BIC autofill where available.
- Bank directory lookup is server-side, AAL2-protected and rate-limited; no new API key is required.
- Currency selectors use flags and status badges share one visual system.
