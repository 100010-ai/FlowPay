import { NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticatedUser } from '@/lib/server-auth'
import { isFlowPayAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'

const country = z.string().trim().toUpperCase().refine(value => value === '*' || isSupportedCountry(value))
const currency = z.string().trim().toUpperCase().refine(isSupportedCurrency)
const base = z.object({
  provider_code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_-]+$/i),
  display_name: z.string().trim().min(2).max(120),
  from_country: country,
  to_country: country,
  currencies: z.array(currency).min(1).max(12),
  fee_percent: z.coerce.number().min(0).max(20),
  fixed_fee: z.coerce.number().min(0).max(1_000_000),
  fx_markup_percent: z.coerce.number().min(0).max(20),
  speed_minutes: z.coerce.number().int().min(1).max(60 * 24 * 30),
  min_amount: z.coerce.number().positive().max(1_000_000_000),
  max_amount: z.coerce.number().positive().max(1_000_000_000),
  priority: z.coerce.number().int().min(1).max(10),
  reliability_percent: z.coerce.number().min(0).max(100).nullable().optional(),
  intermediary_banks: z.coerce.number().int().min(0).max(20).nullable().optional(),
  source: z.string().trim().min(2).max(120),
  source_updated_at: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
}).refine(value => value.max_amount >= value.min_amount, { message: 'INVALID_AMOUNT_RANGE' })
const update = base.extend({ id: z.string().uuid() })
const remove = z.object({ id: z.string().uuid() })

async function guard(request: Request) {
  const user = await authenticatedUser(request)
  if (!user) return { error: NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 }) }
  if (!isFlowPayAdmin(user)) return { error: NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 }) }
  return { user }
}

function normalize(input: z.infer<typeof base>) {
  const currencies = Array.from(new Set(input.currencies.map(value => value.toUpperCase()))).sort()
  return {
    ...input,
    currencies,
    rule_key: `${input.provider_code}:${input.from_country}:${input.to_country}:${currencies.join('-')}:${input.min_amount}:${input.max_amount}`,
    source_updated_at: input.source_updated_at || new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  const auth = await guard(request); if ('error' in auth) return auth.error
  const parsed = base.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_RULE', details: parsed.error.flatten() }, { status: 400 })
  const admin = createAdminClient(); const payload = normalize(parsed.data)
  const { data, error } = await admin.from('provider_rules').insert(payload).select('*').single()
  if (error) return NextResponse.json({ error: error.code === '23505' ? 'RULE_EXISTS' : 'RULE_CREATE_FAILED' }, { status: 400 })
  return NextResponse.json({ rule: data })
}

export async function PATCH(request: Request) {
  const auth = await guard(request); if ('error' in auth) return auth.error
  const parsed = update.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_RULE' }, { status: 400 })
  const { id, ...input } = parsed.data; const admin = createAdminClient(); const payload = normalize(input)
  const { data, error } = await admin.from('provider_rules').update(payload).eq('id', id).select('*').single()
  if (error) return NextResponse.json({ error: 'RULE_UPDATE_FAILED' }, { status: 400 })
  return NextResponse.json({ rule: data })
}

export async function DELETE(request: Request) {
  const auth = await guard(request); if ('error' in auth) return auth.error
  const parsed = remove.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'INVALID_RULE' }, { status: 400 })
  const admin = createAdminClient(); const { error } = await admin.from('provider_rules').delete().eq('id', parsed.data.id)
  if (error) return NextResponse.json({ error: 'RULE_DELETE_FAILED' }, { status: 400 })
  return NextResponse.json({ ok: true })
}
