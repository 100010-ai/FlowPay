import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const must=[
 'app/api/health/route.ts','app/api/profile/route.ts','app/api/account/route.ts','app/reset-password/page.tsx','app/robots.ts','app/sitemap.ts','app/status/page.tsx','app/privacy/page.tsx','app/terms/page.tsx','app/security/page.tsx','app/onboarding/page.tsx','app/(workspace)/admin/page.tsx','supabase/upgrade-v12.sql','supabase/upgrade-v13.sql','SECURITY.md','.github/workflows/ci.yml','vercel.json','SCALING_RU.md'
]
const failures=[]
for(const file of must) if(!fs.existsSync(path.join(root,file))) failures.push(`missing ${file}`)
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
if(pkg.version!=='1.3.0') failures.push(`package version is ${pkg.version}, expected 1.3.0`)
if(!String(pkg.dependencies?.recharts||'').startsWith('3.')) failures.push('Recharts v3 migration missing')
const next=fs.readFileSync(path.join(root,'next.config.ts'),'utf8')
for(const header of ['Content-Security-Policy','Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy']) if(!next.includes(header)) failures.push(`security header missing: ${header}`)
const payment=fs.readFileSync(path.join(root,'components/workspace/PaymentDialog.tsx'),'utf8')
if(!payment.includes("rpc('flowpay_upsert_payment'")) failures.push('payment writes are not routed through flowpay_upsert_payment')
if(!payment.includes('Authorization:`Bearer ${token}`')) failures.push('signed-in payment quote does not authenticate route history')
const cp=fs.readFileSync(path.join(root,'components/workspace/CounterpartyDialog.tsx'),'utf8')
if(!cp.includes("rpc('flowpay_upsert_counterparty'")) failures.push('counterparty writes are not routed through server RPC')
const invoice=fs.readFileSync(path.join(root,'components/workspace/InvoiceDialog.tsx'),'utf8')
if(!invoice.includes("rpc('flowpay_upsert_invoice'")) failures.push('invoice writes are not routed through server RPC')
const settings=fs.readFileSync(path.join(root,'app/(workspace)/settings/page.tsx'),'utf8')
if(!settings.includes("fetch('/api/profile'")) failures.push('settings profile writes do not use authenticated backend')
if(!settings.includes("fetch('/api/account'")) failures.push('account deletion is not connected to backend')
const migration=fs.readFileSync(path.join(root,'supabase/upgrade-v13.sql'),'utf8')
for(const token of ['flowpay_rate_limit_counters','flowpay_record_api_usage','flowpay_prune_operational_data','provider_rules_active_currencies_gin_idx','flowpay_import_counterparties','flowpay_import_invoices']) if(!migration.includes(token)) failures.push(`v1.3 migration missing ${token}`)
if(!migration.includes('revoke insert, update, delete on public.payment_drafts from authenticated')) failures.push('financial browser writes are not locked down')
for(const endpoint of ['app/api/quote/route.ts','app/api/audit/route.ts','app/api/v1/quote/route.ts']){const source=fs.readFileSync(path.join(root,endpoint),'utf8');if(!source.includes('checkRateLimit')) failures.push(`${endpoint} has no rate limiting`);if(!source.includes('getEligibleProviderRules')) failures.push(`${endpoint} bypasses route cache`)}
const envExample=fs.readFileSync(path.join(root,'.env.example'),'utf8')
if(!envExample.includes('SUPABASE_SECRET_KEY')||!envExample.includes('CRON_SECRET')) failures.push('production secret/cron env handoff missing')
if(failures.length){console.error('Launch audit: FAIL\n- '+failures.join('\n- '));process.exit(1)}
console.log('Launch audit: PASS')
