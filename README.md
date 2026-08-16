# FlowPay 1.3

FlowPay — B2B-сервис для сравнения маршрутов международных платежей, управления контрагентами, счетами, платежами, отчётами и API-доступом. Версия 1.3 сфокусирована на безопасности, производительности и подготовке к росту нагрузки.

## Что изменилось в 1.3

- Recharts обновлён с устаревшей ветки 2.x до `3.10.1`; React/React DOM/React Is закреплены на одной версии.
- Критические финансовые INSERT/UPDATE/DELETE из браузера отключены. Изменения платежей, контрагентов и счетов выполняются через валидируемые RPC/API с проверкой владельца.
- Жизненный цикл платежей и счетов проверяется транзакционно; повторные/недопустимые переходы блокируются.
- API-ключи генерируются криптографически, хранятся только как SHA-256 hash, а hash-колонка не доступна браузеру.
- Таблица правил маршрутизации больше не раскрывает клиенту комиссии, FX markup, лимиты и route steps; браузеру доступен только минимальный безопасный summary активных партнёров.
- Сервер поддерживает новый `SUPABASE_SECRET_KEY`; старый `SUPABASE_SERVICE_ROLE_KEY` оставлен только как fallback.
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
- React 19.1.1
- Supabase Auth + Postgres + RLS
- Vercel
- Recharts 3.10.1
- Tailwind CSS 4

## Переменные окружения

Скопируй `.env.example` в `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_PUBLIC_KEY

SUPABASE_SECRET_KEY=sb_secret_YOUR_SERVER_KEY
# Только для старого проекта как fallback:
# SUPABASE_SERVICE_ROLE_KEY=YOUR_LEGACY_SERVICE_ROLE_KEY

FLOWPAY_ADMIN_USER_IDS=00000000-0000-0000-0000-000000000000
FLOWPAY_ADMIN_EMAILS=owner@your-domain.com
NEXT_PUBLIC_APP_URL=https://your-domain.com
CRON_SECRET=replace-with-a-long-random-secret
```

Для `/admin` предпочтительно использовать `FLOWPAY_ADMIN_USER_IDS`: UUID не меняется при смене email. Если список ID непустой, fallback по email полностью отключается. `SUPABASE_SECRET_KEY`, legacy service-role key и `CRON_SECRET` — только серверные секреты. Никогда не добавляй им префикс `NEXT_PUBLIC_` и не коммить реальные значения в Git.

## Настройка базы

### Новый проект

Выполни целиком:

```text
supabase/schema.sql
```

### Если база уже на FlowPay 1.2.x

Выполни один раз:

```text
supabase/upgrade-v13.sql
```

### Если база на 1.1.x

```text
supabase/upgrade-v12.sql
supabase/upgrade-v13.sql
```

### Если база на 1.0.x

```text
supabase/upgrade-v11.sql
supabase/upgrade-v12.sql
supabase/upgrade-v13.sql
```

### Если база ещё v0.5.x

```text
supabase/upgrade-v10.sql
supabase/upgrade-v11.sql
supabase/upgrade-v12.sql
supabase/upgrade-v13.sql
```

Миграции не добавляют выдуманные тарифы платёжных провайдеров. Реальные правила добавляются оператором через `/admin`.

## Локальный запуск

### Windows

Запусти `START.bat`. Лаунчер специально сохранён только в ASCII, чтобы `cmd.exe` не пытался выполнять повреждённый кириллический фрагмент как команду.

При первом запуске, если `.env.local` отсутствует, будет создана копия `.env.example`. Заполни реальные Supabase-переменные в `.env.local`, затем снова запусти `START.bat`.

### macOS / Linux / вручную

```bash
npm install
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
curl -X POST https://YOUR_DOMAIN/api/v1/quote \
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
- `LEGAL_REVIEW_REQUIRED.md` — что должен проверить юрист до коммерческого запуска.

## Важная граница продукта

Текущая версия FlowPay — слой сравнения маршрутов и управления платёжными операциями. Она сама не должна принимать на хранение или самостоятельно перемещать клиентские деньги без соответствующей лицензированной платёжной инфраструктуры и юридической проверки.

## Примечание к архиву

В среде сборки ChatGPT npm registry может быть недоступен. Поэтому статические/runtime/security/performance проверки выполняются здесь, а финальные `npm install`, `npm run typecheck` и `npm run build` обязательно нужно прогнать в твоём подключённом окружении или CI перед production.
