import type { User } from '@supabase/supabase-js'
import { requireFlowPayAdmin } from '@/lib/admin-api'
import { apiJson } from '@/lib/http'
import { createAdminClient } from '@/lib/supabase/admin'
import { safeErrorMessage } from '@/lib/security'
import { logSystemEvent } from '@/lib/server-log'

export const dynamic = 'force-dynamic'

const USER_PAGE_SIZE = 200
const USER_MAX_PAGES = 10

async function listUsers(admin: ReturnType<typeof createAdminClient>) {
  const users: User[] = []
  let truncated = false
  for (let page = 1; page <= USER_MAX_PAGES; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: USER_PAGE_SIZE })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < USER_PAGE_SIZE) return { users, truncated: false }
    if (page === USER_MAX_PAGES) truncated = true
  }
  return { users, truncated }
}

function isoDateDaysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

function isoHoursAgo(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  const result: Record<string, number> = {}
  for (const row of rows) {
    const value = key(row)
    result[value] = (result[value] || 0) + 1
  }
  return result
}

export async function GET(request: Request) {
  const gate = await requireFlowPayAdmin(request, 'admin_overview_v2', 60)
  if (!gate.ok) return gate.response

  const admin = createAdminClient()
  const sevenDaysAgo = isoDateDaysAgo(6)
  const oneDayAgo = isoHoursAgo(24)
  const now = new Date().toISOString()

  try {
    const usersPromise = listUsers(admin)
    const [
      profilesCount,
      paymentsCount,
      invoicesCount,
      counterpartiesCount,
      auditsCount,
      calculationsCount,
      activeKeysCount,
      activeRulesCount,
      errors24hCount,
      profiles,
      recentPayments,
      recentInvoices,
      recentApiKeys,
      recentApiLogs,
      apiUsage,
      workspaceAudit,
      systemEvents,
      legalAcceptances,
      rules,
      usersResult,
    ] = await Promise.all([
      admin.from('company_profiles').select('user_id', { count: 'exact', head: true }),
      admin.from('payment_drafts').select('id', { count: 'exact', head: true }),
      admin.from('invoices').select('id', { count: 'exact', head: true }),
      admin.from('counterparties').select('id', { count: 'exact', head: true }),
      admin.from('audit_requests').select('id', { count: 'exact', head: true }),
      admin.from('calculations').select('id', { count: 'exact', head: true }),
      admin.from('api_keys').select('id', { count: 'exact', head: true }).is('revoked_at', null).gt('expires_at', now),
      admin.from('provider_rules').select('id', { count: 'exact', head: true }).eq('active', true),
      admin.from('system_event_logs').select('id', { count: 'exact', head: true }).eq('level', 'error').gte('created_at', oneDayAgo),
      admin.from('company_profiles').select('user_id,name,country,preferred_currency,onboarding_completed_at,created_at,updated_at').order('created_at', { ascending: false }).limit(1000),
      admin.from('payment_drafts').select('id,user_id,supplier_name,invoice_number,amount,currency,status,due_date,route_provider_code,created_at,updated_at').order('updated_at', { ascending: false }).limit(120),
      admin.from('invoices').select('id,user_id,invoice_number,supplier_name,amount,currency,status,due_date,payment_draft_id,created_at,updated_at').order('updated_at', { ascending: false }).limit(120),
      admin.from('api_keys').select('id,user_id,name,key_prefix,scope,expires_at,last_used_at,created_at,revoked_at').order('created_at', { ascending: false }).limit(150),
      admin.from('api_request_logs').select('id,user_id,endpoint,status_code,duration_ms,request_id,created_at').order('created_at', { ascending: false }).limit(150),
      admin.from('api_usage_daily').select('user_id,endpoint,usage_date,request_count,success_count,error_count,total_duration_ms,max_duration_ms,updated_at').gte('usage_date', sevenDaysAgo).order('usage_date', { ascending: false }).limit(1000),
      admin.from('workspace_audit_log').select('id,user_id,entity_type,entity_id,action,created_at').order('created_at', { ascending: false }).limit(150),
      admin.from('system_event_logs').select('id,user_id,level,source,code,message,created_at').order('created_at', { ascending: false }).limit(150),
      admin.from('legal_acceptances').select('id,user_id,document_type,document_version,action,locale,source,accepted_at,created_at').order('accepted_at', { ascending: false }).limit(200),
      admin.from('provider_rules').select('id,provider_code,display_name,from_country,to_country,currencies,fee_percent,fixed_fee,fx_markup_percent,speed_minutes,min_amount,max_amount,priority,reliability_percent,intermediary_banks,source,source_updated_at,active,created_at').order('created_at', { ascending: false }).limit(500),
      usersPromise,
    ])

    const queryResults = [profilesCount, paymentsCount, invoicesCount, counterpartiesCount, auditsCount, calculationsCount, activeKeysCount, activeRulesCount, errors24hCount, profiles, recentPayments, recentInvoices, recentApiKeys, recentApiLogs, apiUsage, workspaceAudit, systemEvents, legalAcceptances, rules]
    const failed = queryResults.find(result => result.error)
    if (failed?.error) throw failed.error

    const profileRows = profiles.data || []
    const profileMap = new Map(profileRows.map(profile => [profile.user_id, profile]))
    const userRows = usersResult.users.map(user => {
      const profile = profileMap.get(user.id)
      return {
        id: user.id,
        email: user.email || '',
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at || null,
        email_confirmed_at: user.email_confirmed_at || null,
        company: profile?.name || '',
        country: profile?.country || '',
        currency: profile?.preferred_currency || '',
        onboarding_completed_at: profile?.onboarding_completed_at || null,
      }
    })

    const apiUsageRows = (apiUsage.data || []).map(row => ({
      ...row,
      request_count: Number(row.request_count || 0),
      success_count: Number(row.success_count || 0),
      error_count: Number(row.error_count || 0),
      total_duration_ms: Number(row.total_duration_ms || 0),
      max_duration_ms: Number(row.max_duration_ms || 0),
    }))
    const apiRequests7d = apiUsageRows.reduce((sum, row) => sum + row.request_count, 0)
    const apiErrors7d = apiUsageRows.reduce((sum, row) => sum + row.error_count, 0)
    const apiDuration7d = apiUsageRows.reduce((sum, row) => sum + row.total_duration_ms, 0)
    const apiSuccessRate = apiRequests7d > 0 ? ((apiRequests7d - apiErrors7d) / apiRequests7d) * 100 : 100
    const apiAverageDurationMs = apiRequests7d > 0 ? Math.round(apiDuration7d / apiRequests7d) : 0

    const paymentRows = (recentPayments.data || []).map(row => ({ ...row, amount: Number(row.amount || 0) }))
    const invoiceRows = (recentInvoices.data || []).map(row => ({ ...row, amount: Number(row.amount || 0) }))
    const ruleRows = (rules.data || []).map(row => ({
      ...row,
      fee_percent: Number(row.fee_percent || 0),
      fixed_fee: Number(row.fixed_fee || 0),
      fx_markup_percent: Number(row.fx_markup_percent || 0),
      min_amount: Number(row.min_amount || 0),
      max_amount: Number(row.max_amount || 0),
      reliability_percent: row.reliability_percent == null ? null : Number(row.reliability_percent),
      intermediary_banks: row.intermediary_banks == null ? null : Number(row.intermediary_banks),
    }))
    const activeRules = ruleRows.filter(rule => rule.active)
    const corridors = new Set(activeRules.map(rule => `${rule.from_country}:${rule.to_country}`))
    const currencies = new Set(activeRules.flatMap(rule => rule.currencies || []))
    const providers = new Set(activeRules.map(rule => rule.provider_code))

    const termsReceipts = (legalAcceptances.data || []).filter(row => row.document_type === 'terms').length
    const privacyReceipts = (legalAcceptances.data || []).filter(row => row.document_type === 'privacy').length

    return apiJson({
      version: '1.7.1',
      generatedAt: new Date().toISOString(),
      usersTruncated: usersResult.truncated,
      metrics: {
        users: userRows.length,
        companies: profilesCount.count || 0,
        payments: paymentsCount.count || 0,
        invoices: invoicesCount.count || 0,
        counterparties: counterpartiesCount.count || 0,
        audits: auditsCount.count || 0,
        calculations: calculationsCount.count || 0,
        activeApiKeys: activeKeysCount.count || 0,
        activeRules: activeRulesCount.count || 0,
        systemErrors24h: errors24hCount.count || 0,
        apiRequests7d,
        apiSuccessRate,
        apiAverageDurationMs,
        termsReceipts,
        privacyReceipts,
      },
      coverage: {
        providers: providers.size,
        corridors: corridors.size,
        currencies: currencies.size,
      },
      breakdowns: {
        payments: countBy(paymentRows, row => String(row.status || 'unknown')),
        invoices: countBy(invoiceRows, row => String(row.status || 'unknown')),
        systemEvents: countBy(systemEvents.data || [], row => String(row.level || 'unknown')),
      },
      health: {
        application: true,
        database: true,
        routing: activeRules.length > 0,
        recentSystemErrors: (errors24hCount.count || 0) === 0,
      },
      users: userRows,
      payments: paymentRows,
      invoices: invoiceRows,
      apiKeys: recentApiKeys.data || [],
      apiLogs: recentApiLogs.data || [],
      apiUsage: apiUsageRows,
      auditLogs: workspaceAudit.data || [],
      events: systemEvents.data || [],
      legalAcceptances: legalAcceptances.data || [],
      rules: ruleRows,
      requestId: gate.reqId,
    }, 200, { 'X-Request-ID': gate.reqId })
  } catch (error) {
    await logSystemEvent({
      level: 'error',
      source: 'admin',
      code: 'ADMIN_OVERVIEW_LOAD_FAILED',
      userId: gate.user.id,
      message: safeErrorMessage(error),
      metadata: { requestId: gate.reqId },
    })
    return apiJson({ error: 'ADMIN_LOAD_FAILED', requestId: gate.reqId }, 500, { 'X-Request-ID': gate.reqId })
  }
}
