import { z } from 'zod'
import { authenticatedClient } from '@/lib/server-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiJson, bodyErrorResponse, readJsonBody, requestId } from '@/lib/http'

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
})

export async function PUT(request: Request) {
  const reqId = requestId(request)
  const auth = await authenticatedClient(request)
  if (!auth) return apiJson({ error: 'UNAUTHORIZED', requestId: reqId }, 401, { 'X-Request-ID': reqId })
  const rate = await checkRateLimit(request, 'profile_save', 60, 3600, { subject: auth.user.id })
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '3600', 'X-Request-ID': reqId })
  try {
    const parsed = schema.safeParse(await readJsonBody(request, 24_576))
    if (!parsed.success) return apiJson({ error: 'INVALID_PROFILE', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    const { error } = await createAdminClient().from('company_profiles').upsert({ user_id: auth.user.id, ...parsed.data }, { onConflict: 'user_id' })
    if (error) return apiJson({ error: 'PROFILE_SAVE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
    return apiJson({ ok: true, requestId: reqId }, 200, { 'X-Request-ID': reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, reqId)
    if (bodyError) return bodyError
    return apiJson({ error: 'PROFILE_SAVE_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  }
}
