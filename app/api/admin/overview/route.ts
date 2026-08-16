import { NextResponse } from 'next/server'
import { authenticatedUser } from '@/lib/server-auth'
import { isFlowPayAdmin } from '@/lib/admin-auth'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 })
  if (!isFlowPayAdmin(user)) return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 })
  const admin = createAdminClient()
  const [profiles, payments, audits, rules, events] = await Promise.all([
    admin.from('company_profiles').select('user_id', { count: 'exact', head: true }),
    admin.from('payment_drafts').select('id', { count: 'exact', head: true }),
    admin.from('audit_requests').select('id', { count: 'exact', head: true }),
    admin.from('provider_rules').select('*').order('created_at', { ascending: false }).limit(500),
    admin.from('system_event_logs').select('id,level,source,code,message,created_at').order('created_at', { ascending: false }).limit(50),
  ])
  const error = [profiles, payments, audits, rules, events].find(result => result.error)?.error
  if (error) return NextResponse.json({ error: 'ADMIN_LOAD_FAILED' }, { status: 500 })
  return NextResponse.json({
    metrics: {
      companies: profiles.count || 0,
      payments: payments.count || 0,
      audits: audits.count || 0,
      activeRules: (rules.data || []).filter(rule => rule.active).length,
    },
    rules: rules.data || [],
    events: events.data || [],
  }, { headers: { 'Cache-Control': 'no-store' } })
}
