import { z } from 'zod'
import { authenticatedClient } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { trustedMutationOrigin, readJsonBody, RequestBodyError, requestJson } from '@/lib/http'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEligibleProviderRules } from '@/lib/provider-rules'
import { getReferenceFx } from '@/lib/fx'
import { buildRoutes } from '@/lib/routing'
import type { QuoteRoute } from '@/lib/types'
import { logSystemEvent } from '@/lib/server-log'

const nullableUuid=z.string().uuid().nullable().optional()
const nullableDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional()
const nullableCountry=z.string().trim().toUpperCase().refine(isSupportedCountry).nullable().optional()
const nullableCurrency=z.string().trim().toUpperCase().refine(isSupportedCurrency).nullable().optional()
const schema=z.object({
  paymentId:nullableUuid,
  idempotencyKey:z.string().uuid(),
  invoiceId:nullableUuid,
  counterpartyId:nullableUuid,
  supplierName:z.string().trim().min(1).max(180),
  invoiceNumber:z.string().trim().max(100).default(''),
  amount:z.coerce.number().finite().positive().max(10_000_000),
  currency:z.string().trim().toUpperCase().refine(isSupportedCurrency),
  dueDate:nullableDate,
  notes:z.string().trim().max(2_000).default(''),
  fromCountry:nullableCountry,
  toCountry:nullableCountry,
  recipientCurrency:nullableCurrency,
  reference:z.string().trim().max(200).default(''),
  selectedRouteId:nullableUuid,
  paymentMethod:z.enum(['bank_transfer','swift','local']),
  chargeType:z.enum(['shared','sender','recipient']),
}).superRefine((value,ctx)=>{
  if(value.selectedRouteId&&(!value.fromCountry||!value.toCountry||!value.recipientCurrency))ctx.addIssue({code:'custom',message:'ROUTE_FIELDS_REQUIRED'})
  if(value.fromCountry&&value.toCountry&&value.fromCountry===value.toCountry)ctx.addIssue({code:'custom',message:'SAME_COUNTRY'})
})

type ExistingRouteRow={
  amount:number|string;currency:string;route_from_country:string|null;route_to_country:string|null;
  recipient_currency:string|null;route_snapshot:QuoteRoute|null
}

function sameHistoricalQuote(row:ExistingRouteRow,input:z.infer<typeof schema>,routeId:string){
  const route=row.route_snapshot
  return Boolean(route&&route.id===routeId&&Number(row.amount)===input.amount&&row.currency===input.currency&&row.route_from_country===input.fromCountry&&row.route_to_country===input.toCountry&&row.recipient_currency===input.recipientCurrency)
}

export async function POST(request:Request){
  if(!trustedMutationOrigin(request))return requestJson(request, {error:'CROSS_ORIGIN_DENIED'},{status:403})
  const auth=await authenticatedClient(request);if(!auth)return requestJson(request, {error:'UNAUTHORIZED'},{status:401})
  const rate=await checkRateLimit(request,'payment_write',40,60,{ subject: auth.user.id })
  if(!rate.available)return requestJson(request, {error:'SERVICE_UNAVAILABLE'},{status:503})
  if(!rate.allowed)return requestJson(request, {error:'RATE_LIMITED'},{status:429})
  try{
    const parsed=schema.safeParse(await readJsonBody(request,32_768))
    if(!parsed.success)return requestJson(request, {error:parsed.error.issues[0]?.message||'INVALID_PAYMENT'},{status:400})
    const input=parsed.data;const admin=createAdminClient();let selected:QuoteRoute|null=null

    if(input.selectedRouteId){
      if(input.paymentId){
        const {data:existing}=await admin.from('payment_drafts').select('amount,currency,route_from_country,route_to_country,recipient_currency,route_snapshot').eq('id',input.paymentId).eq('user_id',auth.user.id).maybeSingle()
        if(existing&&sameHistoricalQuote(existing as ExistingRouteRow,input,input.selectedRouteId))selected=(existing as ExistingRouteRow).route_snapshot
      }
      if(!selected){
        const rules=await getEligibleProviderRules({ fromCountry: input.fromCountry!, toCountry: input.toCountry!, sourceCurrency: input.currency, recipientCurrency: input.recipientCurrency!, amount: input.amount })
        const fx=input.currency===input.recipientCurrency?null:await getReferenceFx(input.currency,input.recipientCurrency!)
        const routes=buildRoutes(rules, input.amount, input.fromCountry!, input.toCountry!, input.currency===input.recipientCurrency?1:fx!.rate)
        selected=routes.find(route=>route.id===input.selectedRouteId)||null
        if(!selected)return requestJson(request, {error:'ROUTE_NOT_AVAILABLE'},{status:409})
      }
    }

    const {data:paymentId,error}=await auth.client.rpc('flowpay_upsert_payment',{
      p_payment_id:input.paymentId||null,p_idempotency_key:input.idempotencyKey,p_counterparty_id:input.counterpartyId||null,
      p_supplier_name:input.supplierName,p_invoice_number:input.invoiceNumber,p_amount:input.amount,p_currency:input.currency,p_due_date:input.dueDate||null,
      p_route_provider_code:selected?.providerCode||null,p_estimated_fee:selected?.fee??null,p_notes:input.notes,
      p_route_from_country:input.fromCountry||null,p_route_to_country:input.toCountry||null,p_recipient_currency:input.recipientCurrency||null,
      p_recipient_amount:selected?.recipientGets??null,p_reference:input.reference,p_route_snapshot:selected,
      p_payment_method:input.paymentMethod,p_charge_type:input.chargeType,
    })
    if(error)throw error
    if(input.invoiceId&&paymentId){const {error:linkError}=await auth.client.rpc('flowpay_link_invoice_payment',{p_invoice_id:input.invoiceId,p_payment_id:paymentId});if(linkError)throw linkError}
    return requestJson(request, {ok:true,paymentId})
  }catch(error){
    if(error instanceof RequestBodyError)return requestJson(request, {error:error.code},{status:error.status})
    await logSystemEvent({level:'error',source:'payments',code:'PAYMENT_SAVE_FAILED',message:error instanceof Error?error.message:String(error),userId:auth.user.id})
    return requestJson(request, {error:'PAYMENT_SAVE_FAILED'},{status:500})
  }
}
