import { z } from 'zod'
import { requireAal2 } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'
import { readJsonBody, RequestBodyError, trustedMutationOrigin, requestJson } from '@/lib/http'

const country=z.string().trim().toUpperCase().refine(isSupportedCountry)
const currency=z.string().trim().toUpperCase().refine(isSupportedCurrency)
const row=z.object({
  name:z.string().trim().min(1).max(180),
  country,
  currency,
  bank_country:country,
  account_number:z.string().trim().max(80).default(''),
  bic:z.string().trim().toUpperCase().max(20).default(''),
  email:z.string().trim().toLowerCase().max(254).refine(v=>!v||z.string().email().safeParse(v).success).default(''),
  bank_name:z.string().trim().max(180).default(''),
  account_holder:z.string().trim().max(180).default(''),
  tax_id:z.string().trim().max(100).default(''),
})
const body=z.object({rows:z.array(row).min(1).max(500)})

export async function POST(request:Request){
  if(!trustedMutationOrigin(request))return requestJson(request,{error:'CROSS_ORIGIN_DENIED'},{status:403})
  const gate=await requireAal2(request)
  if(!gate.ok)return requestJson(request,{error:gate.code},{status:gate.code==='UNAUTHORIZED'?401:403})
  const auth=gate.auth
  const rate=await checkRateLimit(request,'import_counterparties',4,300,{subject:auth.user.id})
  if(!rate.available)return requestJson(request,{error:'SERVICE_UNAVAILABLE'},{status:503})
  if(!rate.allowed)return requestJson(request,{error:'RATE_LIMITED'},{status:429})
  try{
    const parsed=body.safeParse(await readJsonBody(request,1_500_000))
    if(!parsed.success)return requestJson(request,{error:'INVALID_IMPORT'},{status:400})
    const {data,error}=await auth.client.rpc('flowpay_import_counterparties',{p_rows:parsed.data.rows})
    if(error)return requestJson(request,{error:'IMPORT_FAILED'},{status:400})
    return requestJson(request,{ok:true,imported:Number(data||0)})
  }catch(error){
    if(error instanceof RequestBodyError)return requestJson(request,{error:error.code},{status:error.status})
    return requestJson(request,{error:'IMPORT_FAILED'},{status:500})
  }
}
