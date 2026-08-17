import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const root=process.cwd()
const sourceRoots=['app','components','hooks','lib']
const extensions=['.ts','.tsx','.css','.mjs','.js']
const sourceFiles=[]
for(const dir of sourceRoots) walk(path.join(root,dir))

function walk(dir){
  if(!fs.existsSync(dir)) return
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name)
    if(entry.isDirectory()) walk(full)
    else if(extensions.includes(path.extname(entry.name))) sourceFiles.push(full)
  }
}
function rel(p){return path.relative(root,p).replaceAll('\\','/')}
function fail(message){errors.push(message)}
const errors=[]
const warnings=[]

// 1. Required product surface.
for(const required of [
  'app/page.tsx','app/login/page.tsx','app/mfa/page.tsx','app/register/page.tsx','app/(workspace)/dashboard/page.tsx','app/(workspace)/payments/page.tsx',
  'app/(workspace)/counterparties/page.tsx','app/(workspace)/routes/page.tsx','app/(workspace)/analytics/page.tsx',
  'app/(workspace)/reports/page.tsx','app/(workspace)/invoices/page.tsx',
  'app/(workspace)/developer/page.tsx','app/(workspace)/developer/keys/new/page.tsx','app/(workspace)/settings/page.tsx','app/(workspace)/settings/security/page.tsx','app/(workspace)/admin/page.tsx','app/onboarding/page.tsx','app/reset-password/page.tsx','app/status/page.tsx','app/robots.ts','app/sitemap.ts','app/privacy/page.tsx','app/terms/page.tsx','app/security/page.tsx','app/api/coverage/route.ts','app/api/health/route.ts','supabase/schema.sql','supabase/upgrade-v10.sql','supabase/upgrade-v11.sql','supabase/upgrade-v12.sql','supabase/upgrade-v13.sql','supabase/upgrade-v15.sql','supabase/upgrade-v16.sql'
]) if(!fs.existsSync(path.join(root,required))) fail(`Missing required file: ${required}`)

