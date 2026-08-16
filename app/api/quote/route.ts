import { NextResponse } from 'next/server'
import { logSystemEvent } from '@/lib/server-log'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { buildRoutes, estimatedSaving } from '@/lib/routing'
import { getReferenceFx } from '@/lib/fx'
import { quoteSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, 'public_quote', 30, 60)
  if (!rate.available) return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 })
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '60' } })
  try {
    const parsed = quoteSchema.safeParse(await request.json())
    if (!parsed.success) {
      const code = parsed.error.issues.some((issue) => issue.message === 'SAME_COUNTRY')
        ? 'SAME_COUNTRY'
        : 'INVALID_PARAMETERS'
      return NextResponse.json({ error: code }, { status: 400 })
    }

    const { fromCountry, toCountry, amount, sourceCurrency, recipientCurrency } = parsed.data
    const supabase = createAdminClient()
    const { data, error } = await supabase
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

    if (error) throw error

    const referenceFx = sourceCurrency === recipientCurrency
      ? null
      : await getReferenceFx(sourceCurrency, recipientCurrency).catch(() => null)
    const recipientRate = sourceCurrency === recipientCurrency ? 1 : referenceFx?.rate ?? null
    const routes = buildRoutes(data ?? [], amount, fromCountry, toCountry, recipientRate)
    const quoteId = crypto.randomUUID()
    const saving = estimatedSaving(routes)

    // Signed-in route checks are persisted server-side so analytics cannot be
    // populated with client-modified fees, savings or route snapshots.
    const authorization = request.headers.get('authorization')
    if (authorization?.startsWith('Bearer ') && routes[0]) {
      const token = authorization.slice(7).trim()
      if (token) {
        const userClient = createServerClient(token)
        const { data: userData } = await userClient.auth.getUser(token)
        const user = userData.user
        if (user) {
          const best = routes[0]
          const { error: persistError } = await userClient.from('calculations').insert({
            user_id: user.id,
            quote_id: quoteId,
            from_country: fromCountry,
            to_country: toCountry,
            amount,
            currency: sourceCurrency,
            recipient_currency: recipientCurrency,
            best_provider_code: best.providerCode,
            best_fee: best.fee,
            best_total_cost: best.totalCost,
            best_speed_minutes: best.speedMinutes,
            estimated_saving: saving,
            routes_snapshot: routes,
          })
          if (persistError) console.error('quote history persistence error', persistError)
        }
      }
    }

    return NextResponse.json({
      quoteId,
      routes,
      generatedAt: new Date().toISOString(),
      estimatedSaving: saving,
      disclaimer: 'ESTIMATE_ONLY',
      referenceFx,
      sourceCurrency,
      recipientCurrency,
    })
  } catch (error) {
    console.error('quote error', error)
    await logSystemEvent({ level:'error', source:'quote', code:'QUOTE_FAILED', message:error instanceof Error?error.message:String(error) })
    return NextResponse.json({ error: 'QUOTE_FAILED' }, { status: 500 })
  }
}
