import { z } from 'zod'
import { logSystemEvent } from '@/lib/server-log'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAal2 } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiJson, bodyErrorResponse, readJsonBody, requestId, trustedMutationOrigin } from '@/lib/http'
import { safeErrorMessage } from '@/lib/security'

const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ttlDays: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(90),
})
const revokeSchema = z.object({ id: z.string().uuid() })

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value)
  const hash = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(hash)).map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function newSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  const body = Array.from(bytes).map(byte => byte.toString(16).padStart(2, '0')).join('')
  return `fp_live_${body}`
}

function authFailure(reqId: string, code: 'UNAUTHORIZED'|'MFA_REQUIRED') {
  return apiJson({ error: code, requestId: reqId }, code === 'UNAUTHORIZED' ? 401 : 403, { 'X-Request-ID': reqId })
}

export async function POST(request: Request) {
  const reqId = requestId(request)
  if (!trustedMutationOrigin(request)) return apiJson({ error: 'CROSS_ORIGIN_DENIED', requestId: reqId }, 403, { 'X-Request-ID': reqId })
  const gate = await requireAal2(request)
  if (!gate.ok) return authFailure(reqId, gate.code)
  const user = gate.auth.user
  const rate = await checkRateLimit(request, 'api_key_create', 5, 3600, { subject: user.id })
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '3600', 'X-Request-ID': reqId })

  try {
    const parsed = createSchema.safeParse(await readJsonBody(request, 4_096))
    if (!parsed.success) return apiJson({ error: 'INVALID_KEY_REQUEST', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    const admin = createAdminClient()
    const now = new Date()
    const { count, error: countError } = await admin.from('api_keys').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('revoked_at', null).gt('expires_at', now.toISOString())
    if (countError) throw countError
    if ((count || 0) >= 10) return apiJson({ error: 'KEY_LIMIT_REACHED', requestId: reqId }, 409, { 'X-Request-ID': reqId })

    const secret = newSecret()
    const hash = await sha256(secret)
    const expiresAt = new Date(now.getTime() + parsed.data.ttlDays * 86_400_000).toISOString()
    const { data, error } = await admin.from('api_keys').insert({
      user_id: user.id,
      name: parsed.data.name,
      key_prefix: secret.slice(0, 17),
      key_hash: hash,
      scope: 'quote:read',
      expires_at: expiresAt,
    }).select('id,name,key_prefix,scope,expires_at,created_at').single()
    if (error) throw error
    await logSystemEvent({ level: 'info', source: 'api_keys', code: 'API_KEY_CREATED', userId: user.id, metadata: { requestId: reqId, keyId: data.id, ttlDays: parsed.data.ttlDays } })
    return apiJson({ key: data, secret, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    await logSystemEvent({ level: 'error', source: 'api_keys', code: 'KEY_CREATE_FAILED', message: safeErrorMessage(error), userId: user.id, metadata: { requestId: reqId } })
    return apiJson({ error: 'KEY_CREATE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}

export async function DELETE(request: Request) {
  const reqId = requestId(request)
  if (!trustedMutationOrigin(request)) return apiJson({ error: 'CROSS_ORIGIN_DENIED', requestId: reqId }, 403, { 'X-Request-ID': reqId })
  const gate = await requireAal2(request)
  if (!gate.ok) return authFailure(reqId, gate.code)
  const user = gate.auth.user
  const rate = await checkRateLimit(request, 'api_key_revoke', 20, 3600, { subject: user.id })
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '3600', 'X-Request-ID': reqId })

  try {
    const parsed = revokeSchema.safeParse(await readJsonBody(request, 4_096))
    if (!parsed.success) return apiJson({ error: 'INVALID_KEY', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    const admin = createAdminClient()
    const { data, error } = await admin.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', parsed.data.id).eq('user_id', user.id).is('revoked_at', null).select('id').maybeSingle()
    if (error) throw error
    if (!data) return apiJson({ error: 'KEY_NOT_FOUND', requestId: reqId }, 404, { 'X-Request-ID': reqId })
    await logSystemEvent({ level: 'info', source: 'api_keys', code: 'API_KEY_REVOKED', userId: user.id, metadata: { requestId: reqId, keyId: parsed.data.id } })
    return apiJson({ ok: true, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    await logSystemEvent({ level: 'error', source: 'api_keys', code: 'KEY_REVOKE_FAILED', message: safeErrorMessage(error), userId: user.id, metadata: { requestId: reqId } })
    return apiJson({ error: 'KEY_REVOKE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
