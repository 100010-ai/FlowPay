import fs from 'node:fs'
import path from 'node:path'

const roots = ['app/api', 'lib']
const files = []
for (const root of roots) walk(root)
files.push('.env.example')

function walk(dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full)
    else if (/\.(?:ts|tsx|js|mjs|cjs)$/.test(entry.name)) files.push(full)
  }
}

const failures = []
const forbidden = [
  ['legacy Supabase key', /SUPABASE_SERVICE_ROLE_KEY/],
  ['email admin authorization', /FLOWPAY_ADMIN_EMAILS/],
  ['swallowed FX error', /getReferenceFx\([^\n]+\)\.catch\(\(\) => null\)/],
  ['provider-name substitution', /display_name\?\.trim\(\)\s*\|\|\s*row\.provider_code/],
  ['provider-source substitution', /row\.source\s*\|\|\s*['"]manual['"]/],
  ['default reliability score', /reliability\s*==\s*null\s*\?\s*75/],
  ['best-effort swallow', /best[- ]effort|must not fail|must never break/i],
  ['legacy noStoreJson overload', /statusOrInit|Backwards-compatible no-cache JSON helper/],
  ['optional mutation origin', /if \(!candidate\) return true/],
  ['alternate app URL source', /process\.env\.(?:APP_URL|SITE_URL)/],
  ['stale cache serving', /stale-while-revalidate|stale-if-error/],
  ['FX query default', /searchParams\.get\(['"](?:source|target)['"]\)\s*\|\|/],
  ['synthetic fee score', /avgFeePct\s*==\s*null\s*\?\s*0\.75/],
  ['synthetic rate-limit retry delay', /\b[A-Za-z_$][A-Za-z0-9_$]*\.retryAfter\b/],
  ['legacy provider-rule positional call', /getEligibleProviderRules\([^\n{}]+,[^\n]+,[^\n]+,[^\n]+,[^\n]+\)/],
  ['nullable route FX rate', /buildRoutes\([^\n]+(?:\?\.|\?\?|\bnull\b)/],
]
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8')
  for (const [name, pattern] of forbidden) if (pattern.test(text)) failures.push(`${name}: ${file}`)
  if (/app[\\/]api[\\/]/.test(file) && /checkRateLimit\(([^,\r\n]+),([^,\r\n]+),([^,\r\n]+),([^,\r\n]+),\s*([A-Za-z_$][A-Za-z0-9_$]*(?:\.[A-Za-z_$][A-Za-z0-9_$]*)+)\s*\)/.test(text)) failures.push(`legacy rate-limit subject signature: ${file}`)
}
if (failures.length) {
  console.error(`Strict-mode audit failed with ${failures.length} issue(s):`)
  for (const failure of failures) console.error(`  - ${failure}`)
  process.exit(1)
}
console.log(`Strict-mode audit passed: ${files.length} files checked.`)
