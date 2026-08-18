import { z } from 'zod'
import { requireAal2 } from '@/lib/server-auth'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiJson, bodyErrorResponse, readJsonBody, requestId, trustedMutationOrigin } from '@/lib/http'

const schema = z.object({
  name: z.string().trim().min(2).max(160),
  country: z.string().trim().toUpperCase().refine(isSupportedCountry),
  preferred_currency: z.string().trim().toUpperCase().refine(isSupportedCurrency),
  registration_number: z.string().trim().max(100).default(''),
  business_address: z.string().trim().max(300).default(''),
  default_payment_method: z.enum(['bank_transfer','swift','local']).default('bank_transfer'),
  default_charge_type: z.enum(['shared','sender','recipient']).default('shared'),
  beneficiary_notifications: z.boolean().default(true),
  notify_payment_confirmations: z.boolean().default(true),
  notify_payment_failures: z.boolean().default(true),
  notify_security_alerts: z.boolean().default(true),
  notify_weekly_reports: z.boolean().default(false),
  approval_enabled: z.boolean().default(false),
  approval_threshold: z.coerce.number().finite().min(0).max(1_000_000_000).default(10_000),
})

export async function PUT(request: Request) {
  const reqId = requestId(request)
  if (!trustedMutationOrigin(request)) return apiJson({ error: 'CROSS_ORIGIN_DENIED', requestId: reqId }, 403, { 'X-Request-ID': reqId })
  const gate = await requireAal2(request)
  if (!gate.ok) return apiJson({ error: gate.code, requestId: reqId }, gate.code === 'UNAUTHORIZED' ? 401 : 403, { 'X-Request-ID': reqId })
  const auth = gate.auth
  const rate = await checkRateLimit(request, 'profile_save', 30, 3600, { subject: auth.user.id })
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '3600', 'X-Request-ID': reqId })
  try {
    const parsed = schema.safeParse(await readJsonBody(request, 24_576))
    if (!parsed.success) return apiJson({ error: 'INVALID_PROFILE', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    const input = parsed.data
    const { error } = await auth.client.rpc('flowpay_update_profile_v2', {
      p_name: input.name,
      p_country: input.country,
      p_preferred_currency: input.preferred_currency,
      p_registration_number: input.registration_number,
      p_business_address: input.business_address,
      p_default_payment_method: input.default_payment_method,
      p_default_charge_type: input.default_charge_type,
      p_beneficiary_notifications: input.beneficiary_notifications,
      p_notify_payment_confirmations: input.notify_payment_confirmations,
      p_notify_payment_failures: input.notify_payment_failures,
      p_notify_security_alerts: input.notify_security_alerts,
      p_notify_weekly_reports: input.notify_weekly_reports,
      p_approval_enabled: input.approval_enabled,
      p_approval_threshold: input.approval_threshold,
    })
    if (error) return apiJson({ error: 'PROFILE_SAVE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
    return apiJson({ ok: true, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    return apiJson({ error: 'PROFILE_SAVE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
