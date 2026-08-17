# FlowPay 1.6 — Security Hardening

FlowPay 1.6 исходит из модели **zero trust внутри приложения**: успешный парольный вход сам по себе не даёт доступ к финансовым данным. Защита строится слоями — браузер, API, Auth, Postgres/RLS, API credentials, CI/CD и инфраструктура.

Ни одна интернет-система не может быть «невзламываемой». Цель этой версии — существенно уменьшить поверхность атаки, не допустить тихого обхода UI, ограничить ущерб при краже одной учётной сущности и сделать критичные действия короткоживущими и проверяемыми.

## Уже enforced исходным кодом

### Сессии и MFA

- Workspace требует Supabase AAL2 до загрузки платежей, контрагентов, счетов, аналитики, API-key metadata и audit data.
- `/mfa` выполняет TOTP step-up через challenge/verify.
- Security Center поддерживает до трёх проверенных TOTP-факторов, включая резервное устройство.
- Удаление MFA-фактора требует AAL2, затем refresh сессии и глобальный sign-out.
- Смена пароля завершает все активные сессии.
- Admin routes, удаление аккаунта, API-key lifecycle и финансовые mutations требуют AAL2 на сервере.

### Postgres / RLS

`supabase/upgrade-v16.sql` добавляет второй независимый барьер: даже валидный AAL1 JWT не должен читать/изменять чувствительные workspace-таблицы напрямую через Supabase REST/RPC.

Для чувствительных таблиц включены:

- RLS;
- `FORCE ROW LEVEL SECURITY`;
- restrictive AAL2 policy;
- существующие ownership policies;
- запрет прямых browser writes;
- AAL2 внутри SECURITY DEFINER mutation RPC.

То есть UI не является security boundary.

### Регистрация

- Browser больше не вызывает Supabase `signUp()` напрямую.
- `/api/register` принимает только same-origin JSON, имеет bounded body и network rate limit.
- Privacy/Terms версии валидируются сервером.
- Legal receipts записываются service-role только после свежего Auth signup; если запись receipts не проходит, свежесозданный Auth-пользователь откатывается, чтобы не оставлять полусозданный аккаунт.
- Старый trigger, доверявший `raw_user_meta_data`, отключается миграцией v1.6.
- v1.5 metadata-backed receipts маркируются `legacy_registration` и не считаются server-trusted доказательством для нового onboarding.
- Direct signup через публичный Auth endpoint может создать Auth-пользователя, но не получает server-trusted legal receipts и не может завершить onboarding.
- Onboarding RPC сделан одноразовым: повторный AAL1-вызов после завершённого onboarding не может менять core company fields.

### API keys

- создание/отзыв — только AAL2;
- scope только `quote:read`;
- lifetime только 30/60/90 дней;
- максимум 10 одновременно активных ключей;
- полный secret показывается один раз;
- в БД хранится SHA-256 high-entropy secret, браузер видит только metadata/prefix;
- expired/revoked/wrong-scope key возвращает одинаковый invalid-key ответ;
- request rate limit применяется отдельно к network и конкретному key ID.

### Browser hardening

- request-scoped CSP nonce для HTML;
- production `script-src` без `unsafe-inline`;
- `strict-dynamic`, `script-src-attr 'none'`;
- anti-framing, object/frame deny;
- HSTS, MIME-sniffing protection, Referrer Policy;
- COOP/CORP, restrictive Permissions Policy;
- production browser source maps отключены;
- HTML responses `private, no-store`.
- browser Auth session хранится в `sessionStorage`, а не в persistent `localStorage`; закрытие вкладки удаляет браузерную копию access/refresh token.
- `/.well-known/security.txt` публикует канонический канал disclosure и ссылку на security policy.

`style-src 'unsafe-inline'` пока остаётся намеренно из-за React/Recharts inline styles. Его нельзя просто удалить без отдельного UI refactor и browser regression tests.

### Request / API hardening

