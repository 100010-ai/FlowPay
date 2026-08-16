# FlowPay — подготовка к нагрузке

## Что уже сделано в v1.3

- Критичные API ограничены rate limit по сети, пользователю или API-ключу.
- Rate limiter использует атомарный счётчик в Postgres вместо `count → insert` гонки.
- Правила маршрутов кэшируются на сервере и инвалидируются после изменения в `/admin`.
- ECB FX имеет server cache и жёсткий timeout внешнего запроса.
- `/api/health` не выполняет SQL на каждый публичный poll.
- Workspace загружает разные наборы данных в зависимости от вкладки и имеет верхние лимиты выборок.
- Для частых фильтров/сортировок добавлены индексы.
- Детальные API-логи семплируются, а точная статистика хранится агрегатами по дням.
- Старые operational-логи можно чистить через `flowpay_prune_operational_data()`.

## Локальный/Preview smoke test

Сначала запусти приложение, затем в другом терминале:

```bash
npm run load:smoke
```

Настройка нагрузки:

```bash
FLOWPAY_LOAD_BASE_URL=https://preview.example.com FLOWPAY_LOAD_CONCURRENCY=20 FLOWPAY_LOAD_REQUESTS=500 npm run load:smoke
```

Не запускай агрессивные тесты против production без отдельного окна и контроля базы/провайдеров.
Для безопасной проверки самого route engine можно опционально добавить тестовый quote payload (только на Preview и только на настроенном тестовом коридоре):

```bash
FLOWPAY_LOAD_QUOTE_PAYLOAD='{"fromCountry":"FR","toCountry":"TR","amount":1000,"sourceCurrency":"EUR","recipientCurrency":"TRY"}' FLOWPAY_LOAD_CONCURRENCY=10 FLOWPAY_LOAD_REQUESTS=150 npm run load:smoke
```

Ответы `429`/`503` во время smoke-теста считаются штатной защитой от перегрузки, а не необработанной ошибкой.


## Когда понадобится следующий инфраструктурный уровень

При устойчивой большой нагрузке перенеси глобальный rate limiting из основной БД во внешний low-latency store/edge firewall, включи полноценный APM/alerting, проверь connection pooling и планы SQL на production-данных, а тяжёлые экспорты/отчёты вынеси в фоновые jobs. Эти шаги зависят уже от реального трафика, тарифа Vercel/Supabase и подключённых PSP.
