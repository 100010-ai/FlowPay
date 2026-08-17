# Безопасность FlowPay

FlowPay работает с финансовыми и банковскими метаданными, поэтому репозиторий, Auth, database и deployment-аккаунты считаются security-sensitive.

## Сообщение об уязвимости

Не публикуй уязвимость, которая может раскрыть пользовательские, банковские, авторизационные или API-данные, в открытом GitHub Issue. Перед публичным запуском настрой Private Vulnerability Reporting и отдельный security contact на собственном домене.

## Основные гарантии FlowPay 1.6

- Парольный AAL1-вход не открывает workspace financial data.
- TOTP/AAL2 проверяется в UI, server API и Postgres RLS/RPC.
- Чувствительные пользовательские таблицы используют ownership RLS + restrictive AAL2 gate + FORCE RLS.
- Прямые browser writes к финансовым сущностям отозваны; mutations идут через валидируемые RPC/API.
- Admin/sensitive mutations требуют AAL2.
- API-key secret показывается один раз; хранится hash, scope минимален, ключи истекают автоматически.
- Регистрация проходит через same-origin rate-limited server endpoint; legal receipts не доверяют caller-controlled `user_metadata`.
- Password reset и MFA removal завершают активные сессии.
- HTML использует request-scoped nonce CSP; production script policy не разрешает `unsafe-inline`.
- HSTS, anti-framing, MIME-sniffing protection, restrictive permissions/referrer/cross-origin policies включены приложением.
- Body limits, request IDs, fail-closed rate limiting и redacted server logging применяются на API.
- CI actions pinned к commit SHA; CodeQL включён; automatic semver-major dependency jumps заблокированы.

## Важные ограничения

- `style-src 'unsafe-inline'` пока нужен UI/Recharts и не считается устранённым.
- Инфраструктурные настройки Supabase/Vercel/GitHub нужно проверить отдельно.
- Security hardening не заменяет независимый pentest и incident-response процесс.

Полный список: `SECURITY_HARDENING.md` и `SECURITY_DEPLOYMENT.md`.

## Проверка релиза

```powershell
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```
