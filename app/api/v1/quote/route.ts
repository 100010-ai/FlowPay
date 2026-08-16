import { NextResponse } from 'next/server'
import { logSystemEvent } from '@/lib/server-log'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildRoutes, estimatedSaving } from '@/lib/routing'
import { getReferenceFx } from '@/lib/fx'
import { quoteSchema } from '@/lib/validation'

export const dynamic = 'force-dynamic'

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function POST(request: Request) {
  const rate = await checkRateLimit(request, 'api_quote', 120, 60)
  if (!rate.available) return NextResponse.json({ error: 'SERVICE_UNAVAILABLE' }, { status: 503 })
  if (!rate.allowed) return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '60' } })
  const started = Date.now()
  let userId: string | null = null
  let admin: ReturnType<typeof createAdminClient> | null = null

  const respond = async (body: unknown, status = 200) => {
    if (admin && userId) {
      try {
        await admin.from('api_request_logs').insert({
          user_id: userId,
          endpoint: '/api/v1/quote',
          status_code: status,
          duration_ms: Date.now() - started,
        })
      } catch {
        // Logging must never make the quote endpoint fail.
      }
    }
    return NextResponse.json(body, { status })
  }

  try {
    const authorization = request.headers.get('authorization') || ''
    const raw = authorization.startsWith('Bearer ')
      ? authorization.slice(7).trim()
      : ''

    if (!raw.startsWith('fp_live_')) {
      return NextResponse.json({ error: 'INVALID_API_KEY' }, { status: 401 })
    }

    admin = createAdminClient()
    const keyHash = await sha256(raw)
    const { data: key, error: keyError } = await admin
      .from('api_keys')
      .select('id,user_id,revoked_at')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (keyError) throw keyError
    if (!key || key.revoked_at) {
      return NextResponse.json({ error: 'INVALID_API_KEY' }, { status: 401 })
    }

    userId = key.user_id
    await admin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', key.id)

    const parsed = quoteSchema.safeParse(await request.json())
    if (!parsed.success) {
      const code = parsed.error.issues.some((issue) => issue.message === 'SAME_COUNTRY')
        ? 'SAME_COUNTRY'
        : 'INVALID_PARAMETERS'
      return respond({ error: code }, 400)
    }
    const { fromCountry, toCountry, amount, sourceCurrency, recipientCurrency } = parsed.data

    const { data, error } = await admin
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

    const referenceFx = sourceCurrency === recipientCurrency ? null : await getReferenceFx(sourceCurrency, recipientCurrency).catch(() => null)
    const recipientRate = sourceCurrency === recipientCurrency ? 1 : referenceFx?.rate ?? null
    const routes = buildRoutes(data || [], amount, fromCountry, toCountry, recipientRate)

    return respond(
      {
        quoteId: crypto.randomUUID(),
        routes,
        generatedAt: new Date().toISOString(),
        estimatedSaving: estimatedSaving(routes),
        disclaimer: 'ESTIMATE_ONLY',
        referenceFx,
        sourceCurrency,
        recipientCurrency,
      },
      200,
    )
  } catch (error) {
    console.error('v1 quote error', error)
    await logSystemEvent({ level:'error', source:'api_v1_quote', code:'QUOTE_FAILED', message:error instanceof Error?error.message:String(error), userId })
    if (admin && userId) return respond({ error: 'QUOTE_FAILED' }, 500)
    return NextResponse.json({ error: 'QUOTE_FAILED' }, { status: 500 })
  }
}
