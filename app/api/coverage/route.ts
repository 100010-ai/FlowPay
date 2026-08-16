import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('provider_rules')
      .select('provider_code,display_name,from_country,to_country,currencies')
      .eq('active', true)
      .limit(500)

    if (error) throw error
    const rules = data ?? []
    const publicRules = rules.filter((rule) => Boolean(rule.display_name)).slice(0, 3).map((rule) => ({
      provider_code: rule.provider_code,
      display_name: rule.display_name,
      from_country: rule.from_country,
      to_country: rule.to_country,
      currencies: rule.currencies ?? [],
    }))

    return NextResponse.json({
      coverage: {
        providers: new Set(rules.map((rule) => rule.provider_code)).size,
        corridors: new Set(rules.map((rule) => `${rule.from_country}:${rule.to_country}`)).size,
        currencies: new Set(rules.flatMap((rule) => rule.currencies ?? [])).size,
        rules: publicRules,
      },
    }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' } })
  } catch (error) {
    console.error('coverage error', error)
    return NextResponse.json({ error: 'COVERAGE_UNAVAILABLE' }, { status: 503 })
  }
}
