import { NextResponse } from 'next/server'
import { logSystemEvent } from '@/lib/server-log'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildRoutes } from '@/lib/routing'
import { auditSchema } from '@/lib/validation'
import { getReferenceFx } from '@/lib/fx'

export const dynamic = 'force-dynamic'

function getBearer(request: Request) {
  const header = request.headers.get('authorization') || ''
  return header.startsWith('Bearer ') ? header.slice(7) : undefined
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, 'public_audit', 10, 300)
  if (!rate.available) return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 })
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '300' } })
  try {
    const parsed = auditSchema.safeParse(await request.json())
    if (!parsed.success) {
      const issue = parsed.error.issues.find((item) =>
        ['SAME_COUNTRY', 'FEE_EXCEEDS_AMOUNT'].includes(item.message),
      )
      return NextResponse.json({ error: issue?.message || 'INVALID_PARAMETERS' }, { status: 400 })
    }

    const { email, fromCountry, toCountry, sourceCurrency, recipientCurrency, amount, actualFee, website } = parsed.data
    if (website) return NextResponse.json({ ok: true })

    const accessToken = getBearer(request)
    const admin = createAdminClient()
    let userId: string | null = null
    if (accessToken) {
      const authClient = createServerClient(accessToken)
      const { data: auth } = await authClient.auth.getUser(accessToken)
      userId = auth.user?.id ?? null
    }

    const { data: rules, error: rulesError } = await admin
      .from('provider_rules')
      .select(
        'id,provider_code,display_name,from_country,to_country,fee_percent,fixed_fee,fx_markup_percent,speed_minutes,priority,reliability_percent,intermediary_banks,route_steps,source,source_updated_at',
      )
      .eq('active', true)
      .in('from_country', [fromCountry, '*'])
      .in('to_country', [toCountry, '*'])
      .contains('currencies', Array.from(new Set([sourceCurrency, recipientCurrency])))
      .lte('min_amount', amount)
      .gte('max_amount', amount)

    if (rulesError) throw rulesError

    const referenceFx = sourceCurrency === recipientCurrency ? null : await getReferenceFx(sourceCurrency, recipientCurrency).catch(() => null)
    const routes = buildRoutes(rules ?? [], amount, fromCountry, toCountry, sourceCurrency === recipientCurrency ? 1 : referenceFx?.rate ?? null)
    const best = routes[0] ?? null
    const potentialSaving = best
      ? Math.max(0, Math.round((actualFee - best.fee) * 100) / 100)
      : 0

    const { error } = await admin.from('audit_requests').insert({
      user_id: userId,
      email,
      from_country: fromCountry,
      to_country: toCountry,
      amount,
      currency: sourceCurrency,
      recipient_currency: recipientCurrency,
      actual_fee: actualFee,
      status: 'analyzed',
      best_provider_code: best?.providerCode ?? null,
      estimated_best_fee: best?.fee ?? null,
      potential_saving: potentialSaving,
      estimated_result: routes,
      auto_analyzed_at: new Date().toISOString(),
    })

    if (error) throw error

    return NextResponse.json({
      ok: true,
      result: {
        bestProviderCode: best?.providerCode ?? null,
        estimatedBestFee: best?.fee ?? null,
        potentialSaving,
        routes,
      },
    })
  } catch (error) {
    console.error('audit error', error)
    await logSystemEvent({ level:'error', source:'audit', code:'AUDIT_FAILED', message:error instanceof Error?error.message:String(error) })
    return NextResponse.json({ error: 'AUDIT_FAILED' }, { status: 500 })
  }
}
