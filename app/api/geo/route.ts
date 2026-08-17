import { apiJson, requestId } from '@/lib/http'
import { defaultCurrencyForCountry, isSupportedCountry } from '@/lib/countries'

export const dynamic = 'force-dynamic'

function cleanHeader(value: string | null, maxLength: number) {
  const cleaned = value?.trim() || ''
  if (!cleaned || cleaned.length > maxLength) return null
  return cleaned
}

export async function GET(request: Request) {
  const reqId = requestId(request)
  const rawCountry = cleanHeader(request.headers.get('x-vercel-ip-country'), 2)?.toUpperCase() || null
  const country = rawCountry && isSupportedCountry(rawCountry) ? rawCountry : null
  const timezone = cleanHeader(request.headers.get('x-vercel-ip-timezone'), 80)
  const region = cleanHeader(request.headers.get('x-vercel-ip-country-region'), 8)

  return apiJson({
    country,
    currency: country ? defaultCurrencyForCountry(country) : null,
    timezone,
    region,
    detected: Boolean(country),
    requestId: reqId,
  }, 200, {
    'X-Request-ID': reqId,
    'Vary': 'X-Vercel-IP-Country, X-Vercel-IP-Timezone, X-Vercel-IP-Country-Region',
  })
}
