import fs from 'node:fs'
const failures=[]
const read=f=>fs.readFileSync(f,'utf8')
const requireAll=(f,tokens)=>{const s=read(f);for(const t of tokens)if(!s.includes(t))failures.push(`${f} missing v1.8 contract: ${t}`)}
for(const f of ['components/ui/badge.tsx','components/brand/CurrencyFlag.tsx','components/workspace/BankSearchField.tsx','app/api/banks/route.ts','lib/bank-directory.ts','app/(workspace)/settings/security/page.tsx'])if(!fs.existsSync(f))failures.push(`missing ${f}`)
requireAll('app/(workspace)/settings/security/page.tsx',["issuer: 'FlowPay'","FlowPay · Primary","FlowPay · Backup","Google Authenticator"])
requireAll('components/ui/badge.tsx',["h-[26px]","leading-none","whitespace-nowrap","rounded-[8px]","border"])
requireAll('components/workspace/BankSearchField.tsx',["/api/banks?country=","onBankSelect","BIC","degraded","BankMark"])
requireAll('app/api/banks/route.ts',['requireAal2','checkRateLimit','query.wikidata.org/sparql','wdt:P297','wdt:P2627','wdt:P154','AbortSignal.timeout','curatedBanks'])
requireAll('lib/bank-directory.ts',['safeWikimediaLogo',"source:'wikidata'|'curated'",'Sberbank','BNP Paribas','Deutsche Bank','JPMorgan Chase Bank'])
requireAll('lib/countries.ts',['currencyFlagCountry',"normalized === 'EUR'","normalized === 'USD'"])
requireAll('middleware.ts',['https://commons.wikimedia.org','https://upload.wikimedia.org'])
const counterparty=read('components/workspace/CounterpartyForm.tsx')
if(!counterparty.includes('<BankSearchField'))failures.push('Counterparty form does not use bank autocomplete')
if(!counterparty.includes('if(bank.bic)setBic(bank.bic)'))failures.push('Bank selection does not auto-fill BIC')
for(const f of ['app/onboarding/page.tsx','app/(workspace)/developer/page.tsx','app/(workspace)/routes/page.tsx','app/(workspace)/settings/page.tsx','components/workspace/CounterpartyForm.tsx','components/workspace/InvoiceForm.tsx','components/workspace/PaymentForm.tsx'])if(!read(f).includes('CurrencyFlag'))failures.push(`${f} does not use currency flags`)
const pkg=JSON.parse(read('package.json'));const lock=JSON.parse(read('package-lock.json'))
if(!/^1\.(?:8|9)\.\d+$/.test(pkg.version) && !/^2\.\d+\.\d+$/.test(pkg.version))failures.push(`expected FlowPay >=1.8.0, found ${pkg.version}`)
if(lock.version!==pkg.version||lock.packages?.['']?.version!==pkg.version)failures.push('package-lock version does not match package.json')
if(!String(pkg.scripts?.audit||'').includes('v18-product-polish-audit.mjs'))failures.push('main audit does not include v1.8 audit')
if(failures.length){console.error(`FlowPay v1.8 product polish audit failed with ${failures.length} issue(s):`);for(const x of failures)console.error(`- ${x}`);process.exit(1)}
console.log('FlowPay v1.8 product polish audit passed: branded TOTP issuer, aligned badges, bank directory/autofill and currency flags verified.')
