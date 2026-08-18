import { NextResponse } from 'next/server'
import { getProviderCoverage } from '@/lib/provider-rules'
import { getProviderNetworkCoverage } from '@/lib/provider-network'

export const revalidate = 300

export async function GET() {
  try {
    const routing = await getProviderCoverage()
    const network = getProviderNetworkCoverage()
    return NextResponse.json({
      coverage: {
        network: {
          providers: network.providers,
          markets: network.markets,
          marketsPlus: network.marketsPlus,
          currencies: network.currencies,
          currenciesPlus: network.currenciesPlus,
          platformCountries: network.platformCountries,
          platformCurrencies: network.platformCurrencies,
          verifiedAt: network.verifiedAt,
        },
        routing,
        // Backwards-compatible production-only counters for older consumers.
        providers: routing.providers,
        corridors: routing.corridors,
        currencies: routing.currencies,
        rules: routing.rules,
      },
    }, { headers: { 'Cache-Control': 'public, s-maxage=300' } })
  } catch {
    return NextResponse.json({ error: 'COVERAGE_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
