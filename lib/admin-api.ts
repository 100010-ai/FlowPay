import { isFlowPayAdmin } from '@/lib/admin-auth'
import { apiJson, requestId } from '@/lib/http'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireAal2 } from '@/lib/server-auth'

export async function requireFlowPayAdmin(request: Request, bucket: string, limit = 120) {
  const reqId = requestId(request)
  const gate = await requireAal2(request)
  if (!gate.ok) {
    return {
      ok: false as const,
      response: apiJson(
        { error: gate.code, requestId: reqId },
        gate.code === 'UNAUTHORIZED' ? 401 : 403,
        { 'X-Request-ID': reqId },
      ),
    }
  }

  const user = gate.auth.user
  if (!isFlowPayAdmin(user)) {
    return {
      ok: false as const,
      response: apiJson({ error: 'FORBIDDEN', requestId: reqId }, 403, { 'X-Request-ID': reqId }),
    }
  }

  const rate = await checkRateLimit(request, bucket, limit, 60, { subject: user.id })
  if (!rate.available) {
    return {
      ok: false as const,
      response: apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId }),
    }
  }
  if (!rate.allowed) {
    return {
      ok: false as const,
      response: apiJson(
        { error: 'RATE_LIMITED', requestId: reqId },
        429,
        { 'Retry-After': '60', 'X-Request-ID': reqId },
      ),
    }
  }

  return { ok: true as const, user, reqId }
}
