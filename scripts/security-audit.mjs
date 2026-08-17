import fs from 'node:fs'
import path from 'node:path'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const normalized=file=>file.replace(/\\/g,'/')
const under=(file,prefix)=>normalized(file).startsWith(prefix)
const ends=(file,suffix)=>normalized(file).endsWith(suffix)
const display=file=>normalized(file)

const pkg=JSON.parse(read('package.json'))
for(const [name,version] of Object.entries({...pkg.dependencies,...pkg.devDependencies})) {
  if(typeof version==='string' && /^[~^><=*]/.test(version)) failures.push(`dependency is not exact-pinned: ${name}@${version}`)
}
if(pkg.packageManager!=='npm@10.9.2') failures.push('npm package manager version is not pinned')
const requireFile=file=>{if(!fs.existsSync(file))failures.push(`missing ${file}`)}

for(const file of ['lib/http.ts','lib/security.ts','lib/rate-limit.ts','lib/server-log.ts','supabase/upgrade-v13.sql','.github/workflows/ci.yml','SECURITY.md']) requireFile(file)

const next=read('next.config.ts')
for(const token of ['Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Permissions-Policy','Cross-Origin-Opener-Policy','Cross-Origin-Resource-Policy']) if(!next.includes(token)) failures.push(`security header missing: ${token}`)
const middleware=read('middleware.ts')
if(!middleware.includes('Content-Security-Policy')||!middleware.includes('nonce-${nonce}')||!middleware.includes("'strict-dynamic'")) failures.push('request-scoped nonce Content-Security-Policy is missing')
if(middleware.includes("'unsafe-inline'") && /script-src[^\n]*unsafe-inline/.test(middleware)) failures.push('script-src permits unsafe-inline')
if(!next.includes("poweredByHeader: false")) failures.push('X-Powered-By is not disabled')
if(next.includes('productionBrowserSourceMaps: true')) failures.push('production browser source maps are enabled')

const schema=read('supabase/schema.sql')
for(const table of ['provider_rules','calculations','audit_requests','company_profiles','counterparties','payment_drafts','api_keys','workspace_invitations','invoices','api_request_logs','workspace_audit_log','flowpay_rate_limit_counters','system_event_logs','api_usage_daily']) {
  if(!new RegExp(`alter table public\\.${table} enable row level security`, 'i').test(schema)) failures.push(`RLS not enabled for ${table}`)
}
for(const fn of ['flowpay_check_rate_limit','flowpay_record_api_usage','flowpay_audit_change']) {
  const idx=schema.lastIndexOf(`create or replace function public.${fn}`)
  if(idx<0) failures.push(`missing hardened function ${fn}`)
  else if(!schema.slice(idx,idx+2500).includes("set search_path = ''")) failures.push(`${fn} security-definer search_path is not hardened`)
}
if(!schema.includes('flowpay_rate_limit_counters')) failures.push('atomic rate limit counter table missing')
if(!schema.includes('on conflict(bucket,key_hash) do update')) failures.push('rate limiter is not atomic')

for(const table of ['payment_drafts','counterparties','invoices','api_keys','calculations']) {
  if(!schema.includes(`revoke insert, update, delete on public.${table} from authenticated`)) failures.push(`direct authenticated mutations are not revoked for ${table}`)
}
for(const policy of ['payment drafts own insert','payment drafts own update','counterparties own insert','counterparties own update','invoices own insert','invoices own update','api keys own insert','api keys own update','calculations own insert','company own insert','company own update']) {
  const lastCreate=schema.lastIndexOf(`create policy "${policy}"`)
  const lastDrop=schema.lastIndexOf(`drop policy if exists "${policy}"`)
  if(lastCreate>lastDrop) failures.push(`unsafe browser mutation policy remains active: ${policy}`)
}
for(const fn of ['flowpay_upsert_payment','flowpay_upsert_counterparty','flowpay_upsert_invoice','flowpay_set_payment_status','flowpay_set_invoice_status','flowpay_link_invoice_payment','flowpay_delete_payment_draft','flowpay_delete_counterparty','flowpay_import_counterparties','flowpay_import_invoices','flowpay_complete_onboarding']) {
  const idx=schema.lastIndexOf(`create or replace function public.${fn}`)
  if(idx<0) failures.push(`missing protected RPC ${fn}`)
  else {
    const window=schema.slice(idx,idx+14000)
    if(!window.includes('security definer')) failures.push(`${fn} is not SECURITY DEFINER after direct writes were revoked`)
    if(!window.includes("set search_path = ''")) failures.push(`${fn} search_path is not hardened`)
  }
}
if(!schema.includes('grant select (id,user_id,name,key_prefix,scope,expires_at,last_used_at,created_at,revoked_at) on public.api_keys to authenticated')) failures.push('API key hash column is still browser-readable')
if(!schema.includes('revoke insert, update on public.company_profiles from authenticated')) failures.push('company profile browser writes are not revoked')
if(!schema.includes('revoke select on public.provider_rules from anon, authenticated')) failures.push('provider pricing table still has broad browser SELECT')
if(!schema.includes('grant select (id,provider_code,display_name,from_country,to_country,currencies,active,source_updated_at)')) failures.push('provider browser access is not column-restricted')

