import { authenticatedUser } from '@/lib/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { logSystemEvent } from '@/lib/server-log'
import { apiJson, requestId } from '@/lib/http'
import { safeErrorMessage } from '@/lib/security'

export async function DELETE(request: Request) {
  const reqId = requestId(request)
  const user = await authenticatedUser(request)
  if (!user) return apiJson({ error: 'UNAUTHORIZED', requestId: reqId }, 401, { 'X-Request-ID': reqId })
  const rate = await checkRateLimit(request, 'account_delete', 3, 3600, { subject: user.id })
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
