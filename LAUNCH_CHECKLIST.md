# FlowPay 1.6 — чеклист перед запуском

Кодовая часть, которую можно закрыть без твоего юрлица, домена и договоров с платёжными партнёрами, подготовлена. Перед закрытой бетой пройди пункты ниже.

## Обязательно перед private beta

- [ ] На существующей базе после `upgrade-v13.sql` обязательно выполнить `supabase/upgrade-v15.sql` для защищённого журнала принятия Privacy/Terms.
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
7. Провести платёж `draft → ready → paid → received` и проверить синхронизацию связанного счёта.
8. Создать API-ключ, вызвать `POST /api/v1/quote`, затем отозвать ключ.
9. Проверить CSV-импорт контрагентов/счетов и экспорт Payments/Reports.
10. Открыть `/status` и проверить основные системы.
11. Открыть `/admin` операторским аккаунтом и проверить CRUD платёжных правил.
12. Проверить desktop/mobile, logout/login, пустые состояния и rate-limit ошибки.
13. На Preview выполнить `npm run load:smoke` с безопасной тестовой нагрузкой и проверить p95/error rate.

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
