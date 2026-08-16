import { z } from 'zod'
import { authenticatedUser } from '@/lib/server-auth'
import { isFlowPayAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { isSupportedCountry, isSupportedCurrency } from '@/lib/countries'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiJson, bodyErrorResponse, readJsonBody, requestId } from '@/lib/http'
import { invalidateProviderRuleCache } from '@/lib/provider-rules'
import { logSystemEvent } from '@/lib/server-log'
import { safeErrorMessage } from '@/lib/security'

const country = z.string().trim().toUpperCase().refine(value => value === '*' || isSupportedCountry(value))
const currency = z.string().trim().toUpperCase().refine(isSupportedCurrency)
const base = z.object({
  provider_code: z.string().trim().min(2).max(80).regex(/^[a-z0-9_-]+$/i),
  display_name: z.string().trim().min(2).max(120),
  from_country: country,
  to_country: country,
  currencies: z.array(currency).min(1).max(12),
  fee_percent: z.coerce.number().min(0).max(20),
  fixed_fee: z.coerce.number().min(0).max(1_000_000),
  fx_markup_percent: z.coerce.number().min(0).max(20),
  speed_minutes: z.coerce.number().int().min(1).max(60 * 24 * 30),
  min_amount: z.coerce.number().positive().max(1_000_000_000),
  max_amount: z.coerce.number().positive().max(1_000_000_000),
  priority: z.coerce.number().int().min(1).max(10),
  reliability_percent: z.coerce.number().min(0).max(100).nullable().optional(),
  intermediary_banks: z.coerce.number().int().min(0).max(20).nullable().optional(),
  source: z.string().trim().min(2).max(120),
  source_updated_at: z.string().datetime().nullable().optional(),
  active: z.boolean().default(true),
}).refine(value => value.max_amount >= value.min_amount, { message: 'INVALID_AMOUNT_RANGE' })
const update = base.safeExtend({ id: z.string().uuid() })
const remove = z.object({ id: z.string().uuid() })
const ruleSelect = 'id,provider_code,display_name,from_country,to_country,currencies,fee_percent,fixed_fee,fx_markup_percent,speed_minutes,min_amount,max_amount,priority,reliability_percent,intermediary_banks,route_steps,source,source_updated_at,active,rule_key,created_at'

async function guard(request: Request, action: string) {
  const reqId = requestId(request)
  const user = await authenticatedUser(request)
  if (!user) return { error: apiJson({ error: 'UNAUTHORIZED', requestId: reqId }, 401, { 'X-Request-ID': reqId }), reqId }
  if (!isFlowPayAdmin(user)) return { error: apiJson({ error: 'FORBIDDEN', requestId: reqId }, 403, { 'X-Request-ID': reqId }), reqId }
  const rate = await checkRateLimit(request, `admin_provider_rules_${action}`, 60, 60, { subject: user.id })
  if (!rate.available) return { error: apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId }), reqId }
  if (!rate.allowed) return { error: apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '60', 'X-Request-ID': reqId }), reqId }
  return { user, reqId }
}

