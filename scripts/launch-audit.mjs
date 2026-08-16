import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const must=[
 'app/api/health/route.ts','app/api/profile/route.ts','app/api/account/route.ts','app/reset-password/page.tsx','app/robots.ts','app/sitemap.ts','app/status/page.tsx','app/privacy/page.tsx','app/terms/page.tsx','app/security/page.tsx','app/onboarding/page.tsx','app/(workspace)/admin/page.tsx','supabase/upgrade-v12.sql'
]
const failures=[]
for(const file of must) if(!fs.existsSync(path.join(root,file))) failures.push(`missing ${file}`)
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
if(pkg.version!=='1.2.1') failures.push(`package version is ${pkg.version}, expected 1.2.1`)
const next=fs.readFileSync(path.join(root,'next.config.ts'),'utf8')
for(const header of ['X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy']) if(!next.includes(header)) failures.push(`security header missing: ${header}`)
const payment=fs.readFileSync(path.join(root,'components/workspace/PaymentDialog.tsx'),'utf8')
if(!payment.includes("rpc('flowpay_upsert_payment'")) failures.push('payment writes are not routed through flowpay_upsert_payment')
const cp=fs.readFileSync(path.join(root,'components/workspace/CounterpartyDialog.tsx'),'utf8')
if(!cp.includes("rpc('flowpay_upsert_counterparty'")) failures.push('counterparty writes are not routed through server RPC')
const invoice=fs.readFileSync(path.join(root,'components/workspace/InvoiceDialog.tsx'),'utf8')
if(!invoice.includes("rpc('flowpay_upsert_invoice'")) failures.push('invoice writes are not routed through server RPC')
const settings=fs.readFileSync(path.join(root,'app/(workspace)/settings/page.tsx'),'utf8')
if(!settings.includes("fetch('/api/profile'")) failures.push('settings profile writes do not use authenticated backend')
if(!settings.includes("fetch('/api/account'")) failures.push('account deletion is not connected to backend')
const coverage=fs.readFileSync(path.join(root,'app/api/coverage/route.ts'),'utf8')
if(coverage.includes('providers: 0, corridors: 0, currencies: 0')) failures.push('coverage API still returns zero-data fallback on backend failure')
const migration=fs.readFileSync(path.join(root,'supabase/upgrade-v12.sql'),'utf8')
for(const token of ['flowpay_check_rate_limit','system_event_logs','flowpay_complete_onboarding','flowpay_upsert_payment','flowpay_upsert_counterparty','flowpay_upsert_invoice']) if(!migration.includes(token)) failures.push(`migration missing ${token}`)
const quote=fs.readFileSync(path.join(root,'app/api/quote/route.ts'),'utf8')
if(!quote.includes('checkRateLimit')) failures.push('public quote has no rate limiting')
const audit=fs.readFileSync(path.join(root,'app/api/audit/route.ts'),'utf8')
if(!audit.includes('checkRateLimit')) failures.push('public audit has no rate limiting')
if(failures.length){console.error('Launch audit: FAIL\n- '+failures.join('\n- '));process.exit(1)}
console.log('Launch audit: PASS')
