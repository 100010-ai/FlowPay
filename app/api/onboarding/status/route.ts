import { authenticatedClient } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiJson, requestId } from '@/lib/http'
import { resolveOnboardingState } from '@/lib/onboarding-state'

export async function GET(request: Request) {
  const reqId = requestId(request)
  const auth = await authenticatedClient(request)
  if (!auth) return apiJson({ error: 'UNAUTHORIZED', requestId: reqId }, 401, { 'X-Request-ID': reqId })

  const rate = await checkRateLimit(request, 'onboarding_status', 120, 3600, { subject: auth.user.id })
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '3600', 'X-Request-ID': reqId })

  try {
    const state = await resolveOnboardingState(auth.user.id, auth.client)
    return apiJson({ ...state, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch {
    return apiJson({ error: 'PROFILE_STATUS_FAILED', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  }
}
