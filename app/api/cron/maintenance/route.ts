import { timingSafeEqual } from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiJson, requestId } from '@/lib/http'
import { logSystemEvent } from '@/lib/server-log'
import { safeErrorMessage } from '@/lib/security'

export const dynamic = 'force-dynamic'

function authorized(request: Request) {
  const expected = process.env.CRON_SECRET || ''
  const received = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  if (!expected || !received) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(received)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  const reqId = requestId(request)
  if (!authorized(request)) return apiJson({ error: 'UNAUTHORIZED', requestId: reqId }, 401, { 'X-Request-ID': reqId })
  try {
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('flowpay_prune_operational_data')
    if (error) throw error
    return apiJson({ ok: true, pruned: Array.isArray(data) ? data[0] ?? null : data ?? null, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    await logSystemEvent({ level: 'error', source: 'maintenance', code: 'MAINTENANCE_FAILED', message: safeErrorMessage(error), metadata: { requestId: reqId } })
    return apiJson({ error: 'MAINTENANCE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
