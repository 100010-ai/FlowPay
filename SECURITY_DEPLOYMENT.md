# FlowPay 1.6 — production security settings

Этот файл содержит инфраструктурные настройки, которые нельзя гарантировать только исходным кодом. Кодовый hardening описан в `SECURITY_HARDENING.md`.

## 1. Перед deploy

Сначала применить DB migration:

```text
supabase/upgrade-v16.sql
```

Если `upgrade-v15.sql` ещё не применялся, выполнить его перед v1.6.

Локальная проверка:

```powershell
npm ci
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```

Не применять `npm audit fix --force` без review breaking changes.

## 2. Supabase Auth

Проверить вручную:

- email confirmation включён;
- Site URL / redirect allowlist содержит только production FlowPay и необходимые trusted previews;
- TOTP MFA доступен;
- production SMTP настроен;
- owner/admin аккаунты Supabase защищены MFA;
- breached-password protection включить, если поддерживается тарифом;
- session/JWT timeout policy настроена под риск-модель продукта;
- CAPTCHA включать только после отдельной интеграции captcha token в FlowPay frontend/Auth flow.

## 3. Supabase Database

- выполнить `upgrade-v16.sql`;
- проверить Database/Auth advisors;
- включить SSL enforcement;
- рассмотреть network restrictions;
- настроить backups/PITR;
- контролировать database roles/service-role access;
- запускать `flowpay_prune_operational_data()` безопасным scheduler/service-role процессом;
- не выдавать service-role клиентскому коду ни при каких обстоятельствах.

## 4. Vercel

- локально и в CI используйте Node 24.19.0; для Vercel `package.json` использует `24.x`, потому что Vercel принимает major line и сам выбирает доступный patch. Проверяйте фактический `process.version` после deploy;
- 2FA/passkey для team owners;
- Preview Deployment Protection, если previews не публичны;
- WAF/managed OWASP protections;
- edge rate limiting на публичные high-abuse endpoints;
- Attack Mode держать как incident-response инструмент;
- alerts по 5xx, latency и необычному трафику.

## 5. GitHub

- ruleset/branch protection для `main`;
- required CI и CodeQL;
- запрет force-push/delete main;
- secret scanning / push protection;
- Private Vulnerability Reporting;
- 2FA/passkeys на owner accounts.

## 6. После deploy

Проверить production вручную:

- `/register` → Privacy → Terms → signup;
- email confirmation;
- onboarding → mandatory 2FA setup;
- AAL1 session не видит workspace data;
- AAL2 session видит только собственные данные;
- второй TOTP factor работает как backup;
- API-key create/revoke требует AAL2;
- expired API key получает 401;
- password reset завершает все сессии;
- browser responses содержат nonce CSP/HSTS/security headers;
- `/.well-known/security.txt` отвечает 200 и указывает production security policy;
- Vercel runtime logs не содержат credential-like secrets, email/IBAN-like PII;
- выполнить `npm run security:prod` после READY deployment.
