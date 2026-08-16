@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

echo =============================================
echo FlowPay 1.3 - обновление зависимостей и проверка
echo =============================================
echo.

where node >nul 2>nul || (echo [ОШИБКА] Node.js не найден. Нужен Node.js 22.x.& pause & exit /b 1)
where npm >nul 2>nul || (echo [ОШИБКА] npm не найден.& pause & exit /b 1)

for /f "delims=" %%V in ('node -p "process.versions.node"') do set NODE_VERSION=%%V
echo Node.js: %NODE_VERSION%

echo [1/7] Удаляю старые build/dependency артефакты...
if exist ".next" rmdir /s /q ".next"
if exist "node_modules" rmdir /s /q "node_modules"
if exist "package-lock.json" del /f /q "package-lock.json"
if exist "tsconfig.tsbuildinfo" del /f /q "tsconfig.tsbuildinfo"

echo [2/7] Устанавливаю зависимости и создаю новый package-lock.json...
call npm install --no-fund
if errorlevel 1 goto :fail

echo [3/7] Проверяю env...
call npm run check:env
if errorlevel 1 goto :fail

echo [4/7] Проверяю production-зависимости через npm audit...
call npm run audit:deps
if errorlevel 1 goto :fail

echo [5/7] Запускаю security/performance/project audits...
call npm run audit
if errorlevel 1 goto :fail

echo [6/7] Проверяю TypeScript...
call npm run typecheck
if errorlevel 1 goto :fail

echo [7/7] Production build...
call npm run build
if errorlevel 1 goto :fail

echo.
echo =============================================
echo ГОТОВО. package-lock.json обновлён под FlowPay 1.3.
echo Теперь можно git add -A, commit и push.
echo =============================================
pause
exit /b 0

:fail
echo.
echo =============================================
echo ПРОВЕРКА ОСТАНОВЛЕНА ИЗ-ЗА ОШИБКИ.
echo Скопируй последние строки консоли и пришли их в чат.
echo =============================================
pause
exit /b 1
