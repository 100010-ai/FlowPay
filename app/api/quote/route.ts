import { logSystemEvent } from '@/lib/server-log'
import { checkRateLimit } from '@/lib/rate-limit'
import { authenticatedClient } from '@/lib/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildRoutes, estimatedSaving } from '@/lib/routing'
import { getReferenceFx } from '@/lib/fx'
import { quoteSchema } from '@/lib/validation'
import { getEligibleProviderRules } from '@/lib/provider-rules'
import { apiJson, bodyErrorResponse, readJsonBody, requestId } from '@/lib/http'
import { safeErrorMessage } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const reqId = requestId(request)
  const networkRate = await checkRateLimit(request, 'public_quote_network', 40, 60)
  if (!networkRate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!networkRate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '60', 'X-Request-ID': reqId })

  try {
    const auth = await authenticatedClient(request)
    if (auth) {
      const userRate = await checkRateLimit(request, 'public_quote_user', 120, 60, { subject: auth.user.id })
      if (!userRate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
      if (!userRate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '60', 'X-Request-ID': reqId })
    }

    const parsed = quoteSchema.safeParse(await readJsonBody(request, 16_384))
    if (!parsed.success) {
      const code = parsed.error.issues.some(issue => issue.message === 'SAME_COUNTRY') ? 'SAME_COUNTRY' : 'INVALID_PARAMETERS'
      return apiJson({ error: code, requestId: reqId }, 400, { 'X-Request-ID': reqId })
    }

    const { fromCountry, toCountry, amount, sourceCurrency, recipientCurrency } = parsed.data
    const rules = await getEligibleProviderRules({ fromCountry, toCountry, amount, sourceCurrency, recipientCurrency })
    const referenceFx = await getReferenceFx(sourceCurrency, recipientCurrency)
    const recipientRate = referenceFx.rate
    const routes = buildRoutes(rules, amount, fromCountry, toCountry, recipientRate)
    const quoteId = crypto.randomUUID()
    const saving = estimatedSaving(routes)

    if (auth?.assuranceLevel === 'aal2' && routes[0]) {
      const best = routes[0]
      const { error: persistError } = await createAdminClient().from('calculations').insert({
        user_id: auth.user.id,
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
      if (persistError) throw persistError
    }

    return apiJson({
      quoteId,
      routes,
      generatedAt: new Date().toISOString(),
      estimatedSaving: saving,
      disclaimer: 'ESTIMATE_ONLY',
      referenceFx,
      sourceCurrency,
      recipientCurrency,
      requestId: reqId,
    }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    await logSystemEvent({ level: 'error', source: 'quote', code: 'QUOTE_FAILED', message: safeErrorMessage(error), metadata: { requestId: reqId } })
    return apiJson({ error: 'QUOTE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
