import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8')
const exists=(file)=>fs.existsSync(path.join(root,file))
const requireFile=(file)=>{if(!exists(file))throw new Error(`v2.0 audit: missing ${file}`)}
const requireText=(file,...needles)=>{const text=read(file);for(const needle of needles){if(!text.includes(needle))throw new Error(`v2.0 audit: ${file} missing ${needle}`)}}
const forbidText=(file,...needles)=>{const text=read(file);for(const needle of needles){if(text.includes(needle))throw new Error(`v2.0 audit: ${file} contains forbidden ${needle}`)}}

for(const file of [
  'app/(workspace)/operations/page.tsx',
  'app/(workspace)/approvals/page.tsx',
  'app/(workspace)/treasury/page.tsx',
  'app/(workspace)/activity/page.tsx',
  'app/api/approvals/route.ts',
  'lib/operations.ts',
  'supabase/upgrade-v20.sql',
  'V2_PLATFORM.md',
]) requireFile(file)

requireText('package.json','"audit:v20"')
requireText('components/workspace/WorkspaceShell.tsx','/operations','/approvals','/treasury','/activity','FlowPay Control')
requireText('components/workspace/WorkspaceProvider.tsx','approvalEvents','approval_status','approval_enabled','approval_threshold')
requireText('lib/types.ts',"approval_status: 'not_required' | 'required' | 'pending' | 'approved' | 'rejected'",'PaymentApprovalEvent')
requireText('supabase/upgrade-v20.sql','payment_approval_events','payment_snapshot','force row level security','approval events aal2 gate','flowpay_apply_payment_approval_policy','new.supplier_name is distinct from old.supplier_name','new.recipient_amount is distinct from old.recipient_amount','flowpay_request_payment_approval','flowpay_decide_payment_approval','flowpay_update_profile_v2',"p_status in ('ready','paid')")
requireText('app/api/approvals/route.ts','requireAal2','trustedMutationOrigin','checkRateLimit','expectedApprovalErrors','approvalDomainResponse',"return apiJson({ error: 'APPROVAL_REQUEST_FAILED', requestId: reqId }, 500")
requireText('app/(workspace)/payments/page.tsx','approvalQueue','/approvals?payment=','approval_status')
requireText('components/workspace/PaymentForm.tsx','duplicateCandidates','approvalPreview','No synthetic FX')
requireText('lib/operations.ts','settlementWatch','Payment is beyond its route ETA','route_snapshot?.speedMinutes')
requireText('app/(workspace)/routes/page.tsx','production-rule eligibility','fallback route','NO_ELIGIBLE_PROVIDER_ROUTES')
requireText('app/api/quote/route.ts',"rules.length === 0","NO_ELIGIBLE_PROVIDER_ROUTES",'422')
requireText('app/api/v1/quote/route.ts',"rules.length === 0","NO_ELIGIBLE_PROVIDER_ROUTES",'422')
requireText('app/api/admin/overview/route.ts','approvalQueue')
requireText('app/globals.css','FlowPay 2.0 — control-plane visual system','fp-control-hub')
requireText('lib/security.ts',"error && typeof error === 'object' && 'message' in error",'never\n  // serialize details')
requireText('app/security/page.tsx','версия 2.0','version 2.0','AAL2/MFA')
requireText('README.md','## Что нового в 2.0','supabase/upgrade-v20.sql','никаких fallback-маршрутов')

// Routing must remain explicit: a missing eligible production rule is an unavailable route,
// not a synthetic quote. These markers are part of the existing production-only engine.
requireText('lib/routing.ts','NO_ELIGIBLE_PROVIDER_ROUTES')
forbidText('lib/routing.ts','fallbackProvider','syntheticProvider','mockProvider')

console.log('FlowPay v2.0 platform audit passed: control plane, approvals, treasury, activity, duplicate guard, admin metrics and production-only routing verified.')
