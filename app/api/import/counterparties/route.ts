import { z } from 'zod'
import { authenticatedUser } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'
import { noStoreJson, readJsonBody, RequestBodyError, trustedMutationOrigin } from '@/lib/http'

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
  if(!trustedMutationOrigin(request))return noStoreJson({error:'CROSS_ORIGIN_DENIED'},{status:403})
  const user=await authenticatedUser(request)
  if(!user)return noStoreJson({error:'UNAUTHORIZED'},{status:401})
  const rate=await checkRateLimit(request,'import_counterparties',4,300,user.id)
  if(!rate.available)return noStoreJson({error:'SERVICE_UNAVAILABLE'},{status:503})
  if(!rate.allowed)return noStoreJson({error:'RATE_LIMITED'},{status:429,headers:{'Retry-After':String(rate.retryAfter)}})
  try{
    const parsed=body.safeParse(await readJsonBody(request,1_500_000))
    if(!parsed.success)return noStoreJson({error:'INVALID_IMPORT'},{status:400})
    const rows=parsed.data.rows.map(item=>({
      user_id:user.id,name:item.name,country:item.country,currency:item.currency,bank_country:item.bank_country,
      account_number:item.account_number,bic:item.bic,email:item.email,bank_name:item.bank_name,
      account_holder:item.account_holder||item.name,tax_id:item.tax_id,verification_status:'unverified',total_sent:0,
    }))
    const admin=createAdminClient();const {error}=await admin.from('counterparties').insert(rows)
    if(error)return noStoreJson({error:'IMPORT_FAILED'},{status:400})
    return noStoreJson({ok:true,imported:rows.length})
  }catch(error){
    if(error instanceof RequestBodyError)return noStoreJson({error:error.code},{status:error.status})
    return noStoreJson({error:'IMPORT_FAILED'},{status:500})
  }
}
