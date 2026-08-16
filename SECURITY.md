# Безопасность FlowPay

FlowPay работает с платёжными метаданными, поэтому репозиторий и production-окружение нужно считать security-sensitive.

## Сообщение об уязвимости

Не публикуй уязвимость, которая может раскрыть пользовательские, банковские, авторизационные или API-данные, в открытом GitHub Issue. Перед запуском настрой отдельный `security@` на своём домене и GitHub Private Vulnerability Reporting.

## Базовая защита в v1.3

- `SUPABASE_SECRET_KEY` используется только на сервере и не имеет `NEXT_PUBLIC_` префикса.
- Пользовательские таблицы защищены RLS.
- Прямые browser INSERT/UPDATE/DELETE для финансовых сущностей отключены; критичные изменения идут через валидируемые RPC/API.
- API-ключ хранится как SHA-256 hash; полный секрет показывается только при создании, а hash не доступен браузеру.
- Чувствительные API имеют rate limit, ограничение размера body и request ID.
- CSP, HSTS, anti-framing, MIME-sniffing и Permissions-Policy задаются приложением.
- Статусы платежей и счетов меняются транзакционно с проверкой допустимого перехода.
- Серверные логи очищаются от токенов, секретов и банковских реквизитов.
- У operational-логов и rate-limit записей есть retention/prune helper.

## Проверка релиза

```bash
npm run audit
npm run typecheck
npm run build
npm run audit:deps
```
