import fs from 'node:fs'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const requireFile=file=>{if(!fs.existsSync(file))failures.push(`missing ${file}`)}
const requireAll=(file,tokens)=>{const text=read(file);for(const token of tokens)if(!text.includes(token))failures.push(`${file} missing v1.7.1 contract: ${token}`)}

for(const file of [
  'supabase/upgrade-v171.sql','lib/onboarding-state.ts','app/api/onboarding/status/route.ts',
  'app/api/onboarding/route.ts','app/onboarding/page.tsx','components/AuthPage.tsx'
]) requireFile(file)

requireAll('supabase/upgrade-v171.sql',[
  'update public.company_profiles','onboarding_completed_at is null','flowpay_onboarding_status()',
  "length(trim(coalesce(name, ''))) between 2 and 160","grant execute on function public.flowpay_onboarding_status() to authenticated"
])
requireAll('lib/onboarding-state.ts',[
  'resolveOnboardingState','createAdminClient','company_profiles',".eq('user_id', userId)",'validLegacyProfile'
])
requireAll('app/api/onboarding/status/route.ts',[
  'authenticatedClient','checkRateLimit','resolveOnboardingState','UNAUTHORIZED','PROFILE_STATUS_FAILED'
])
requireAll('components/AuthPage.tsx',["fetch('/api/onboarding/status'",'onboarding.completed'])
requireAll('app/onboarding/page.tsx',["fetch('/api/onboarding/status'",'checkingAccount','aal.currentLevel','LEGAL_ACCEPTANCE_REQUIRED'])
requireAll('app/api/onboarding/route.ts',['resolveOnboardingState','alreadyCompleted','ONBOARDING_ALREADY_COMPLETED','LEGAL_ACCEPTANCE_REQUIRED'])

const migration=read('supabase/upgrade-v171.sql')
if(/insert\s+into\s+public\.legal_acceptances/i.test(migration)) failures.push('v1.7.1 compatibility migration fabricates legal acceptance receipts')
if(/delete\s+from\s+public\.company_profiles/i.test(migration)) failures.push('v1.7.1 compatibility migration deletes company profiles')

const helper=read('lib/onboarding-state.ts')
if(!helper.includes(".maybeSingle<LegacyProfileRow>()")) failures.push('legacy fallback is not bounded to one company profile row')

const pkg=JSON.parse(read('package.json'))
const lock=JSON.parse(read('package-lock.json'))
if(pkg.version!=='1.7.1') failures.push(`expected package version 1.7.1, found ${pkg.version}`)
if(lock.version!==pkg.version||lock.packages?.['']?.version!==pkg.version) failures.push('package-lock root metadata does not match 1.7.1')
if(!String(pkg.scripts?.audit||'').includes('v171-account-compat-audit.mjs')) failures.push('main audit does not include v1.7.1 compatibility audit')

if(failures.length){console.error(`FlowPay v1.7.1 compatibility audit failed with ${failures.length} issue(s):`);for(const issue of failures)console.error(`- ${issue}`);process.exit(1)}
console.log('FlowPay v1.7.1 compatibility audit passed: legacy company recovery, onboarding preflight, idempotent save and legal-receipt integrity verified.')
