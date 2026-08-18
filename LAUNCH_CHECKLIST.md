# FlowPay 2.0 — чеклист перед запуском

Кодовая часть, которую можно закрыть без твоего юрлица, домена и договоров с платёжными партнёрами, подготовлена. Перед закрытой бетой пройди пункты ниже.

## Обязательно перед private beta

- [ ] На существующей базе после `upgrade-v13.sql` обязательно выполнить `supabase/upgrade-v15.sql` для защищённого журнала принятия Privacy/Terms.
- [ ] На существующей базе применить миграции до v1.9, затем **последней** выполнить `supabase/upgrade-v20.sql` до деплоя FlowPay 2.0. `upgrade-v19.sql` всё ещё обязателен до открытия регистрации.
- [ ] В Vercel задать `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`.
- [ ] Задать `FLOWPAY_ADMIN_USER_IDS` для всех операторов `/admin`; email-based доступ не используется.
- [ ] Задать `NEXT_PUBLIC_APP_URL` на production HTTPS-домен.
- [ ] Сгенерировать длинный случайный `CRON_SECRET` и добавить его в Vercel для защищённого maintenance cron.
- [ ] В `/admin` добавить хотя бы одно реальное проверенное платёжное направление с источником и датой обновления.
- [ ] Настроить production SMTP, подтверждение email и корректные redirect URL для регистрации/сброса пароля.
- [ ] Включить подходящую защиту Auth от ботов/злоупотреблений.
- [ ] Проверить `/privacy`, `/terms`, `/security` под реальное юрлицо, страны работы и договоры. См. `LEGAL_REVIEW_REQUIRED.md`.
- [ ] Добавить реальные `support@`, `privacy@`, `security@` на своём домене.
- [ ] Выполнить `npm run check:env`, `npm run audit`, `npm run typecheck`, `npm run build`, `npm run audit:deps`.
- [ ] Сначала задеплоить Preview и пройти smoke flow ниже.

## Smoke flow

1. Зарегистрировать нового пользователя и подтвердить email, если подтверждение включено.
2. Пройти `/onboarding` и проверить базовую валюту Dashboard.
3. Создать контрагента с валидными банковскими реквизитами.
4. Создать счёт.
5. Создать платёж из счёта.
6. Запросить маршрут и убедиться, что возвращаются только реально настроенные правила.
   Проверить также отсутствие подходящего правила: ответ не должен подставлять каталог провайдеров или синтетический маршрут.
7. Включить Payment Controls, создать платёж выше threshold, запросить approval и убедиться, что `ready/paid` блокируются до решения. После `approved` провести `draft/ready → paid → received` и проверить связанный счёт.
8. Создать API-ключ, вызвать `POST /api/v1/quote`, затем отозвать ключ.
9. Проверить CSV-импорт контрагентов/счетов и экспорт Payments/Reports.
10. Открыть `/status` и проверить основные системы.
11. Открыть `/admin` операторским аккаунтом и проверить CRUD платёжных правил.
12. Проверить desktop/mobile, logout/login, пустые состояния и rate-limit ошибки.
13. Проверить `/operations`, `/treasury`, `/activity` и global search (`Ctrl/Cmd + K`) на desktop/mobile.
14. На Preview выполнить `npm run load:smoke` с безопасной тестовой нагрузкой и проверить p95/error rate.

## Что остаётся внешней работой

- Договор с лицензированным PSP/платёжным партнёром, если FlowPay будет реально исполнять или хранить деньги.
- Юридическая проверка Terms/Privacy/compliance под конкретные юрисдикции.
- Домен, DNS, корпоративная почта и процесс поддержки.
- Реальные тарифы/API провайдеров и коммерческое разрешение использовать их данные.
- Внешняя система оповещений об инцидентах, если нужны уведомления вне встроенного журнала/Vercel.
## FlowPay 1.4 product checks

- [ ] Открыть любой Dialog/API-key modal: фон должен оставаться читаемым, без сильного blur/серой «плёнки».
- [ ] На новом аккаунте onboarding должен получить country/timezone от Vercel и предложить соответствующую reporting currency; все поля должны оставаться редактируемыми.
- [ ] В `/developer` API health должен показывать application/database/routing, а API Playground — реальный HTTP status, latency и JSON response.
- [ ] Убедиться, что введённый в API Playground `fp_live_...` не сохраняется после reload вкладки.
- [ ] На Dashboard проверить 30-day forecast на аккаунте с платежами в одной и нескольких валютах.
- [ ] В Settings проверить MFA/session/access activity без раскрытия секретов.



## FlowPay 1.5 auth/workspace checks