// 1b. Critical entry-point export contract.
const homeSource=fs.readFileSync(path.join(root,'components/HomePage.tsx'),'utf8')
if(!/export\s+function\s+HomePage\s*\(/.test(homeSource) && !/export\s+const\s+HomePage\b/.test(homeSource)) fail('components/HomePage.tsx must export HomePage')

// 2. Local import resolution without requiring node_modules.
const importRe=/(?:from\s*|import\s*)['"](@\/[^'"]+|\.\.?\/[^'"]+)['"]/g
for(const file of sourceFiles.filter(f=>/\.(ts|tsx)$/.test(f))){
  const text=fs.readFileSync(file,'utf8'); let match
  while((match=importRe.exec(text))){
    const spec=match[1]
    const base=spec.startsWith('@/')?path.join(root,spec.slice(2)):path.resolve(path.dirname(file),spec)
    const candidates=[base,...['.ts','.tsx','.js','.mjs','.json'].map(ext=>base+ext),...['index.ts','index.tsx','index.js'].map(name=>path.join(base,name))]
    if(!candidates.some(c=>fs.existsSync(c))) fail(`Unresolved local import ${spec} in ${rel(file)}`)
  }
}

// 3. Production-data / visual invariants.
const forbidden=[
  ['mock customer/company',/\b(?:Acme Industries|Mavi Tekstil|Alex Martin)\b/i],
  ['mock showcase numbers',/€24\.78M|€721K|9,166,425/i],
  ['legacy dark theme',/data-theme|flowpay-theme|prefers-color-scheme\s*:\s*dark/i],
  ['hard black surface',/\bbg-(?:black|\[#(?:000|000000|0d0e0f|111111)\])/i],
  ['random product data',/Math\.random\s*\(/],
]
for(const file of sourceFiles){
  const text=fs.readFileSync(file,'utf8')
  for(const [name,re] of forbidden) if(re.test(text)) fail(`${name}: ${rel(file)}`)
}

// 3b. v1.0 dual-currency and coverage invariants.
const countriesSource=fs.readFileSync(path.join(root,'lib/countries.ts'),'utf8')
const countryCount=(countriesSource.match(/'[A-Z]{2}'/g)||[]).length
if(countryCount < 240) fail(`ISO country coverage unexpectedly low: ${countryCount}`)
for(const apiFile of ['app/api/quote/route.ts','app/api/v1/quote/route.ts','app/api/audit/route.ts']){
  const text=fs.readFileSync(path.join(root,apiFile),'utf8')
  if(!text.includes('sourceCurrency')||!text.includes('recipientCurrency')) fail(`Dual-currency contract missing from ${apiFile}`)
}
const developerSource=fs.readFileSync(path.join(root,'app/(workspace)/developer/page.tsx'),'utf8')
if(!developerSource.includes('sourceCurrency')||!developerSource.includes('recipientCurrency')) fail('Developer API example is not dual-currency')
const readmeSource=fs.readFileSync(path.join(root,'README.md'),'utf8')
if(!readmeSource.includes('sourceCurrency')||!readmeSource.includes('recipientCurrency')) fail('README API contract is not dual-currency')

// 4. No provider pricing seeds in schema/upgrade.
for(const sqlFile of ['supabase/schema.sql','supabase/upgrade-v10.sql','supabase/upgrade-v11.sql','supabase/upgrade-v12.sql','supabase/upgrade-v13.sql','supabase/upgrade-v15.sql','supabase/upgrade-v16.sql']){
  const text=fs.readFileSync(path.join(root,sqlFile),'utf8')
  if(/insert\s+into\s+public\.provider_rules/i.test(text)) fail(`Provider pricing seed found in ${sqlFile}`)
  if(!/enable row level security/i.test(text)) fail(`RLS setup missing from ${sqlFile}`)
}

// 5. Environment values are intentionally outside the source audit.
// Run `npm run check:env` explicitly in a trusted local/deployment environment.

// 6. Package contract.
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'))
if(!/^1\.(?:6|7|8)\.\d+$/.test(pkg.version)) fail(`package.json version is ${pkg.version}, expected FlowPay 1.6+`)
for(const dep of ['next','react','@supabase/supabase-js','tailwindcss','@tailwindcss/postcss','lucide-react','recharts','country-flag-icons','zod']){
  if(!(dep in (pkg.dependencies||{})) && !(dep in (pkg.devDependencies||{}))) fail(`Missing required dependency: ${dep}`)
}

if(pkg.scripts?.typecheck !== 'next typegen && tsc --noEmit') fail('typecheck must regenerate Next route types before tsc')
if(!String(pkg.scripts?.pretypecheck||'').includes('cleanup:generated')) fail('pretypecheck must clean stale .next artifacts')
if(!String(pkg.scripts?.prebuild||'').includes('cleanup:generated')) fail('prebuild must clean stale .next artifacts')
if(!fs.existsSync(path.join(root,'scripts/cleanup-generated.mjs'))) fail('Missing generated-artifact cleanup script')

// 7. Basic accessibility / UX guardrails.
for(const file of sourceFiles.filter(f=>f.endsWith('.tsx'))){
  const text=fs.readFileSync(file,'utf8')
  if(/<img\b/i.test(text) && !/\balt=/i.test(text)) warnings.push(`Review img alt text: ${rel(file)}`)
  if(/onClick=/.test(text) && /<div[^>]+onClick=/.test(text)) warnings.push(`Review clickable div semantics: ${rel(file)}`)
}

if(errors.length){
  console.error(`Project audit failed with ${errors.length} error(s):`)
  for(const e of errors) console.error(`  - ${e}`)
  if(warnings.length){console.error(`Warnings (${warnings.length}):`);for(const w of warnings)console.error(`  - ${w}`)}
  process.exit(1)
}
console.log(`Project audit passed: ${sourceFiles.length} source files, local imports resolved, production-data invariants intact.`)
if(warnings.length){console.log(`Warnings (${warnings.length}):`);for(const w of warnings)console.log(`  - ${w}`)}
