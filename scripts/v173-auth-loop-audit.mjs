import fs from 'node:fs'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const requireAll=(file,tokens)=>{const text=read(file);for(const token of tokens)if(!text.includes(token))failures.push(`${file} missing v1.7.3 contract: ${token}`)}

requireAll('components/workspace/WorkspaceShell.tsx',["ws.mfaCurrentLevel==='aal2'","const canEvaluateSetup","const needsSetup=canEvaluateSetup"])
requireAll('components/workspace/WorkspaceProvider.tsx',['WORKSPACE_AUTH_TIMEOUT','WORKSPACE_MFA_TIMEOUT','WORKSPACE_DATA_TIMEOUT','withClientTimeout'])
requireAll('app/onboarding/page.tsx',['function hardReplace(path:string)','window.location.replace(path)','MFA_STATUS_TIMEOUT','setCheckingAccount(false)'])
requireAll('components/AuthPage.tsx',['fetchWithClientTimeout','withClientTimeout','LOGIN_TIMEOUT','LOGIN_MFA_TIMEOUT','window.location.replace'])
requireAll('app/mfa/page.tsx',['window.location.replace(requested)','window.location.replace(nextPath)'])

const shell=read('components/workspace/WorkspaceShell.tsx')
if(/const needsSetup=!ws\.loading&&Boolean\(ws\.user\)&&\(!ws\.profile/.test(shell)) failures.push('WorkspaceShell still infers onboarding from an AAL1-hidden profile')
const onboarding=read('app/onboarding/page.tsx')
if(onboarding.includes('let redirecting=false')) failures.push('onboarding still contains the redirecting flag that can pin the loading screen')
if(/if\(!redirecting\)setCheckingAccount\(false\)/.test(onboarding)) failures.push('onboarding loading state is still conditional on router redirect success')
const provider=read('components/workspace/WorkspaceProvider.tsx')
if(/await supabase\.auth\.getUser\(\)/.test(provider)) failures.push('workspace auth validation is still directly awaited without a deadline')
if(/await supabase\.auth\.mfa\.getAuthenticatorAssuranceLevel\(\)/.test(provider)) failures.push('workspace MFA validation is still directly awaited without a deadline')

const pkg=JSON.parse(read('package.json'))
const lock=JSON.parse(read('package-lock.json'))
if(!/^1\.(?:7\.[3-9][0-9]*|8\.\d+)$/.test(pkg.version)) failures.push(`expected package version >=1.7.3, found ${pkg.version}`)
if(lock.version!==pkg.version||lock.packages?.['']?.version!==pkg.version) failures.push('package-lock root metadata does not match package version')
if(!String(pkg.scripts?.audit||'').includes('v173-auth-loop-audit.mjs')) failures.push('main audit does not include v1.7.3 auth-loop audit')

if(failures.length){console.error(`FlowPay v1.7.3 auth-loop audit failed with ${failures.length} issue(s):`);for(const issue of failures)console.error(`- ${issue}`);process.exit(1)}
console.log('FlowPay v1.7.3 auth-loop audit passed: AAL1 profile hiding no longer triggers onboarding, auth transitions use hard navigation, and workspace/auth waits are bounded.')
