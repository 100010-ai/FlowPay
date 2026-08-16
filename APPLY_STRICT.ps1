$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

$changed = 0
Get-ChildItem -Path "app/api" -Recurse -File -Include *.ts,*.tsx | ForEach-Object {
    $path = $_.FullName
    $text = [System.IO.File]::ReadAllText($path)
    $original = $text


    # Strict cache policy: never serve stale responses.
    $text = [regex]::Replace($text, '(?i),\s*stale-while-revalidate(?:=\d+)?', '')
    $text = [regex]::Replace($text, '(?i)stale-while-revalidate(?:=\d+)?\s*,\s*', '')
    $text = [regex]::Replace($text, '(?i),\s*stale-if-error(?:=\d+)?', '')
    $text = [regex]::Replace($text, '(?i)stale-if-error(?:=\d+)?\s*,\s*', '')

    # Strict checkRateLimit contract: fifth argument must be RateLimitOptions.
    $text = [regex]::Replace(
        $text,
        'checkRateLimit\(([^,\r\n]+),([^,\r\n]+),([^,\r\n]+),([^,\r\n]+),\s*([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+)\s*\)',
        'checkRateLimit($1,$2,$3,$4,{ subject: $5 })'
    )

    # RateLimitResult has no server-confirmed retryAfter value. In strict mode we
    # do not synthesize one; remove legacy Retry-After headers that referenced it.
    $text = [regex]::Replace(
        $text,
        '\{\s*status\s*:\s*429\s*,\s*headers\s*:\s*\{\s*["'']Retry-After["'']\s*:\s*String\(\s*[A-Za-z_$][A-Za-z0-9_$]*\.retryAfter\s*\)\s*\}\s*\}',
        '{status:429}'
    )

    if ($text -ne $original) {
        [System.IO.File]::WriteAllText($path, $text, (New-Object System.Text.UTF8Encoding($false)))
        Write-Host "[strict] patched $($_.FullName.Substring($root.Length + 1))"
        $changed++
    }
}

Write-Host "[strict] route patches: $changed"
node scripts/strict-mode-audit.mjs
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "[strict] source audit passed"
