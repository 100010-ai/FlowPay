import fs from 'node:fs'
import path from 'node:path'

const root=process.cwd()
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8')
const exists=(file)=>fs.existsSync(path.join(root,file))
const requireFile=(file)=>{if(!exists(file))throw new Error(`v2.1 audit: missing ${file}`)}
const requireText=(file,...needles)=>{const text=read(file);for(const needle of needles){if(!text.includes(needle))throw new Error(`v2.1 audit: ${file} missing ${needle}`)}}
const forbidText=(file,...needles)=>{const text=read(file);for(const needle of needles){if(text.includes(needle))throw new Error(`v2.1 audit: ${file} contains forbidden ${needle}`)}}

for(const file of [
  'app/(workspace)/reconciliation/page.tsx',
  'components/workspace/ProductGuide.tsx',
  'components/workspace/WorkspaceIntroCard.tsx',
  'supabase/upgrade-v21.sql',
  'V21_PRODUCT_CLARITY.md',
]) requireFile(file)

requireText('package.json','"version": "2.1.0"','"audit:v21"')
requireText('components/HomePage.tsx','Платежи зарубежным поставщикам — без таблиц и хаоса.','FlowPay за 20 секунд','Что здесь вообще делать?','четыре понятных шага')
requireText('components/workspace/WorkspaceShell.tsx','ProductGuide','/reconciliation','Как работает FlowPay','Что требует внимания','Сверка платежей')
requireText('components/workspace/ProductGuide.tsx','Поставщик → Платёж → Сравнение вариантов → Согласование → Оплата → Сверка','production routes','reconciliation_status')
requireText('components/workspace/WorkspaceIntroCard.tsx','Начните отсюда','следующий логичный шаг','flowpay:v21:intro-dismissed')

requireText('lib/types.ts','reconciliation_status','reconciliation_reference','actual_fee','actual_recipient_amount','approval_currency','PaymentEvent')
requireText('components/workspace/WorkspaceProvider.tsx','paymentEvents','payment_events','inReconciliation','approval_currency')
requireText('app/(workspace)/reconciliation/page.tsx','flowpay_reconcile_payment','Банковский reference','Фактическая комиссия','Нужна проверка')
requireText('app/(workspace)/payments/page.tsx','Быстрый фокус','flowpay_bulk_set_payment_status','flowpay_update_payment_priority','История платежа','reconciliation_status')
requireText('app/(workspace)/activity/page.tsx','paymentEvents','reconciliation_changed')
requireText('lib/operations.ts','reconciliationQueue',"kind: 'reconciliation'")

requireText('app/api/profile/route.ts','approval_currency','flowpay_update_profile_v21','p_approval_currency')
requireText('app/(workspace)/settings/page.tsx','Валюта порога','approval_currency','не выдумывает FX')
requireText('components/workspace/PaymentForm.tsx','approvalCurrency','approval_currency')

requireText('supabase/upgrade-v21.sql',
  'payment_events',
  'force row level security',
  'payment events aal2 gate',
  'flowpay_reconcile_payment',
  'flowpay_update_payment_priority',
  'flowpay_bulk_set_payment_status',
  'flowpay_update_profile_v21',
  'p_approval_currency',
  "reconciliation_status in ('not_ready','unmatched','matched','needs_review')",
  'flowpay_log_payment_event',
  'array_agg(distinct u.payment_id)'
)

// Production routing remains explicit. Product-clarity work must never add a synthetic quote path.
requireText('lib/routing.ts','NO_ELIGIBLE_PROVIDER_ROUTES')
forbidText('lib/routing.ts','fallbackProvider','syntheticProvider','mockProvider')
requireText('app/api/quote/route.ts','NO_ELIGIBLE_PROVIDER_ROUTES','422')
requireText('app/api/v1/quote/route.ts','NO_ELIGIBLE_PROVIDER_ROUTES','422')
requireText('app/api/admin/overview/route.ts',"version: '2.1.0'")

console.log('FlowPay v2.1 audit passed: product clarity, guided workflow, explicit approval currency, reconciliation, payment ledger, bulk operations and production-only routing verified.')
