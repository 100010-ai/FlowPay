import { unstable_cache } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

const checkCore = unstable_cache(async () => {
  const admin = createAdminClient()
  const { count, error } = await admin.from('provider_rules').select('id', { count: 'exact', head: true }).eq('active', true)
  if (error) throw error
  return { database: true, routing: (count || 0) > 0 }
}, ['flowpay-health-v13'], { revalidate: 15 })

export async function GET() {
  const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY))
  let database = false
  let routing = false
  if (configured) {
    try {
      const result = await checkCore()
      database = result.database
      routing = result.routing
    } catch {
      database = false
    }
  }
  const ok = configured && database
  return Response.json({
    ok,
    status: ok ? 'operational' : 'degraded',
    checks: { application: configured, database, routing },
    timestamp: new Date().toISOString(),
  }, { status: ok ? 200 : 503, headers: { 'Cache-Control': 'public, max-age=5, s-maxage=15, stale-while-revalidate=30' } })
}
