import { z } from 'zod'
import { authenticatedClient } from '@/lib/server-auth'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiJson, bodyErrorResponse, readJsonBody, requestId, trustedMutationOrigin } from '@/lib/http'

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  country: z.string().trim().toUpperCase().refine(isSupportedCountry),
  currency: z.string().trim().toUpperCase().refine(isSupportedCurrency),
  timezone: z.string().trim().max(80).default(''),
})

export async function POST(request: Request) {
  const reqId = requestId(request)
  if (!trustedMutationOrigin(request)) return apiJson({ error: 'CROSS_ORIGIN_DENIED', requestId: reqId }, 403, { 'X-Request-ID': reqId })
  const auth = await authenticatedClient(request)
  if (!auth) return apiJson({ error: 'UNAUTHORIZED', requestId: reqId }, 401, { 'X-Request-ID': reqId })
  const rate = await checkRateLimit(request, 'onboarding_save', 20, 3600, { subject: auth.user.id })
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '3600', 'X-Request-ID': reqId })
  try {
    const parsed = schema.safeParse(await readJsonBody(request, 16_384))
    if (!parsed.success) return apiJson({ error: 'INVALID_PROFILE', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    const { error } = await auth.client.rpc('flowpay_complete_onboarding', {
      p_name: parsed.data.name,
      p_country: parsed.data.country,
      p_currency: parsed.data.currency,
      p_timezone: parsed.data.timezone,
    })
    if (error) return apiJson({ error: 'PROFILE_SAVE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
    return apiJson({ ok: true, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    return apiJson({ error: 'PROFILE_SAVE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
