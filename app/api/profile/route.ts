import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticatedClient } from '@/lib/server-auth'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'

const schema=z.object({
  name:z.string().trim().min(2).max(160),
  country:z.string().trim().toUpperCase().refine(isSupportedCountry),
  preferred_currency:z.string().trim().toUpperCase().refine(isSupportedCurrency),
  registration_number:z.string().trim().max(100).default(''),
  business_address:z.string().trim().max(300).default(''),
  default_payment_method:z.enum(['bank_transfer','swift','local']).default('bank_transfer'),
  default_charge_type:z.enum(['shared','sender','recipient']).default('shared'),
  beneficiary_notifications:z.boolean().default(true),
  notify_payment_confirmations:z.boolean().default(true),
  notify_payment_failures:z.boolean().default(true),
  notify_security_alerts:z.boolean().default(true),
  notify_weekly_reports:z.boolean().default(false),
})

export async function PUT(request:Request){
  const auth=await authenticatedClient(request);if(!auth)return NextResponse.json({error:'UNAUTHORIZED'},{status:401})
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return NextResponse.json({error:'INVALID_PROFILE'},{status:400})
  const {error}=await auth.client.from('company_profiles').upsert({user_id:auth.user.id,...parsed.data},{onConflict:'user_id'})
  if(error)return NextResponse.json({error:'PROFILE_SAVE_FAILED'},{status:500})
  return NextResponse.json({ok:true})
}
