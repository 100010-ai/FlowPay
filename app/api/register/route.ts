import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { bodyErrorResponse, readJsonBody, requestId, apiJson, trustedMutationOrigin } from '@/lib/http'
import { LEGAL_VERSIONS } from '@/lib/legal'
import { logSystemEvent } from '@/lib/server-log'
import { safeErrorMessage } from '@/lib/security'

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(12).max(128),
  privacyVersion: z.literal(LEGAL_VERSIONS.privacy),
  termsVersion: z.literal(LEGAL_VERSIONS.terms),
  privacyAcknowledged: z.literal(true),
  termsAccepted: z.literal(true),
  locale: z.enum(['ru', 'en', 'fr', 'de', 'es']),
  website: z.string().max(0).optional().default(''),
})

export async function POST(request: Request) {
  const reqId = requestId(request)
  if (!trustedMutationOrigin(request)) return apiJson({ error: 'CROSS_ORIGIN_DENIED', requestId: reqId }, 403, { 'X-Request-ID': reqId })

  const rate = await checkRateLimit(request, 'registration_network', 5, 900)
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '900', 'X-Request-ID': reqId })

  try {
    const contentType = request.headers.get('content-type')?.toLowerCase() || ''
    if (!contentType.startsWith('application/json')) return apiJson({ error: 'UNSUPPORTED_MEDIA_TYPE', requestId: reqId }, 415, { 'X-Request-ID': reqId })

    const parsed = registerSchema.safeParse(await readJsonBody(request, 8_192))
    if (!parsed.success) return apiJson({ error: 'INVALID_REGISTRATION', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    if (parsed.data.website) return apiJson({ ok: true, requestId: reqId }, 202, { 'X-Request-ID': reqId })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim()
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is not configured')

    // Public Auth credentials create the account; service-role is used only to
    // persist server-trusted legal receipts after Auth confirms a newly-created user.
    const authClient = createServerClient()
    const { data, error } = await authClient.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${new URL(appUrl).origin}/login` },
    })
    if (error) {
      await logSystemEvent({ level: 'warning', source: 'registration', code: 'AUTH_SIGNUP_REJECTED', message: safeErrorMessage(error), metadata: { requestId: reqId } })
      return apiJson({ error: 'REGISTRATION_FAILED', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    }

    const user = data.user
    if (!user?.id) return apiJson({ ok: true, requestId: reqId }, 202, { 'X-Request-ID': reqId })

    const createdAt = user.created_at ? new Date(user.created_at).getTime() : Number.NaN
    const isFresh = Number.isFinite(createdAt) && Math.abs(Date.now() - createdAt) <= 120_000
    if (!isFresh) {
      // Existing-account responses are intentionally indistinguishable from a
      // normal accepted registration request and never mint new legal receipts.
      return apiJson({ ok: true, requestId: reqId }, 202, { 'X-Request-ID': reqId })
    }

    const acceptedAt = new Date().toISOString()
    const admin = createAdminClient()
    const { error: receiptError } = await admin.from('legal_acceptances').insert([
      {
        user_id: user.id,
        document_type: 'privacy',
        document_version: parsed.data.privacyVersion,
        action: 'acknowledged',
        locale: parsed.data.locale,
        source: 'registration_server',
        accepted_at: acceptedAt,
      },
      {
        user_id: user.id,
        document_type: 'terms',
        document_version: parsed.data.termsVersion,
        action: 'accepted',
        locale: parsed.data.locale,
        source: 'registration_server',
        accepted_at: acceptedAt,
      },
    ])
    if (receiptError) {
      // Account + legal evidence is one logical registration unit. If the
      // server-trusted receipts cannot be persisted, delete the freshly-created
      // Auth user rather than leaving an account that can never complete onboarding.
      const { error: rollbackError } = await admin.auth.admin.deleteUser(user.id)
      if (rollbackError) throw new Error('REGISTRATION_ROLLBACK_FAILED')
      throw receiptError
    }

    await logSystemEvent({ level: 'info', source: 'registration', code: 'ACCOUNT_REGISTERED', userId: user.id, metadata: { requestId: reqId } })
    return apiJson({ ok: true, requestId: reqId }, 201, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    await logSystemEvent({ level: 'error', source: 'registration', code: 'REGISTRATION_FAILED', message: safeErrorMessage(error), metadata: { requestId: reqId } })
    return apiJson({ error: 'REGISTRATION_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
