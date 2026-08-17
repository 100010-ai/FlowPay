import fs from 'node:fs'

const read=(path)=>fs.readFileSync(path,'utf8')
const failures=[]
const expect=(condition,message)=>{if(!condition)failures.push(message)}

const dialog=read('components/ui/dialog.tsx')
const shell=read('components/workspace/WorkspaceShell.tsx')
const onboarding=read('app/onboarding/page.tsx')
const geo=read('app/api/geo/route.ts')
const developer=read('app/(workspace)/developer/page.tsx')
const dashboard=read('app/(workspace)/dashboard/page.tsx')
const settings=read('app/(workspace)/settings/page.tsx')

expect(!/backdrop-blur/.test(dialog),'Dialog still uses backdrop blur')
expect(!/bg-\[rgba\(20,34,25,\.2[02]\)\].*backdrop-blur/.test(shell),'Workspace overlays still use the legacy heavy backdrop')
expect(onboarding.includes("fetch('/api/geo'")||onboarding.includes("fetchWithClientTimeout('/api/geo'"),'Onboarding does not request server geolocation')
expect(onboarding.includes('defaultCurrencyForCountry'),'Onboarding does not map detected country to a reporting currency')
expect(geo.includes("x-vercel-ip-country"),'Geo route does not use the Vercel country header')
expect(geo.includes("x-vercel-ip-timezone"),'Geo route does not use the Vercel timezone header')
expect(geo.includes("Vary"),'Geo route does not vary responses by geolocation headers')
expect(developer.includes('API Playground'),'Developer page is missing API Playground')
expect(developer.includes("fetch('/api/v1/quote'"),'API Playground does not call the production quote endpoint')
expect(!/(localStorage|sessionStorage).*playKey/.test(developer),'API Playground persists the API key')
expect(developer.includes("fetch('/api/health'"),'Developer page is missing live health diagnostics')
expect(dashboard.includes('commitmentValue')&&dashboard.includes('30-day forecast'),'Dashboard is missing the 30-day commitments forecast')
expect(settings.includes('auth.mfa.listFactors'),'Settings does not inspect MFA state')
expect(settings.includes('Recent access changes')||settings.includes('Последние изменения доступа'),'Settings is missing recent access activity')

if(failures.length){
  console.error(`FlowPay v1.4 feature audit failed with ${failures.length} issue(s):`)
  for(const failure of failures)console.error(`- ${failure}`)
  process.exit(1)
}
console.log('FlowPay v1.4 feature audit passed: modal UX, geo onboarding, API Playground, health, forecast and security center verified.')
