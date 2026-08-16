import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticatedClient } from '@/lib/server-auth'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  country: z.string().trim().toUpperCase().refine(isSupportedCountry),
  currency: z.string().trim().toUpperCase().refine(isSupportedCurrency),
  timezone: z.string().trim().max(80).default(''),
})

export async function POST(request: Request) {
  const auth = await authenticatedClient(request)
  if (!auth) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  const parsed = schema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_PROFILE' }, { status: 400 })
  const { error } = await auth.client.rpc('flowpay_complete_onboarding', {
    p_name: parsed.data.name,
    p_country: parsed.data.country,
    p_currency: parsed.data.currency,
    p_timezone: parsed.data.timezone,
  })
  if (error) return NextResponse.json({ error: 'PROFILE_SAVE_FAILED' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
