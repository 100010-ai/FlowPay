import fs from 'node:fs'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const requireFile=file=>{if(!fs.existsSync(file))failures.push(`missing ${file}`)}
const requireAll=(file,tokens)=>{const text=read(file);for(const token of tokens)if(!text.includes(token))failures.push(`${file} missing v1.7.2 contract: ${token}`)}

for(const file of ['lib/client-timeout.ts','app/onboarding/page.tsx','app/mfa/page.tsx','app/(workspace)/settings/security/page.tsx']) requireFile(file)
requireAll('lib/client-timeout.ts',['withClientTimeout','fetchWithClientTimeout','AbortController','ClientTimeoutError'])
requireAll('app/onboarding/page.tsx',['fetchWithClientTimeout','withClientTimeout','8_000','12_000','checkAccount','Повторить','lg:grid-cols-[420px_minmax(0,1fr)]','lg:min-h-[720px]'])
requireAll('app/mfa/page.tsx',['withClientTimeout','MFA_FACTORS_TIMEOUT','MFA_VERIFY_TIMEOUT','RefreshCw'])
requireAll('app/(workspace)/settings/security/page.tsx',['withClientTimeout','MFA_ENROLL_TIMEOUT','MFA_CHALLENGE_TIMEOUT','MFA_VERIFY_TIMEOUT','xl:grid-cols-2','min-h-[430px]','Повторить'])

const onboarding=read('app/onboarding/page.tsx')
if(/await fetch\('\/api\/onboarding\/status'/.test(onboarding)) failures.push('onboarding status still uses an unbounded fetch')
if(/await fetch\('\/api\/onboarding'/.test(onboarding)) failures.push('onboarding save still uses an unbounded fetch')
const mfa=read('app/mfa/page.tsx')+read('app/(workspace)/settings/security/page.tsx')
if(/await client\.auth\.mfa\.(?:listFactors|getAuthenticatorAssuranceLevel|enroll|challenge|verify)\(/.test(mfa)) failures.push('MFA contains a directly awaited unbounded SDK call')

const pkg=JSON.parse(read('package.json'))
const lock=JSON.parse(read('package-lock.json'))
if(!/^1\.(?:7\.(?:[2-9]|[1-9][0-9]+)|8\.\d+|9\.\d+)$/.test(pkg.version) && !/^2\.\d+\.\d+$/.test(pkg.version)) failures.push(`expected package version >=1.7.2, found ${pkg.version}`)
if(lock.version!==pkg.version||lock.packages?.['']?.version!==pkg.version) failures.push('package-lock root metadata does not match package version')
if(!String(pkg.scripts?.audit||'').includes('v172-ux-timeout-audit.mjs')) failures.push('main audit does not include v1.7.2 UX timeout audit')

if(failures.length){console.error(`FlowPay v1.7.2 UX timeout audit failed with ${failures.length} issue(s):`);for(const issue of failures)console.error(`- ${issue}`);process.exit(1)}
console.log('FlowPay v1.7.2 UX timeout audit passed: bounded onboarding/MFA waits, retry states and aligned security/onboarding layouts verified.')
