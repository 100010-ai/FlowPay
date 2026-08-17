import fs from 'node:fs'
import path from 'node:path'

const failures=[]
const read=file=>fs.readFileSync(file,'utf8')
const requireFile=file=>{if(!fs.existsSync(file))failures.push(`missing ${file}`)}
const requireAll=(file,tokens)=>{const text=read(file);for(const token of tokens)if(!text.includes(token))failures.push(`${file} missing security contract: ${token}`)}

for(const file of [
  'middleware.ts','app/layout.tsx','lib/server-auth.ts','lib/client-security.ts','app/mfa/page.tsx',
  'app/(workspace)/settings/security/page.tsx','components/workspace/WorkspaceProvider.tsx','app/api/register/route.ts',
  'supabase/upgrade-v16.sql','scripts/cleanup-legacy.mjs'
]) requireFile(file)

requireAll('middleware.ts',["nonce-${nonce}","'strict-dynamic'","script-src-attr 'none'","frame-ancestors 'none'","frame-src 'none'","Cache-Control', 'private, no-store","x-nonce"])
const middleware=read('middleware.ts')
if(/script-src[^\n`]*unsafe-inline/.test(middleware)) failures.push('production script CSP permits unsafe-inline')
if(middleware.includes('*.supabase.co')) failures.push('CSP contains a wildcard Supabase origin')
if(!middleware.includes("source: '/((?!api|_next/static|_next/image")) failures.push('nonce CSP is not applied to the complete HTML surface')
requireAll('app/layout.tsx',["from 'next/headers'",'await headers()'])

requireAll('lib/server-auth.ts',['authenticatedAal2Client','getUser(token)','validatedAalFromToken',"payload.aal === 'aal2'",'MFA_REQUIRED','requireAal2'])
requireAll('lib/client-security.ts',['currentAssurance','mfaDestination','/mfa?next=','/settings/security?required=1'])
requireAll('lib/supabase/client.ts',["'use client'",'window.sessionStorage','persistSession: true','autoRefreshToken: true','detectSessionInUrl: true','browserClient ??= makeBrowserClient()'])
if(read('lib/supabase/client.ts').includes('window.localStorage')) failures.push('browser auth session is persisted in localStorage')
requireAll('app/mfa/page.tsx',['auth.mfa.challenge','auth.mfa.verify','auth.mfa.listFactors','safeInternalPath','one-time-code','Choose an authenticator'])
requireAll('app/(workspace)/settings/security/page.tsx',['auth.mfa.enroll',"factorType: 'totp'",'auth.mfa.challenge','auth.mfa.verify','auth.mfa.unenroll','verifiedFactors','Add backup TOTP'])

const provider=read('components/workspace/WorkspaceProvider.tsx')
for(const token of ['getAuthenticatorAssuranceLevel',"currentLevel !== 'aal2'",'payments: [], counterparties: [], calculations: [], audits: [], apiKeys: [], invoices: [], apiLogs: [], apiUsage: [], providerRules: [], auditLogs: []','/settings/security?required=1','/mfa?next=']) if(!provider.includes(token)) failures.push(`WorkspaceProvider missing AAL2 gate contract: ${token}`)
if(!provider.includes("scope,expires_at")) failures.push('API key metadata loader does not include scope/expiry')

const sql=read('supabase/upgrade-v16.sql')
for(const token of [
  'revoke create on schema public from public, anon, authenticated',
  'revoke usage on schema public from public, anon',
  'create or replace function public.flowpay_require_aal2()',
  "auth.jwt()->>'aal'",
  'as restrictive for all to authenticated',
  'force row level security',
  "scope='quote:read'",
  "expires_at timestamptz",
  'validate constraint api_keys_scope_chk',
  'validate constraint api_keys_expiry_chk',
  'api_keys_hash_state_idx',
  'flowpay_onboarding_status',
  'LEGAL_ACCEPTANCE_REQUIRED',
  'ONBOARDING_ALREADY_COMPLETED',
  'where public.company_profiles.onboarding_completed_at is null',
  "source='registration_server'",
  "source='legacy_registration' where source='registration'",
  "'legacy_registration'",
  'drop trigger if exists flowpay_record_signup_legal_acceptances on auth.users',
  "document_type='privacy' and document_version='2026-08-17'",
  "document_type='terms' and document_version='2026-08-17'",
  'flowpay_update_profile',
  'revoke insert, update, delete on public.workspace_invitations from authenticated',
  "p.proname like 'flowpay_%'",
  "revoke all on function %s from public, anon, authenticated",
  'grant execute on function public.flowpay_check_rate_limit(text,text,integer,integer) to service_role'
]) if(!sql.includes(token)) failures.push(`upgrade-v16.sql missing hardening: ${token}`)
const mutationFns=['flowpay_upsert_payment','flowpay_upsert_counterparty','flowpay_upsert_invoice','flowpay_set_payment_status','flowpay_set_invoice_status','flowpay_link_invoice_payment','flowpay_delete_payment_draft','flowpay_delete_counterparty','flowpay_import_counterparties','flowpay_import_invoices','flowpay_update_profile']
for(const fn of mutationFns){const idx=sql.lastIndexOf(`create or replace function public.${fn}`);if(idx<0)failures.push(`upgrade-v16.sql missing ${fn}`);else if(!sql.slice(idx,idx+16000).includes('perform public.flowpay_require_aal2();'))failures.push(`${fn} does not require AAL2`)}
if(!sql.includes("grant select (id,user_id,name,key_prefix,scope,expires_at,last_used_at,created_at,revoked_at) on public.api_keys to authenticated")) failures.push('API key browser SELECT is not column-restricted to metadata')

const sensitiveMutations=[
  'app/api/account/route.ts','app/api/keys/route.ts','app/api/profile/route.ts','app/api/payments/route.ts',
  'app/api/import/counterparties/route.ts','app/api/import/invoices/route.ts','app/api/admin/provider-rules/route.ts'
]
for(const file of sensitiveMutations){const text=read(file);if(!text.includes('trustedMutationOrigin'))failures.push(`${file} lacks same-origin mutation protection`);if(!text.includes('requireAal2'))failures.push(`${file} lacks AAL2 server enforcement`)}
requireAll('app/api/register/route.ts',['trustedMutationOrigin','checkRateLimit','readJsonBody','LEGAL_VERSIONS','registration_server','createServerClient','createAdminClient','admin.auth.admin.deleteUser','REGISTRATION_ROLLBACK_FAILED'])
const registerPage=read('components/RegisterPage.tsx')
if(registerPage.includes('.auth.signUp(')) failures.push('browser registration still calls Supabase Auth directly')
if(registerPage.includes('target="_blank"') && !registerPage.includes('rel="noopener noreferrer"')) failures.push('registration legal link opens a new tab without noopener/noreferrer')
for(const token of ["fetch('/api/register'",'privacyVersion:LEGAL_VERSIONS.privacy','termsVersion:LEGAL_VERSIONS.terms','minLength={12}','maxLength={128}','maxLength={320}']) if(!registerPage.includes(token)) failures.push(`registration UI missing hardened contract: ${token}`)
requireAll('app/reset-password/page.tsx',["signOut({ scope: 'global' })",'minLength={12}','maxLength={128}'])
requireAll('lib/security.ts',['@[A-Z0-9.-]+','[A-Z]{2}\\d{2}[A-Z0-9]{10,30}'])
requireAll('public/.well-known/security.txt',['Contact: https://flowpay-network.vercel.app/security','Canonical: https://flowpay-network.vercel.app/.well-known/security.txt','Preferred-Languages: en, ru'])

requireAll('app/api/admin/overview/route.ts',['requireAal2','isFlowPayAdmin'])
requireAll('app/api/quote/route.ts',["auth?.assuranceLevel === 'aal2'",'createAdminClient'])
requireAll('app/api/audit/route.ts',["auth?.assuranceLevel === 'aal2' ? auth.user.id : null"])
requireAll('app/api/keys/route.ts',["scope: 'quote:read'",'ttlDays','expires_at',"if ((count || 0) >= 10)"])
requireAll('app/api/v1/quote/route.ts',['scope,expires_at',"key.scope !== 'quote:read'",'new Date(key.expires_at).getTime() <= Date.now()'])

const rate=read('lib/rate-limit.ts')
if(!rate.includes("request.headers.get('x-forwarded-for')")) failures.push('rate-limit identity does not use Vercel x-forwarded-for')
if(rate.includes("request.headers.get('x-vercel-forwarded-for')")) failures.push('rate-limit trusts x-vercel-forwarded-for')

for(const legacy of ['PaymentDialog.tsx','CounterpartyDialog.tsx','InvoiceDialog.tsx']){
  const file=path.join('components','workspace',legacy)
  if(fs.existsSync(file))failures.push(`legacy mutation dialog remains: ${file}`)
  if(!read('scripts/cleanup-legacy.mjs').includes(file.replaceAll('\\','/')))failures.push(`cleanup does not remove legacy dialog: ${file}`)
}

const pkg=JSON.parse(read('package.json'))
if(!/^1\.6\.\d+$/.test(pkg.version)) failures.push(`expected FlowPay 1.6.x, found ${pkg.version}`)
if(!String(pkg.scripts?.audit||'').includes('v16-security-audit.mjs')) failures.push('main audit does not include v1.6 security audit')
if(pkg.scripts?.['security:prod']!=='node scripts/production-security-check.mjs') failures.push('production security smoke command is missing')
requireAll('scripts/production-security-check.mjs',["script-src permits unsafe-inline","cross-origin /api/register","unauthenticated /api/keys","API quote without key"])


requireAll('app/(workspace)/settings/security/page.tsx',["auth.mfa.unenroll","auth.refreshSession","signOut({ scope: 'global' })"])
requireAll('.github/workflows/ci.yml',["actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1","persist-credentials: false","actions/setup-node@820762786026740c76f36085b0efc47a31fe5020","node-version: '24.19.0'","package-manager-cache: false"])
requireAll('.github/workflows/codeql.yml',["github/codeql-action/init@e4fba868fa4b1b91e1fdab776edc8cfbe6e9fb81","github/codeql-action/analyze@e4fba868fa4b1b91e1fdab776edc8cfbe6e9fb81","javascript-typescript","security-events: write"])
requireAll('.github/dependabot.yml',["version-update:semver-major","package-ecosystem: github-actions"])
if(read('.nvmrc').trim()!=='24.19.0')failures.push('Local/CI Node runtime is not pinned to 24.19.0')
if(pkg.engines?.node!=='24.x')failures.push(`Vercel Node engine is not platform-compatible: ${pkg.engines?.node||'missing'}`)

if(failures.length){console.error(`FlowPay v1.6 security audit failed with ${failures.length} issue(s):`);for(const issue of failures)console.error(`- ${issue}`);process.exit(1)}
console.log('FlowPay v1.6 security audit passed: nonce CSP, AAL2/MFA, RLS, mutation gates, API-key expiry and legacy cleanup verified.')
