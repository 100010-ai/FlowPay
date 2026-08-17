import { requireAal2 } from '@/lib/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { logSystemEvent } from '@/lib/server-log'
import { apiJson, requestId, trustedMutationOrigin } from '@/lib/http'
import { safeErrorMessage } from '@/lib/security'

export async function DELETE(request: Request) {
  const reqId = requestId(request)
  if (!trustedMutationOrigin(request)) return apiJson({ error: 'CROSS_ORIGIN_DENIED', requestId: reqId }, 403, { 'X-Request-ID': reqId })
  const gate = await requireAal2(request)
  if (!gate.ok) return apiJson({ error: gate.code, requestId: reqId }, gate.code === 'UNAUTHORIZED' ? 401 : 403, { 'X-Request-ID': reqId })
  const user = gate.auth.user
  const rate = await checkRateLimit(request, 'account_delete', 2, 3600, { subject: user.id })
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '3600', 'X-Request-ID': reqId })
  try {
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error
    return apiJson({ ok: true, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    await logSystemEvent({ level: 'error', source: 'account', code: 'ACCOUNT_DELETE_FAILED', message: safeErrorMessage(error), userId: user.id, metadata: { requestId: reqId } })
    return apiJson({ error: 'ACCOUNT_DELETE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
