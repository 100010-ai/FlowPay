import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const must=[
 'START.bat','scripts/env-check.mjs','app/api/health/route.ts','app/api/profile/route.ts','app/api/account/route.ts','app/reset-password/page.tsx','app/robots.ts','app/sitemap.ts','app/status/page.tsx','app/privacy/page.tsx','app/terms/page.tsx','app/security/page.tsx','app/onboarding/page.tsx','app/(workspace)/admin/page.tsx','supabase/upgrade-v12.sql','supabase/upgrade-v13.sql','SECURITY.md','.github/workflows/ci.yml','vercel.json','SCALING_RU.md'
]
const failures=[]
for(const file of must) if(!fs.existsSync(path.join(root,file))) failures.push(`missing ${file}`)
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
if(!/^\d+\.\d+\.\d+$/.test(String(pkg.version||''))) failures.push(`package version is invalid: ${pkg.version||'<missing>'}`)
const lockPath=path.join(root,'package-lock.json')
if(fs.existsSync(lockPath)){const lock=JSON.parse(fs.readFileSync(lockPath,'utf8'));if(lock.version!==pkg.version||lock.packages?.['']?.version!==pkg.version) failures.push(`package/package-lock version mismatch (${pkg.version} vs ${lock.version}/${lock.packages?.['']?.version})`)}
if(!String(pkg.dependencies?.recharts||'').startsWith('3.')) failures.push('Recharts v3 migration missing')
const reactFamily=['react','react-dom','react-is'].map(name=>String(pkg.dependencies?.[name]||''))
if(new Set(reactFamily).size!==1||reactFamily[0]!=='19.1.9') failures.push(`React security baseline must be exactly 19.1.9 across react/react-dom/react-is (got ${reactFamily.join(', ')})`)
const next=fs.readFileSync(path.join(root,'next.config.ts'),'utf8')
for(const header of ['Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy']) if(!next.includes(header)) failures.push(`security header missing: ${header}`)
const middleware=fs.readFileSync(path.join(root,'middleware.ts'),'utf8')
if(!middleware.includes('Content-Security-Policy')||!middleware.includes("'strict-dynamic'")||!middleware.includes('nonce-${nonce}')) failures.push('request-scoped nonce Content-Security-Policy missing')
const payment=fs.readFileSync(path.join(root,'components/workspace/PaymentForm.tsx'),'utf8')
if(!payment.includes("rpc('flowpay_upsert_payment'")) failures.push('payment writes are not routed through flowpay_upsert_payment')
if(!payment.includes('Authorization:`Bearer ${token}`')) failures.push('signed-in payment quote does not authenticate route history')
const cp=fs.readFileSync(path.join(root,'components/workspace/CounterpartyForm.tsx'),'utf8')
if(!cp.includes("rpc('flowpay_upsert_counterparty'")) failures.push('counterparty writes are not routed through server RPC')
const invoice=fs.readFileSync(path.join(root,'components/workspace/InvoiceForm.tsx'),'utf8')
if(!invoice.includes("rpc('flowpay_upsert_invoice'")) failures.push('invoice writes are not routed through server RPC')
const settings=fs.readFileSync(path.join(root,'app/(workspace)/settings/page.tsx'),'utf8')
if(!settings.includes("fetch('/api/profile'")) failures.push('settings profile writes do not use authenticated backend')
if(!settings.includes("fetch('/api/account'")) failures.push('account deletion is not connected to backend')
const migration=fs.readFileSync(path.join(root,'supabase/upgrade-v13.sql'),'utf8')
for(const token of ['flowpay_rate_limit_counters','flowpay_record_api_usage','flowpay_prune_operational_data','provider_rules_active_currencies_gin_idx','flowpay_import_counterparties','flowpay_import_invoices']) if(!migration.includes(token)) failures.push(`v1.3 migration missing ${token}`)
if(!migration.includes('revoke insert, update, delete on public.payment_drafts from authenticated')) failures.push('financial browser writes are not locked down')
for(const endpoint of ['app/api/quote/route.ts','app/api/audit/route.ts','app/api/v1/quote/route.ts']){const source=fs.readFileSync(path.join(root,endpoint),'utf8');if(!source.includes('checkRateLimit')) failures.push(`${endpoint} has no rate limiting`);if(!source.includes('getEligibleProviderRules')) failures.push(`${endpoint} bypasses route cache`)}

const launcher=fs.readFileSync(path.join(root,'START.bat'))
if([...launcher].some(byte=>byte>0x7f)) failures.push('START.bat must stay ASCII-only for cmd.exe compatibility')
const workspaceProvider=fs.readFileSync(path.join(root,'components/workspace/WorkspaceProvider.tsx'),'utf8')
if(workspaceProvider.includes('useMemo(() => createClient()')) failures.push('workspace Supabase client is initialized during prerender')
if(!workspaceProvider.includes('const getSupabase = useCallback')) failures.push('workspace lazy Supabase initialization missing')
const http=fs.readFileSync(path.join(root,'lib/http.ts'),'utf8')
if(!http.includes('export function noStoreJson')) failures.push('lib/http.ts does not export noStoreJson used by API routes')
const providerRules=fs.readFileSync(path.join(root,'lib/provider-rules.ts'),'utf8')
if(!providerRules.includes('export async function getProviderRuleSummaries')) failures.push('lib/provider-rules.ts does not export getProviderRuleSummaries used by provider API')

if(failures.length){console.error('Launch audit: FAIL\n- '+failures.join('\n- '));process.exit(1)}
console.log('Launch audit: PASS')
