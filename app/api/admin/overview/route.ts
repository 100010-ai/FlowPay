import { requireAal2 } from '@/lib/server-auth'
import { isFlowPayAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiJson, requestId } from '@/lib/http'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const reqId = requestId(request)
  const gate = await requireAal2(request)
  if (!gate.ok) return apiJson({ error: gate.code, requestId: reqId }, gate.code === 'UNAUTHORIZED' ? 401 : 403, { 'X-Request-ID': reqId })
  const user = gate.auth.user
  if (!isFlowPayAdmin(user)) return apiJson({ error: 'FORBIDDEN', requestId: reqId }, 403, { 'X-Request-ID': reqId })
  const rate = await checkRateLimit(request, 'admin_overview', 120, 60, { subject: user.id })
  if (!rate.available) return apiJson({ error: 'SERVICE_UNAVAILABLE', requestId: reqId }, 503, { 'X-Request-ID': reqId })
  if (!rate.allowed) return apiJson({ error: 'RATE_LIMITED', requestId: reqId }, 429, { 'Retry-After': '60', 'X-Request-ID': reqId })

  const admin = createAdminClient()
  const [profiles, payments, audits, rules, events] = await Promise.all([
    admin.from('company_profiles').select('user_id', { count: 'exact', head: true }),
    admin.from('payment_drafts').select('id', { count: 'exact', head: true }),
    admin.from('audit_requests').select('id', { count: 'exact', head: true }),
    admin.from('provider_rules').select('id,provider_code,display_name,from_country,to_country,currencies,fee_percent,fixed_fee,fx_markup_percent,speed_minutes,min_amount,max_amount,priority,reliability_percent,intermediary_banks,source,source_updated_at,active,created_at').order('created_at', { ascending: false }).limit(500),
    admin.from('system_event_logs').select('id,level,source,code,message,created_at').order('created_at', { ascending: false }).limit(50),
  ])
  const error = [profiles, payments, audits, rules, events].find(result => result.error)?.error
  if (error) return apiJson({ error: 'ADMIN_LOAD_FAILED', requestId: reqId }, 500, { 'X-Request-ID': reqId })
  return apiJson({
    metrics: {
      companies: profiles.count || 0,
      payments: payments.count || 0,
      audits: audits.count || 0,
      activeRules: (rules.data || []).filter(rule => rule.active).length,
    },
    rules: rules.data || [],
    events: events.data || [],
    requestId: reqId,
  }, 200, { 'X-Request-ID': reqId })
}
