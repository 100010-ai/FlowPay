$ErrorActionPreference = "Continue"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$failures = New-Object System.Collections.Generic.List[string]

function Run-Check {
  param([string]$Label,[scriptblock]$Command)
  & $Command
  $code = $LASTEXITCODE
  if ($null -eq $code) { $code = 0 }
  if ($code -ne 0) {
    $script:failures.Add("$Label (exit $code)")
    Write-Host "[full-audit] FAILED: $Label" -ForegroundColor Red
  } else {
    Write-Host "[full-audit] PASS: $Label" -ForegroundColor Green
  }
}

Write-Host "[full-audit] 1/11 applying source/API/Zod migrations..."
node scripts/full-source-fix.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[full-audit] 2/11 hardening vulnerable dependency versions..."
node scripts/harden-dependencies.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[full-audit] 3/11 validating Node.js runtime..."
node -e "const [M,m]=process.versions.node.split('.').map(Number); if(M<20 || (M===20&&m<9) || M>=25){console.error('[deps] Node.js 20.9+ and <25 required; current '+process.version);process.exit(1)} console.log('[deps] Node runtime PASS: '+process.version)"
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[full-audit] 4/11 reinstalling the exact hardened dependency graph..."
Run-Check "dependency installation" { npm install --no-fund --no-audit }

Write-Host "[full-audit] 5/11 synchronizing package-lock metadata..."
Run-Check "package-lock metadata sync" { node scripts/sync-lock-metadata.mjs }

Write-Host "[full-audit] 6/11 checking imports, exports, Zod runtime contracts, call signatures, and dependency policy..."
Run-Check "contract audit" { node scripts/full-contract-audit.mjs }

Write-Host "[full-audit] 7/11 checking forbidden fallback paths..."
Run-Check "strict no-fallback audit" { node scripts/strict-mode-audit.mjs }

Write-Host "[full-audit] 8/11 validating environment and built-in FlowPay audits..."
Run-Check "environment check" { npm run check:env }
Run-Check "built-in FlowPay audits" { npm run audit }

Write-Host "[full-audit] 9/11 running full TypeScript typecheck..."
Run-Check "TypeScript typecheck" { npm run typecheck }

Write-Host "[full-audit] 10/11 running production Next.js build including page-data collection..."
Run-Check "production Next.js build" { npm run build }

Write-Host "[full-audit] 11/11 scanning production dependencies for high-severity vulnerabilities..."
Run-Check "production dependency audit" { npm run audit:deps }

Write-Host ""
if ($failures.Count -gt 0) {
  Write-Host "[full-audit] COMPLETED WITH $($failures.Count) FAILED CHECK(S):" -ForegroundColor Red
  foreach ($failure in $failures) { Write-Host "  - $failure" -ForegroundColor Red }
  exit 1
}
Write-Host "[full-audit] ALL CHECKS PASSED" -ForegroundColor Green
exit 0