- bounded JSON reader;
- request IDs;
- same-origin guard на защищённых browser mutations;
- fail-closed database-backed rate limiter;
- Vercel `x-forwarded-for` используется как production network identity;
- server logs проходят redaction helper для credential-like значений, email и IBAN-подобных строк;
- service-role не используется для обычных пользовательских import/profile/payment reads.

### Supply chain

- Node runtime pinned на 24.18.1;
- exact npm dependency versions;
- `engine-strict=true`;
- CI GitHub Actions pinned к конкретным commit SHA;
- checkout не сохраняет Git credentials;
- setup-node package-manager cache отключён в security-sensitive CI;
- CodeQL workflow включён;
- Dependabot не создаёт автоматические semver-major dependency jumps.

## Обязательная миграция

Для существующей базы сначала должна быть применена v1.5, затем v1.6:

```text
supabase/upgrade-v15.sql
supabase/upgrade-v16.sql
```

На новой пустой базе используется текущий `supabase/schema.sql`.

**Не выкатывай код v1.6 для новых регистраций раньше `upgrade-v16.sql`:** `/api/register` пишет `legal_acceptances.source='registration_server'`, который добавляется миграцией.

## Platform hardening — проверить вручную

Эти настройки не могут быть честно подтверждены исходным кодом и не считаются включёнными автоматически.

### Supabase

- Email confirmation для публичной регистрации.
- TOTP MFA разрешён в Auth settings.
- Redirect/Site URL allowlist содержит только реальные FlowPay origins.
- Production SMTP, без тестового mail transport.
- Если тариф поддерживает: breached/leaked password protection.
- Если тариф поддерживает: разумный JWT lifetime, inactivity timeout, time-boxed sessions и single-session policy по бизнес-требованиям.
- SSL enforcement для database connections.
- Database network restrictions, если доступно и совместимо с Vercel/server connections.
- Backups/PITR согласно допустимой потере данных.
- MFA для владельцев Supabase organization/project.
- Database/Auth advisors проверить после `upgrade-v16.sql`.

CAPTCHA/Turnstile не включай только переключателем: текущий FlowPay 1.6 не отправляет CAPTCHA token в Auth. Для этого нужен отдельный интеграционный проход с site key, CSP allowlist и UI/error handling.

### Vercel

- Включить 2FA/passkey для владельцев команды.
- Защитить Preview deployments через Vercel Authentication, если Preview не должен быть публичным.
- Включить WAF/managed OWASP rules на доступном тарифе.
- Добавить edge rate limits для публичных `/api/register`, `/api/quote`, `/api/audit`, `/api/v1/quote` как второй слой поверх application limiter.
- Attack Mode использовать как временную incident-response меру, а не постоянно.
- Alerts на 5xx, auth anomalies и резкий рост трафика.

### GitHub

- Branch protection/ruleset для `main`.
- Запрет force-push/delete `main`.
- Required checks: CI + CodeQL.
- Secret scanning и push protection, если доступны.
- Private Vulnerability Reporting.
- 2FA/passkey для владельца репозитория.
- Для команды — review requirement перед production changes.

## Остаточные риски

Даже после v1.6 остаются классы рисков, которые нельзя устранить одним исходным архивом:

- компрометация Vercel/Supabase/GitHub owner account;
- supply-chain zero-day в Next/React/Supabase или runtime;
- malicious browser extension / compromised endpoint пользователя;
- XSS/скомпрометированный browser context всё ещё может читать токены текущей SPA-сессии; strict nonce CSP и tab-scoped storage уменьшают риск, но полностью его устраняет только отдельная BFF/HTTP-only-cookie архитектура;
- социальная инженерия и потеря обоих TOTP-устройств;
- неправильные production Auth/WAF/DNS settings;
- business-logic bugs в будущих изменениях;
- provider/data integrity и юридические/compliance риски.

Поэтому security — это процесс: patch cadence, logs/alerts, backups, incident response, dependency review и периодический независимый pentest.
