import { logSystemEvent } from '@/lib/server-log'
import { checkRateLimit } from '@/lib/rate-limit'
import { authenticatedClient } from '@/lib/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildRoutes } from '@/lib/routing'
import { auditSchema } from '@/lib/validation'
import { getReferenceFx } from '@/lib/fx'
import { getEligibleProviderRules } from '@/lib/provider-rules'
import { apiJson, bodyErrorResponse, readJsonBody, requestId } from '@/lib/http'
import { safeErrorMessage } from '@/lib/security'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const reqId = requestId(request)
  const rate = await checkRateLimit(request, 'public_audit_network', 10, 300)
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '300', 'X-Request-ID': reqId })

  try {
    const parsed = auditSchema.safeParse(await readJsonBody(request, 24_576))
    if (!parsed.success) {
      const issue = parsed.error.issues.find(item => ['SAME_COUNTRY', 'FEE_EXCEEDS_AMOUNT'].includes(item.message))
      return apiJson({ error: issue?.message || 'INVALID_PARAMETERS', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    }

    const { email, fromCountry, toCountry, sourceCurrency, recipientCurrency, amount, actualFee, website } = parsed.data
    if (website) return apiJson({ ok: true, requestId: reqId }, 200, { 'X-Request-ID': reqId })

    const auth = await authenticatedClient(request)
    if (auth) {
      const userRate = await checkRateLimit(request, 'public_audit_user', 30, 300, { subject: auth.user.id })
      if (!userRate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
      if (!userRate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '300', 'X-Request-ID': reqId })
    }

    const admin = createAdminClient()
    const rules = await getEligibleProviderRules({ fromCountry, toCountry, amount, sourceCurrency, recipientCurrency })
    const referenceFx = await getReferenceFx(sourceCurrency, recipientCurrency)
    const routes = buildRoutes(rules, amount, fromCountry, toCountry, referenceFx.rate)
    const best = routes[0]
    if (!best) throw new Error('NO_ELIGIBLE_PROVIDER_ROUTES')
    const potentialSaving = Math.max(0, Math.round((actualFee - best.fee) * 100) / 100)

    const { error } = await admin.from('audit_requests').insert({
      user_id: auth?.user.id ?? null,
      email,
      from_country: fromCountry,
      to_country: toCountry,
      amount,
      currency: sourceCurrency,
      recipient_currency: recipientCurrency,
      actual_fee: actualFee,
      status: 'analyzed',
      best_provider_code: best.providerCode,
      estimated_best_fee: best.fee,
      potential_saving: potentialSaving,
      estimated_result: routes,
      auto_analyzed_at: new Date().toISOString(),
    })
    if (error) throw error

    return apiJson({
      ok: true,
      requestId: reqId,
      result: { bestProviderCode: best.providerCode, estimatedBestFee: best.fee, potentialSaving, routes },
    }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    await logSystemEvent({ level: 'error', source: 'audit', code: 'AUDIT_FAILED', message: safeErrorMessage(error), metadata: { requestId: reqId } })
    return apiJson({ error: 'AUDIT_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
