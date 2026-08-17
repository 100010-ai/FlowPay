import { z } from 'zod'
import { requireAal2 } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { isSupportedCurrency } from '@/lib/countries'
import { readJsonBody, RequestBodyError, trustedMutationOrigin, requestJson } from '@/lib/http'

const date=z.string().trim().refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v))
const row=z.object({
  invoice_number:z.string().trim().max(100).default(''),
  supplier_name:z.string().trim().min(1).max(180),
  issue_date:date.default(''),
  due_date:date.default(''),
  amount:z.coerce.number().positive().max(10_000_000),
  currency:z.string().trim().toUpperCase().refine(isSupportedCurrency),
  status:z.enum(['open','paid','cancelled']).default('open'),
  reference:z.string().trim().max(180).default(''),
  notes:z.string().trim().max(2_000).default(''),
})
const body=z.object({rows:z.array(row).min(1).max(500)})

export async function POST(request:Request){
  if(!trustedMutationOrigin(request))return requestJson(request,{error:'CROSS_ORIGIN_DENIED'},{status:403})
  const gate=await requireAal2(request)
  if(!gate.ok)return requestJson(request,{error:gate.code},{status:gate.code==='UNAUTHORIZED'?401:403})
  const auth=gate.auth
  const rate=await checkRateLimit(request,'import_invoices',4,300,{subject:auth.user.id})
  if(!rate.available)return requestJson(request,{error:'SERVICE_UNAVAILABLE'},{status:503})
  if(!rate.allowed)return requestJson(request,{error:'RATE_LIMITED'},{status:429})
  try{
    const parsed=body.safeParse(await readJsonBody(request,1_500_000))
    if(!parsed.success)return requestJson(request,{error:'INVALID_IMPORT'},{status:400})
    const {data,error}=await auth.client.rpc('flowpay_import_invoices',{p_rows:parsed.data.rows})
    if(error)return requestJson(request,{error:'IMPORT_FAILED'},{status:400})
    return requestJson(request,{ok:true,imported:Number(data||0)})
  }catch(error){
    if(error instanceof RequestBodyError)return requestJson(request,{error:error.code},{status:error.status})
    return requestJson(request,{error:'IMPORT_FAILED'},{status:500})
  }
}