const adminAuth=read('lib/admin-auth.ts')
if(!adminAuth.includes('FLOWPAY_ADMIN_USER_IDS')) failures.push('admin access is not restricted to immutable user IDs')
const cron=read('app/api/cron/maintenance/route.ts')
if(!cron.includes('CRON_SECRET')||!cron.includes('timingSafeEqual')||!cron.includes('flowpay_prune_operational_data')) failures.push('maintenance cron authentication/retention contract missing')

const apiFiles=[]
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walk(full);else if(entry.name==='route.ts')apiFiles.push(full)}}
walk('app/api')
for(const file of apiFiles){
  const text=read(file)
  if(/export async function (POST|PUT|PATCH|DELETE)/.test(text) && !ends(file,'api/fx/route.ts')) {
    if(!text.includes('requestId(') && !text.includes('requestJson(') && !ends(file,'api/health/route.ts')) failures.push(`${display(file)} has no request ID`)
  }
}
for(const file of ['app/api/quote/route.ts','app/api/audit/route.ts','app/api/v1/quote/route.ts','app/api/keys/route.ts','app/api/admin/provider-rules/route.ts','app/api/onboarding/route.ts','app/api/profile/route.ts','app/api/register/route.ts']) {
  const text=read(file)
  if(!text.includes('readJsonBody')) failures.push(`${file} has no bounded JSON body reader`)
}
for(const file of ['app/api/quote/route.ts','app/api/audit/route.ts','app/api/v1/quote/route.ts','app/api/keys/route.ts','app/api/account/route.ts','app/api/admin/provider-rules/route.ts','app/api/register/route.ts']) {
  if(!read(file).includes('checkRateLimit')) failures.push(`${file} has no rate limiting`)
}

const sourceDirs=['app','components','hooks','lib']
const source=[]
function walkSource(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,entry.name);if(entry.isDirectory())walkSource(full);else if(/\.(ts|tsx)$/.test(entry.name))source.push(full)}}
for(const dir of sourceDirs)walkSource(dir)

for(const file of source){
  const text=read(file)
  if(/\.from\(['"](?:payment_drafts|counterparties|invoices|api_keys|calculations|company_profiles)['"]\)[\s\S]{0,240}\.(?:insert|update|delete|upsert)\(/.test(text) && !under(file,'app/api/')) failures.push(`browser bypasses protected write surface: ${display(file)}`)
}
for(const file of source){
  const text=read(file)
  const rel=normalized(file)
  if(text.includes('SUPABASE_SECRET_KEY') && rel!=='lib/supabase/admin.ts' && rel!=='app/api/health/route.ts') failures.push(`Supabase secret reference outside server-only boundary: ${display(file)}`)
  if(/fp_live_[a-f0-9]{32,}/i.test(text)) failures.push(`literal production-looking API key in ${display(file)}`)
}

if(failures.length){console.error(`Security audit failed with ${failures.length} issue(s):`);for(const item of failures)console.error(`  - ${item}`);process.exit(1)}
console.log(`Security audit passed: ${apiFiles.length} API routes checked, RLS/headers/body limits/rate limits/request IDs verified.`)
