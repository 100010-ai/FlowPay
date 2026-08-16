import fs from 'node:fs'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const pkg=JSON.parse(read('package.json'))
const recharts=String(pkg.dependencies?.recharts||'')
if(!/^3\./.test(recharts)) failures.push(`Recharts is not v3: ${recharts}`)
if(String(pkg.dependencies?.['react-is']||'') !== String(pkg.dependencies?.react||'')) failures.push('react-is must be pinned to the same React release for Recharts v3')

const lazyCharts=read('components/workspace/LazyCharts.tsx')
if(!lazyCharts.includes("dynamic(() => import('./Charts')")||!lazyCharts.includes('ssr: false')) failures.push('Recharts bundle is not lazy-loaded')
const workspace=read('components/workspace/WorkspaceProvider.tsx')
if(/select\(['"]\*['"]\)/.test(workspace)) failures.push('WorkspaceProvider still uses select(*)')
if(!workspace.includes('usePathname')) failures.push('Workspace data loading is not route-aware')
if(!workspace.includes('authCache')||!workspace.includes('validatedAt > 60_000')) failures.push('workspace revalidates Auth over the network on every tab navigation')
if(!workspace.includes('loadedAt.current')||!workspace.includes('staleWithLimit')) failures.push('Workspace navigation does not reuse fresh bounded datasets')
if(!workspace.includes('const paymentLimit = highPaymentDetail ? 500 : 80')||!workspace.includes('.limit(paymentLimit)')) failures.push('Workspace does not cap adaptive payment payloads')

const limiter=read('lib/rate-limit.ts')
if(!limiter.includes('localBurstAllowed')||!limiter.includes('LOCAL_COUNTER_MAX')) failures.push('rate limiter lacks bounded hot-burst prefilter')
const quote=read('app/api/quote/route.ts')
const v1=read('app/api/v1/quote/route.ts')
const audit=read('app/api/audit/route.ts')
for(const [file,text] of [['quote',quote],['v1 quote',v1],['audit',audit]]) if(!text.includes('getEligibleProviderRules')) failures.push(`${file} bypasses provider-rule cache`)
const provider=read('lib/provider-rules.ts')
if(!provider.includes('unstable_cache')) failures.push('provider rule cache missing')
if(!provider.includes('revalidate: 60')) failures.push('provider rule cache TTL missing')
const fxHook=read('hooks/use-fx-map.ts')
if(!fxHook.includes('/api/fx?sources=')||fxHook.includes('Promise.all(targets.map')) failures.push('workspace FX still creates one browser request per currency')
const fx=read('lib/fx.ts')
if(!fx.includes('revalidate: 3600 * 6')) failures.push('ECB response cache missing')
if(!fx.includes('AbortSignal.timeout')) failures.push('ECB request timeout missing')
const health=read('app/api/health/route.ts')
if(!health.includes('unstable_cache')||!health.includes('revalidate: 15')) failures.push('public health polling still hits the database on every request')

const schema=read('supabase/schema.sql')
for(const index of ['provider_rules_active_corridor_amount_idx','provider_rules_active_currencies_gin_idx','payment_drafts_user_status_updated_idx','payment_drafts_user_open_due_idx','invoices_user_status_due_idx','api_keys_user_active_idx','api_usage_daily_user_date_idx','flowpay_rate_limit_counters_updated_idx','api_request_logs_created_at_idx','system_event_logs_created_at_idx']) if(!schema.includes(index)) failures.push(`performance index missing: ${index}`)
if(!schema.includes('api_usage_daily')) failures.push('bounded API usage aggregate missing')
if(!schema.includes('flowpay_prune_operational_data')) failures.push('operational retention helper missing')
if(!schema.includes('drop table if exists public.flowpay_rate_limit_events')) failures.push('obsolete event-per-request rate limiter storage is still retained')
if(!schema.includes('flowpay_import_counterparties')||!schema.includes('flowpay_import_invoices')) failures.push('CSV imports are not atomic server-side batches')

if(failures.length){console.error(`Performance audit failed with ${failures.length} issue(s):`);for(const item of failures)console.error(`  - ${item}`);process.exit(1)}
console.log('Performance audit passed: route-aware loading, provider/FX caching, bounded API usage and database indexes verified.')
