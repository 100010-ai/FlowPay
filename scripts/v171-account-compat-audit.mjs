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
const authPage=read('components/AuthPage.tsx')
if(!(authPage.includes("fetch('/api/onboarding/status'")||authPage.includes("fetchWithClientTimeout('/api/onboarding/status'"))) failures.push('components/AuthPage.tsx missing onboarding status request')
if(!authPage.includes('onboarding.completed')) failures.push('components/AuthPage.tsx missing v1.7.1 contract: onboarding.completed')
const onboarding=read('app/onboarding/page.tsx')
if(!(onboarding.includes("fetch('/api/onboarding/status'")||onboarding.includes("fetchWithClientTimeout('/api/onboarding/status'"))) failures.push('app/onboarding/page.tsx missing bounded onboarding status request')
for(const token of ['checkingAccount','aal.currentLevel','LEGAL_ACCEPTANCE_REQUIRED']) if(!onboarding.includes(token)) failures.push(`app/onboarding/page.tsx missing v1.7.1 contract: ${token}`)
requireAll('app/api/onboarding/route.ts',['resolveOnboardingState','alreadyCompleted','ONBOARDING_ALREADY_COMPLETED','LEGAL_ACCEPTANCE_REQUIRED'])

const migration=read('supabase/upgrade-v171.sql')
if(/insert\s+into\s+public\.legal_acceptances/i.test(migration)) failures.push('v1.7.1 compatibility migration fabricates legal acceptance receipts')
if(/delete\s+from\s+public\.company_profiles/i.test(migration)) failures.push('v1.7.1 compatibility migration deletes company profiles')

const helper=read('lib/onboarding-state.ts')
if(!helper.includes(".maybeSingle<LegacyProfileRow>()")) failures.push('legacy fallback is not bounded to one company profile row')

const pkg=JSON.parse(read('package.json'))
const lock=JSON.parse(read('package-lock.json'))
if(!/^1\.7\.[1-9][0-9]*$/.test(pkg.version)) failures.push(`expected package version >=1.7.1 <1.8.0, found ${pkg.version}`)
if(lock.version!==pkg.version||lock.packages?.['']?.version!==pkg.version) failures.push('package-lock root metadata does not match package version')
if(!String(pkg.scripts?.audit||'').includes('v171-account-compat-audit.mjs')) failures.push('main audit does not include v1.7.1 compatibility audit')

if(failures.length){console.error(`FlowPay v1.7.1 compatibility audit failed with ${failures.length} issue(s):`);for(const issue of failures)console.error(`- ${issue}`);process.exit(1)}
console.log('FlowPay v1.7.1 compatibility audit passed: legacy company recovery, onboarding preflight, idempotent save and legal-receipt integrity verified.')
