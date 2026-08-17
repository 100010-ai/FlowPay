# FlowPay — ручные security-настройки production

Эти пункты требуют доступа к твоим Vercel/Supabase/DNS аккаунтам и поэтому не могут быть безопасно включены только исходным кодом.

## Vercel

- Использовать Node.js 22+.
- Добавить production env из `.env.example`.
- Никогда не создавать `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY`.
- Включить Firewall/WAF правила для аномального трафика.
- Поставить отдельные ограничения на Auth/quote/API endpoints, если они доступны на твоём тарифе.
- Настроить alerting по росту 5xx и latency.
- После изменения env обязательно сделать Redeploy.

## Supabase Auth

- Production SMTP.
- Email confirmation для публичной регистрации.
- Redirect URL только на реальные FlowPay origins.
- CAPTCHA/bot protection для signup/reset, если используется публичная регистрация.
- Проверить session/JWT lifetime под реальную модель продукта.

## Supabase Database

- Выполнить последнюю миграцию.
- Проверить Database Advisors после миграции.
- Настроить backup/PITR согласно требованиям бизнеса.
- Наблюдать медленные запросы и добавлять индексы по фактическим query plans, а не наугад.
- Раз в сутки вызывать `flowpay_prune_operational_data()` через безопасный scheduler/service-role процесс. Он удаляет истёкшие rate-limit buckets, API request logs старше 90 дней и server event logs старше 30 дней. Финансовый audit log эта функция не трогает.

## Перед каждым релизом

```bash
npm ci
npm run check:env
npm run audit
npm run audit:deps
npm run typecheck
npm run build
```

Не использовать `npm audit fix --force` без просмотра конкретных breaking changes.
