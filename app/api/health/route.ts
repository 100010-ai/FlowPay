import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  const started = Date.now()
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY)
  let database = false
  let routeCount = 0
  if (configured) {
    try {
      const admin = createAdminClient()
      const { count, error } = await admin.from('provider_rules').select('id', { count: 'exact', head: true }).eq('active', true)
      if (!error) {
        database = true
        routeCount = count || 0
      }
    } catch {
      database = false
    }
  }
  const ok = configured && database
  return NextResponse.json({
    ok,
    status: ok ? 'operational' : 'degraded',
    version: '1.2.0',
    checks: { configuration: configured, database },
    routing: { configuredRules: routeCount },
    timestamp: new Date().toISOString(),
    responseTimeMs: Date.now() - started,
  }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
