@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [FlowPay] Node.js was not found. Install Node.js 20, 22, or 24 and run this file again.
  pause
  exit /b 1
)

for /f "tokens=1 delims=." %%V in ('node -p "process.versions.node"') do set "NODE_MAJOR=%%V"
if %NODE_MAJOR% LSS 20 (
  echo [FlowPay] Node.js 20 or newer is required.
  pause
  exit /b 1
)
if %NODE_MAJOR% GEQ 25 (
  echo [FlowPay] Node.js 25 or newer is not supported by this project. Use Node.js 20, 22, or 24.
  pause
  exit /b 1
)

if not exist ".env.local" (
  if exist ".env.example" (
    copy /y ".env.example" ".env.local" >nul
    echo [FlowPay] Created .env.local from .env.example.
    echo [FlowPay] Fill in the real environment values, then run START.bat again.
    pause
    exit /b 0
  ) else (
    echo [FlowPay] .env.example is missing.
    pause
    exit /b 1
  )
)

echo [FlowPay] Checking environment...
node scripts\env-check.mjs
if errorlevel 1 (
  echo [FlowPay] Fix .env.local and run START.bat again.
  pause
  exit /b 1
)

if not exist "node_modules\.bin\next.cmd" (
  echo [FlowPay] Installing dependencies...
  call npm install --no-fund --no-audit
  if errorlevel 1 (
    echo [FlowPay] npm install failed.
    pause
    exit /b 1
  )
)

echo [FlowPay] Starting development server...
call npm run dev
set "EXIT_CODE=%ERRORLEVEL%"
if not "%EXIT_CODE%"=="0" (
  echo [FlowPay] Development server exited with code %EXIT_CODE%.
  pause
)
exit /b %EXIT_CODE%
