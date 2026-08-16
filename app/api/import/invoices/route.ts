import { z } from 'zod'
import { authenticatedUser } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupportedCurrency } from '@/lib/countries'
import { noStoreJson, readJsonBody, RequestBodyError, trustedMutationOrigin } from '@/lib/http'

const date=z.string().trim().refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v))
const row=z.object({
  invoice_number:z.string().trim().max(100).default(''),
  supplier_name:z.string().trim().min(1).max(180),
  issue_date:date.default(''),
  due_date:date.default(''),
  amount:z.coerce.number().positive().max(10_000_000),
  currency:z.string().trim().toUpperCase().refine(isSupportedCurrency),
  status:z.enum(['open','scheduled','paid','cancelled']).default('open'),
  reference:z.string().trim().max(180).default(''),
  notes:z.string().trim().max(2_000).default(''),
})
const body=z.object({rows:z.array(row).min(1).max(500)})

export async function POST(request:Request){
  if(!trustedMutationOrigin(request))return noStoreJson({error:'CROSS_ORIGIN_DENIED'},{status:403})
  const user=await authenticatedUser(request)
  if(!user)return noStoreJson({error:'UNAUTHORIZED'},{status:401})
  const rate=await checkRateLimit(request,'import_invoices',4,300,user.id)
  if(!rate.available)return noStoreJson({error:'SERVICE_UNAVAILABLE'},{status:503})
  if(!rate.allowed)return noStoreJson({error:'RATE_LIMITED'},{status:429,headers:{'Retry-After':String(rate.retryAfter)}})
  try{
    const parsed=body.safeParse(await readJsonBody(request,1_500_000))
    if(!parsed.success)return noStoreJson({error:'INVALID_IMPORT'},{status:400})
    const rows=parsed.data.rows.map(item=>({
      user_id:user.id,counterparty_id:null,invoice_number:item.invoice_number,supplier_name:item.supplier_name,
      issue_date:item.issue_date||null,due_date:item.due_date||null,amount:item.amount,currency:item.currency,
      status:item.status,reference:item.reference,notes:item.notes,payment_draft_id:null,
    }))
    const admin=createAdminClient();const {error}=await admin.from('invoices').insert(rows)
    if(error)return noStoreJson({error:'IMPORT_FAILED'},{status:400})
    return noStoreJson({ok:true,imported:rows.length})
  }catch(error){
    if(error instanceof RequestBodyError)return noStoreJson({error:error.code},{status:error.status})
    return noStoreJson({error:'IMPORT_FAILED'},{status:500})
  }
}
