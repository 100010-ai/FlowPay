@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [FlowPay] Node.js was not found. Install Node.js 24.18.1 or newer within the 24.x LTS line and run this file again.
  pause
  exit /b 1
)

node -e "const [a,b,c]=process.versions.node.split('.').map(Number);process.exit(a===24 && (b>18 || (b===18 && c>=1)) ? 0 : 1)" >nul 2>nul
if errorlevel 1 (
  echo [FlowPay] Node.js 24.18.1 or newer within the 24.x LTS line is required.
  pause
  exit /b 1
)

if not exist ".env.local" (
  echo [FlowPay] .env.local is not present.
  echo [FlowPay] Configure environment values privately, then run START.bat again.
  pause
  exit /b 1
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
  call npm ci --no-fund --no-audit
  if errorlevel 1 (
    echo [FlowPay] npm ci failed.
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