- [ ] На `/login` проверить desktop/mobile, recovery link, переход на `/register` и отсутствие старой склейки `На главнуюFLOWPAY`.
- [ ] На `/register` прокрутить Privacy до конца: checkbox до этого момента должен быть disabled. Повторить для Terms.
- [ ] После тестовой регистрации убедиться, что `public.legal_acceptances` содержит две server-created записи: Privacy `acknowledged` и Terms `accepted` с текущими версиями документов.
- [ ] Проверить `/privacy` и `/terms`, печать/PDF и ссылки между документами.
- [ ] До платного публичного запуска заполнить реальное юридическое имя оператора, адрес, privacy contact и governing law; затем отдать документы на профильную юрпроверку.
- [ ] `+ Новый платёж`, `+ Контрагент`, `+ Счёт`, `+ API-ключ` должны открывать отдельную workspace-страницу, а не form-modal.
- [ ] Edit платежа/контрагента/счёта должен открывать `/:id/edit` при сохранённой левой панели.
- [ ] Подтверждения удаления/отзыва остаются confirmation flows.


## FlowPay 1.6 security checks

- [ ] `supabase/upgrade-v16.sql` применён после v1.5.
- [ ] Новый signup идёт через `/api/register`; прямой Auth signup не может завершить onboarding без trusted legal receipt.
- [ ] Новый пользователь после onboarding обязан настроить TOTP.
- [ ] AAL1 session не читает payments/counterparties/invoices/API-key metadata.
- [ ] AAL2 session читает только собственные workspace rows.
- [ ] Настроен резервный TOTP factor и проверен выбор factor на `/mfa`.
- [ ] API key создаётся только с AAL2, имеет `quote:read` и expiry.
- [ ] Expired/revoked key получает 401.
- [ ] Password reset завершает старые sessions.
- [ ] Production HTML CSP содержит request nonce и не содержит `unsafe-inline` в `script-src`.
- [ ] Vercel/Supabase/GitHub manual hardening из `SECURITY_HARDENING.md` пройден.
- [ ] CI + CodeQL required перед merge в `main`.


## FlowPay 1.7 admin / launch checks

- [ ] Операторский аккаунт с AAL2 видит ссылку `Админ-панель` в левой навигации; обычный пользователь её не получает.
- [ ] `/admin` показывает реальные Users / Payments / Invoices / API / Security / Routes без demo-данных.
- [ ] Launch Center показывает зелёные Application & database / Routing / Runtime gates.
- [ ] SMTP signup confirmation и reset password вручную проверены перед внешним трафиком.
- [ ] Юридические реквизиты оператора вручную проверены в Privacy/Terms перед коммерческим запуском.
- [ ] CSV-экспорт Users и Operations скачивает только данные, уже загруженные в admin console.
- [ ] Route editor сохраняет и удаляет правила только после AAL2 admin gate; удаление требует подтверждения.


## FlowPay 1.9 network / registration checks

- [ ] `supabase/upgrade-v19.sql` применён до деплоя приложения v1.9.
- [ ] Новая регистрация создаёт две записи `registration_server`, а `REGISTRATION_SCHEMA_NOT_READY` не создаёт Auth user.
- [ ] При искусственном отказе `system_event_logs` основная успешная операция не превращается в 500 только из-за telemetry.
- [ ] `/admin` отдельно показывает provider catalog и фактический production routing.
- [ ] Provider preset не создаёт pricing rule автоматически: комиссия, лимиты, валюты и направление сохраняются только после явного admin save.
- [ ] Route rule принимает более 12 валют и позволяет использовать весь платформенный справочник, если это подтверждено источником.
- [ ] При отсутствии active `provider_rules` quote возвращает отсутствие маршрута; никакого fallback нет.

## FlowPay 2.0 control-plane checks

- [ ] `supabase/upgrade-v20.sql` применён после v1.9 migration и до первого запуска UI 2.0.
- [ ] `/operations` не показывает demo-задачи: очередь формируется только из фактических платежей, счетов, контрагентов и production route metadata.
- [ ] Approval policy в Settings корректно помечает новые и активные платежи; cross-currency payment требует approval без синтетической конвертации threshold.
- [ ] `required`, `pending` и `rejected` не могут перейти в `ready`/`paid` через server RPC.
- [ ] Approval request/decision появляются в `/activity` и в истории `/approvals`.
- [ ] Duplicate Guard предупреждает о вероятном дубле, но не удаляет и не изменяет существующие платежи.
- [ ] `/treasury` не суммирует валюту в reporting currency, если референсный курс отсутствует; такая экспозиция остаётся отдельной.
- [ ] `/routes` при отсутствии production rule показывает no-route state; provider catalog никогда не становится fallback.
- [ ] `Ctrl/Cmd + K` находит реальные платежи, контрагентов и счета без раскрытия чужих workspace rows.
- [ ] Admin Operations показывает approval queue и статусы без cross-currency фиктивных агрегатов.

