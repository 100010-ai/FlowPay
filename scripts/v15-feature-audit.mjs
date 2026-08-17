import fs from 'node:fs'
import path from 'node:path'
const failures=[]
const expect=(v,m)=>{if(!v)failures.push(m)}
const read=p=>fs.readFileSync(p,'utf8')
for(const file of ['app/register/page.tsx','components/RegisterPage.tsx','lib/legal.ts','app/(workspace)/payments/new/page.tsx','app/(workspace)/payments/[id]/edit/page.tsx','app/(workspace)/counterparties/new/page.tsx','app/(workspace)/counterparties/[id]/edit/page.tsx','app/(workspace)/invoices/new/page.tsx','app/(workspace)/invoices/[id]/edit/page.tsx','app/(workspace)/developer/keys/new/page.tsx','components/workspace/PaymentForm.tsx','components/workspace/CounterpartyForm.tsx','components/workspace/InvoiceForm.tsx','supabase/upgrade-v15.sql'])expect(fs.existsSync(file),`missing v1.5 surface: ${file}`)
const auth=read('components/AuthPage.tsx');const register=read('components/RegisterPage.tsx');const legal=read('lib/legal.ts');const legalSql=read('supabase/upgrade-v15.sql');const workspaceProvider=read('components/workspace/WorkspaceProvider.tsx');const payments=read('app/(workspace)/payments/page.tsx');const counterparties=read('app/(workspace)/counterparties/page.tsx');const invoices=read('app/(workspace)/invoices/page.tsx');const developer=read('app/(workspace)/developer/page.tsx')
expect(auth.includes('href="/register"'),'login page does not link to separate registration')
expect(register.includes('scrollTop+el.clientHeight>=el.scrollHeight-20'),'registration does not require reading to the end')
expect((register.includes('privacy_acknowledged:true')&&register.includes('terms_accepted:true'))||(register.includes('privacyAcknowledged:true')&&register.includes('termsAccepted:true')),'registration does not send explicit legal acknowledgement flags')
expect(legalSql.includes('public.legal_acceptances')&&legalSql.includes('accepted_at timestamptz not null'),'server-side legal acceptance ledger is missing')
expect(legalSql.includes('new.created_at')&&legalSql.includes('after insert on auth.users'),'legal acceptance time is not derived server-side at signup')
expect(legalSql.includes('revoke all on public.legal_acceptances from anon, authenticated'),'legal acceptance ledger is browser-mutable')
expect(register.includes('LEGAL_VERSIONS.privacy')&&register.includes('LEGAL_VERSIONS.terms'),'legal document versions are not persisted')
expect(legal.includes('privacyDocuments')&&legal.includes('termsDocuments'),'legal documents are not centralized/versioned')
expect(payments.includes("router.push('/payments/new')")&&payments.includes('/payments/${p.id}/edit'),'payment forms are not routed to pages')
expect(counterparties.includes("router.push('/counterparties/new')")&&counterparties.includes('/counterparties/${c.id}/edit'),'counterparty forms are not routed to pages')
expect(invoices.includes("router.push('/invoices/new')")&&invoices.includes('/invoices/${i.id}/edit'),'invoice forms are not routed to pages')
expect(developer.includes("router.push('/developer/keys/new')"),'API key creation is not routed to a page')
expect(workspaceProvider.includes('pathname.startsWith(`${section}/`)'),'workspace data loader is not nested-route aware')
for(const editPage of ['app/(workspace)/payments/[id]/edit/page.tsx','app/(workspace)/counterparties/[id]/edit/page.tsx','app/(workspace)/invoices/[id]/edit/page.tsx'])expect(read(editPage).includes('ws.loading'),`edit route has no loading guard: ${editPage}`)
for(const old of ['components/workspace/PaymentDialog.tsx','components/workspace/CounterpartyDialog.tsx','components/workspace/InvoiceDialog.tsx'])expect(!fs.existsSync(old),`legacy form modal still exists: ${old}`)
const appFiles=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else if(/\.(tsx|ts)$/.test(e.name))appFiles.push(f)}}walk('app');for(const f of appFiles){const t=read(f);if(/PaymentDialog|CounterpartyDialog|InvoiceDialog/.test(t))failures.push(`legacy form modal referenced by ${f}`)}
if(failures.length){console.error(`FlowPay v1.5 feature audit failed with ${failures.length} issue(s):`);for(const f of failures)console.error(`- ${f}`);process.exit(1)}
console.log('FlowPay v1.5 feature audit passed: legal-read registration and workspace page forms verified.')
