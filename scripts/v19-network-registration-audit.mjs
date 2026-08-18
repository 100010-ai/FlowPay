import fs from 'node:fs'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const requireFile=file=>{if(!fs.existsSync(file))failures.push(`missing ${file}`)}
const requireAll=(file,tokens)=>{const text=read(file);for(const token of tokens)if(!text.includes(token))failures.push(`${file} missing v1.9 contract: ${token}`)}

for(const file of [
  'lib/provider-network.ts','app/api/coverage/route.ts','components/HomePage.tsx','components/admin/AdminConsole.tsx',
  'app/api/register/route.ts','lib/server-log.ts','supabase/upgrade-v19.sql','app/api/admin/provider-rules/route.ts'
]) requireFile(file)

requireAll('lib/provider-network.ts',[
  'providerNetworkCatalog','Wise Business','Airwallex','Revolut Business','Currencycloud','Nium','Corpay Cross-Border',
  'Convera','OFX','WorldFirst','Thunes','Banking Circle','Payoneer','iBanFirst','does NOT make it eligible for quote routing'
])
const adminConsole=read('components/admin/AdminConsole.tsx')
if(/applyProvider[\s\S]{0,500}source:provider\.sourceUrl/.test(adminConsole))failures.push('provider preset incorrectly treats network catalog URL as pricing provenance')

const catalog=read('lib/provider-network.ts')
const providerRows=(catalog.match(/code: '/g)||[]).length
if(providerRows!==13)failures.push(`expected 13 provider network profiles, found ${providerRows}`)
if(/fee_percent|fixed_fee|fx_markup_percent/.test(catalog))failures.push('provider network catalog must not contain route pricing')

requireAll('app/api/coverage/route.ts',['network: {','routing,','providers: routing.providers','getProviderCoverage','getProviderNetworkCoverage'])
requireAll('components/HomePage.tsx',['coverage?.network.providers','coverage?.routing.rules','active production rules only'])
requireAll('components/admin/AdminConsole.tsx',['Provider preset','Fallback-маршрутов нет.','providersDetail','Production routing rules',"active:true, source:''",'Pricing source'])
requireAll('app/api/admin/provider-rules/route.ts',['supportedCurrencies.length','max(500)'])
requireAll('app/api/register/route.ts',[
  "admin.rpc('flowpay_registration_ready')","admin.rpc('flowpay_record_registration_legal'",'REGISTRATION_SCHEMA_NOT_READY',
  'REGISTRATION_LEGAL_RECEIPT_FAILED','REGISTRATION_ROLLBACK_FAILED','There is intentionally no'
])
requireAll('lib/server-log.ts',["'[flowpay:system-log]'",'console.error','safeErrorMessage'])
requireAll('supabase/upgrade-v19.sql',[
  'flowpay_registration_ready()','flowpay_record_registration_legal','registration_server',
  'grant execute on function public.flowpay_registration_ready() to service_role',
  'grant execute on function public.flowpay_record_registration_legal(uuid,text,text,text,timestamptz) to service_role'
])
const migration=read('supabase/upgrade-v19.sql')
if(/grant execute on function public\.flowpay_(?:registration_ready|record_registration_legal)[\s\S]*? to (?:anon|authenticated)/i.test(migration)) failures.push('registration RPC exposed to a client role')

const pkg=JSON.parse(read('package.json'));const lock=JSON.parse(read('package-lock.json'))
if(pkg.version!=='1.9.0' && !/^2\.\d+\.\d+$/.test(pkg.version))failures.push(`expected FlowPay >=1.9.0, found ${pkg.version}`)
if(lock.version!==pkg.version||lock.packages?.['']?.version!==pkg.version)failures.push('package-lock version does not match package.json')
if(!String(pkg.scripts?.audit||'').includes('v19-network-registration-audit.mjs'))failures.push('main audit does not include v1.9 audit')

if(failures.length){console.error(`FlowPay v1.9 network/registration audit failed with ${failures.length} issue(s):`);for(const issue of failures)console.error(`- ${issue}`);process.exit(1)}
console.log('FlowPay v1.9 network/registration audit passed: provider catalog is non-pricing, routing stays production-only, full currency-directory rule editing and signup schema guards verified.')
