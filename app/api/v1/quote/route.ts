import { logSystemEvent } from '@/lib/server-log'
import { checkRateLimit } from '@/lib/rate-limit'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildRoutes, estimatedSaving } from '@/lib/routing'
import { getReferenceFx } from '@/lib/fx'
import { quoteSchema } from '@/lib/validation'
import { getEligibleProviderRules } from '@/lib/provider-rules'
import { apiJson, bodyErrorResponse, readJsonBody, requestId } from '@/lib/http'
import { recordApiUsage } from '@/lib/api-usage'
import { safeErrorMessage } from '@/lib/security'

export const dynamic = 'force-dynamic'

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function POST(request: Request) {
  const reqId = requestId(request)
  const started = Date.now()
  let userId: string | null = null
  let admin: ReturnType<typeof createAdminClient> | null = null

  const networkRate = await checkRateLimit(request, 'api_quote_network', 300, 60)
  if (!networkRate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!networkRate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '60', 'X-Request-ID': reqId })

  const respond = async (body: unknown, status = 200) => {
    if (admin && userId) {
      await recordApiUsage({ admin, userId, endpoint: '/api/v1/quote', statusCode: status, durationMs: Date.now() - started, requestId: reqId })
    }
    return apiJson(body, status, { 'X-Request-ID': reqId })
  }

  try {
    const authorization = request.headers.get('authorization') || ''
    const raw = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
    if (!raw.startsWith('fp_live_') || raw.length < 48 || raw.length > 96) return apiJson({ error: 'INVALID_API_KEY', requestId: reqId }, 401, { 'X-Request-ID': reqId })

    admin = createAdminClient()
    const keyHash = await sha256(raw)
    const { data: key, error: keyError } = await admin
      .from('api_keys')
      .select('id,user_id,scope,expires_at,revoked_at,last_used_at')
      .eq('key_hash', keyHash)
      .maybeSingle()

    if (keyError) throw keyError
    if (!key || key.revoked_at || key.scope !== 'quote:read' || new Date(key.expires_at).getTime() <= Date.now()) return apiJson({ error: 'INVALID_API_KEY', requestId: reqId }, 401, { 'X-Request-ID': reqId })

    userId = key.user_id
    const keyRate = await checkRateLimit(request, 'api_quote_key', 120, 60, { subject: key.id })
    if (!keyRate.available) return respond({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503)
    if (!keyRate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '60', 'X-Request-ID': reqId })

    const now = Date.now()
    const lastUsed = key.last_used_at ? new Date(key.last_used_at).getTime() : 0
    if (!lastUsed || now - lastUsed > 5 * 60_000) {
      const { error: touchError } = await admin.from('api_keys').update({ last_used_at: new Date(now).toISOString() }).eq('id', key.id)
      if (touchError) throw touchError
    }

    const parsed = quoteSchema.safeParse(await readJsonBody(request, 16_384))
    if (!parsed.success) {
      const code = parsed.error.issues.some(issue => issue.message === 'SAME_COUNTRY') ? 'SAME_COUNTRY' : 'INVALID_PARAMETERS'
      return respond({ error: code, requestId: reqId }, 400)
    }

    const { fromCountry, toCountry, amount, sourceCurrency, recipientCurrency } = parsed.data
    const rules = await getEligibleProviderRules({ fromCountry, toCountry, amount, sourceCurrency, recipientCurrency })
    if (rules.length === 0) return respond({ error: 'NO_ELIGIBLE_PROVIDER_ROUTES', requestId: reqId }, 422)
    const referenceFx = await getReferenceFx(sourceCurrency, recipientCurrency)
    const recipientRate = referenceFx.rate
    const routes = buildRoutes(rules, amount, fromCountry, toCountry, recipientRate)

    return respond({
      quoteId: crypto.randomUUID(),
      routes,
      generatedAt: new Date().toISOString(),
      estimatedSaving: estimatedSaving(routes),
      disclaimer: 'ESTIMATE_ONLY',
      referenceFx,
      sourceCurrency,
      recipientCurrency,
      requestId: reqId,
    })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    if (safeErrorMessage(error) === 'NO_ELIGIBLE_PROVIDER_ROUTES') return admin && userId ? respond({ error: 'NO_ELIGIBLE_PROVIDER_ROUTES', requestId: reqId }, 422) : apiJson({ error: 'NO_ELIGIBLE_PROVIDER_ROUTES', requestId: reqId }, 422, { 'X-Request-ID': reqId })
    await logSystemEvent({ level: 'error', source: 'api_v1_quote', code: 'QUOTE_FAILED', message: safeErrorMessage(error), userId, metadata: { requestId: reqId } })
    if (admin && userId) return respond({ error: 'QUOTE_FAILED', requestId: reqId }, 500)
    return apiJson({ error: 'QUOTE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
