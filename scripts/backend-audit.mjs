import fs from 'node:fs'

const required=[
  'app/api/quote/route.ts','app/api/audit/route.ts','app/api/coverage/route.ts','app/api/fx/route.ts','app/api/keys/route.ts','app/api/v1/quote/route.ts','app/api/profile/route.ts','app/api/account/route.ts','app/api/onboarding/route.ts',
  'supabase/schema.sql','supabase/upgrade-v10.sql','supabase/upgrade-v11.sql','supabase/upgrade-v12.sql'
]
let failed=false
for(const f of required){if(!fs.existsSync(f)){console.error(`FAIL missing backend surface: ${f}`);failed=true}}
const schema=fs.readFileSync('supabase/schema.sql','utf8')
for(const table of ['company_profiles','counterparties','payment_drafts','calculations','audit_requests','invoices','api_keys','api_request_logs','workspace_audit_log','provider_rules','flowpay_rate_limit_events','system_event_logs']){
  if(!new RegExp(`create table if not exists public\\.${table}`, 'i').test(schema)){console.error(`FAIL missing table: ${table}`);failed=true}
}
if(!/enable row level security/i.test(schema)){console.error('FAIL RLS is not enabled in schema');failed=true}
if(/insert\s+into\s+public\.provider_rules/i.test(schema)){console.error('FAIL seeded provider pricing found');failed=true}

if(/for select to anon, authenticated using \(active = true\)/i.test(schema)||/create policy "provider rules public read"/i.test(schema)){console.error('FAIL provider pricing is anonymously readable');failed=true}
if(!/provider rules authenticated read/i.test(schema)){console.error('FAIL authenticated provider coverage policy missing');failed=true}
for(const fn of ['flowpay_set_payment_status','flowpay_set_invoice_status','flowpay_link_invoice_payment','flowpay_delete_payment_draft','flowpay_delete_counterparty','flowpay_upsert_payment','flowpay_upsert_counterparty','flowpay_upsert_invoice','flowpay_complete_onboarding','flowpay_check_rate_limit']){if(!schema.includes(`function public.${fn}`)){console.error(`FAIL transactional RPC missing: ${fn}`);failed=true}}
for(const apiFile of ['app/api/quote/route.ts','app/api/audit/route.ts','app/api/coverage/route.ts']){
  const text=fs.readFileSync(apiFile,'utf8')
  if(!text.includes('createAdminClient')){console.error(`FAIL ${apiFile} must keep provider pricing server-side`);failed=true}
}
for(const [file,fn] of [['app/(workspace)/payments/page.tsx','flowpay_set_payment_status'],['app/(workspace)/payments/page.tsx','flowpay_delete_payment_draft'],['app/(workspace)/invoices/page.tsx','flowpay_set_invoice_status'],['components/workspace/PaymentDialog.tsx','flowpay_link_invoice_payment'],['app/(workspace)/counterparties/page.tsx','flowpay_delete_counterparty']]){const text=fs.readFileSync(file,'utf8');if(!text.includes(fn)){console.error(`FAIL ${file} does not use ${fn}`);failed=true}}

for(const col of ['payment_method','charge_type']){if(!schema.includes(`payment_drafts add column if not exists ${col}`)){console.error(`FAIL payment lifecycle column missing: ${col}`);failed=true}}
for(const guard of ['INVOICE_ALREADY_LINKED','PAYMENT_ALREADY_LINKED']){if(!schema.includes(guard)){console.error(`FAIL invoice/payment link guard missing: ${guard}`);failed=true}}
const paymentDialog=fs.readFileSync('components/workspace/PaymentDialog.tsx','utf8')
for(const field of ['p_payment_method:paymentMethod','p_charge_type:chargeType']){if(!paymentDialog.includes(field)){console.error(`FAIL payment dialog does not persist ${field}`);failed=true}}


const settingsPage=fs.readFileSync('app/(workspace)/settings/page.tsx','utf8')
if(!settingsPage.includes("fetch('/api/profile'")){console.error('FAIL profile settings bypass backend validation');failed=true}
if(!settingsPage.includes("fetch('/api/account'")){console.error('FAIL account deletion UI is not connected');failed=true}
const coverageApi=fs.readFileSync('app/api/coverage/route.ts','utf8')
if(coverageApi.includes('providers: 0, corridors: 0, currencies: 0')){console.error('FAIL coverage backend has a fake zero fallback');failed=true}
const quoteApi=fs.readFileSync('app/api/quote/route.ts','utf8')
if(!quoteApi.includes("from('calculations').insert")){console.error('FAIL signed-in route history is not persisted server-side');failed=true}
if(!quoteApi.includes('createServerClient')){console.error('FAIL signed-in quote identity verification missing');failed=true}
const routesPage=fs.readFileSync('app/(workspace)/routes/page.tsx','utf8')
if(routesPage.includes("from('calculations').insert")){console.error('FAIL route history can still be inserted from the browser');failed=true}

for(const endpoint of ['app/api/quote/route.ts','app/api/audit/route.ts','app/api/v1/quote/route.ts']){const source=fs.readFileSync(endpoint,'utf8');if(!source.includes('checkRateLimit')){console.error(`FAIL rate limiting missing: ${endpoint}`);failed=true}}
const quote=fs.readFileSync('app/api/quote/route.ts','utf8')
for(const field of ['fromCountry','toCountry','amount','sourceCurrency','recipientCurrency'])if(!quote.includes(field)){console.error(`FAIL quote contract missing ${field}`);failed=true}
const keyRoute=fs.readFileSync('app/api/keys/route.ts','utf8')
if(!keyRoute.includes("crypto.subtle.digest('SHA-256'")){console.error('FAIL API-key hashing missing');failed=true}
if(failed)process.exit(1)
console.log('Backend audit passed: database, route engine, API-key and RLS contracts verified.')