function normalize(input: z.infer<typeof base>) {
  const currencies = Array.from(new Set(input.currencies.map(value => value.toUpperCase()))).sort()
  return {
    ...input,
    currencies,
    rule_key: `${input.provider_code}:${input.from_country}:${input.to_country}:${currencies.join('-')}:${input.min_amount}:${input.max_amount}`,
    source_updated_at: input.source_updated_at || new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  const auth = await guard(request, 'create'); if ('error' in auth) return auth.error
  try {
    const parsed = base.safeParse(await readJsonBody(request, 32_768))
    if (!parsed.success) return apiJson({ error: 'INVALID_RULE', details: parsed.error.flatten(), requestId: auth.reqId }, 400, { 'X-Request-ID': auth.reqId })
    const admin = createAdminClient(); const payload = normalize(parsed.data)
    const { data, error } = await admin.from('provider_rules').insert(payload).select(ruleSelect).single()
    if (error) return apiJson({ error: error.code === '23505' ? 'RULE_EXISTS' : 'RULE_CREATE_FAILED', requestId: auth.reqId }, 400, { 'X-Request-ID': auth.reqId })
    invalidateProviderRuleCache()
    await logSystemEvent({ level: 'info', source: 'admin', code: 'PROVIDER_RULE_CREATED', userId: auth.user.id, metadata: { requestId: auth.reqId, ruleId: data.id } })
    return apiJson({ rule: data, requestId: auth.reqId }, 200, { 'X-Request-ID': auth.reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, auth.reqId); if (bodyError) return bodyError
    await logSystemEvent({ level: 'error', source: 'admin', code: 'PROVIDER_RULE_CREATE_FAILED', userId: auth.user.id, message: safeErrorMessage(error), metadata: { requestId: auth.reqId } })
    return apiJson({ error: 'RULE_CREATE_FAILED', requestId: auth.reqId }, 500, { 'X-Request-ID': auth.reqId })
  }
}

export async function PATCH(request: Request) {
  const auth = await guard(request, 'update'); if ('error' in auth) return auth.error
  try {
    const parsed = update.safeParse(await readJsonBody(request, 32_768))
    if (!parsed.success) return apiJson({ error: 'INVALID_RULE', requestId: auth.reqId }, 400, { 'X-Request-ID': auth.reqId })
    const { id, ...input } = parsed.data; const admin = createAdminClient(); const payload = normalize(input)
    const { data, error } = await admin.from('provider_rules').update(payload).eq('id', id).select(ruleSelect).single()
    if (error) return apiJson({ error: 'RULE_UPDATE_FAILED', requestId: auth.reqId }, 400, { 'X-Request-ID': auth.reqId })
    invalidateProviderRuleCache()
    await logSystemEvent({ level: 'info', source: 'admin', code: 'PROVIDER_RULE_UPDATED', userId: auth.user.id, metadata: { requestId: auth.reqId, ruleId: id } })
    return apiJson({ rule: data, requestId: auth.reqId }, 200, { 'X-Request-ID': auth.reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, auth.reqId); if (bodyError) return bodyError
    await logSystemEvent({ level: 'error', source: 'admin', code: 'PROVIDER_RULE_UPDATE_FAILED', userId: auth.user.id, message: safeErrorMessage(error), metadata: { requestId: auth.reqId } })
    return apiJson({ error: 'RULE_UPDATE_FAILED', requestId: auth.reqId }, 500, { 'X-Request-ID': auth.reqId })
  }
}

export async function DELETE(request: Request) {
  const auth = await guard(request, 'delete'); if ('error' in auth) return auth.error
  try {
    const parsed = remove.safeParse(await readJsonBody(request, 4_096))
    if (!parsed.success) return apiJson({ error: 'INVALID_RULE', requestId: auth.reqId }, 400, { 'X-Request-ID': auth.reqId })
    const admin = createAdminClient(); const { data, error } = await admin.from('provider_rules').delete().eq('id', parsed.data.id).select('id').maybeSingle()
    if (error) return apiJson({ error: 'RULE_DELETE_FAILED', requestId: auth.reqId }, 400, { 'X-Request-ID': auth.reqId })
    if (!data) return apiJson({ error: 'RULE_NOT_FOUND', requestId: auth.reqId }, 404, { 'X-Request-ID': auth.reqId })
    invalidateProviderRuleCache()
    await logSystemEvent({ level: 'info', source: 'admin', code: 'PROVIDER_RULE_DELETED', userId: auth.user.id, metadata: { requestId: auth.reqId, ruleId: parsed.data.id } })
    return apiJson({ ok: true, requestId: auth.reqId }, 200, { 'X-Request-ID': auth.reqId })
  } catch (error) {
    const bodyError = bodyErrorResponse(error, auth.reqId); if (bodyError) return bodyError
    await logSystemEvent({ level: 'error', source: 'admin', code: 'PROVIDER_RULE_DELETE_FAILED', userId: auth.user.id, message: safeErrorMessage(error), metadata: { requestId: auth.reqId } })
    return apiJson({ error: 'RULE_DELETE_FAILED', requestId: auth.reqId }, 500, { 'X-Request-ID': auth.reqId })
  }
}
