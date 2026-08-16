import { getReferenceFx } from '@/lib/fx'
import { isSupportedCurrency } from '@/lib/countries'
import { apiJson, requestId } from '@/lib/http'
import { logSystemEvent } from '@/lib/server-log'

export const revalidate = 21600

function currencyList(url: URL) {
  const raw = url.searchParams.get('sources')
  if (!raw) return null
  const list = Array.from(new Set(raw.split(',').map(value => value.trim().toUpperCase()).filter(Boolean)))
  return list
}

export async function GET(request: Request) {
  const reqId = requestId(request)
  const url = new URL(request.url)
  const target = (url.searchParams.get('target') || 'USD').toUpperCase()
  const sources = currencyList(url)

  if (!isSupportedCurrency(target)) return apiJson({ error: 'INVALID_CURRENCY', requestId: reqId }, 400, { 'X-Request-ID': reqId })
  if (sources) {
    if (sources.length < 1 || sources.length > 32 || sources.some(value => !isSupportedCurrency(value))) {
      return apiJson({ error: 'INVALID_CURRENCY_SET', requestId: reqId }, 400, { 'X-Request-ID': reqId })
    }
    try {
      const rows = await Promise.all(sources.map(async source => [source, await getReferenceFx(source, target)] as const))
      const rates: Record<string, number> = {}
      const missing: string[] = []
      let date: string | null = null
      for (const [source, result] of rows) {
        if (result) { rates[source] = result.rate; date = date || result.date }
        else missing.push(source)
      }
      return Response.json({ targetCurrency: target, rates, missing, date, source: 'ECB', isReference: true }, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400', 'X-Request-ID': reqId } })
    } catch {
      await logSystemEvent({ level: 'warning', source: 'fx', code: 'FX_BATCH_SOURCE_UNAVAILABLE', metadata: { requestId: reqId, target, count: sources.length } })
      return apiJson({ error: 'FX_SOURCE_UNAVAILABLE', requestId: reqId }, 503, { 'Retry-After': '30', 'X-Request-ID': reqId })
    }
  }

  const source = (url.searchParams.get('source') || 'EUR').toUpperCase()
  if (!isSupportedCurrency(source)) return apiJson({ error: 'INVALID_CURRENCY', requestId: reqId }, 400, { 'X-Request-ID': reqId })
  try {
    const rate = await getReferenceFx(source, target)
    if (!rate) return apiJson({ error: 'RATE_UNAVAILABLE', requestId: reqId }, 404, { 'X-Request-ID': reqId })
    return Response.json(rate, { headers: { 'Cache-Control': 'public, max-age=300, s-maxage=21600, stale-while-revalidate=86400', 'X-Request-ID': reqId } })
  } catch {
    await logSystemEvent({ level: 'warning', source: 'fx', code: 'FX_SOURCE_UNAVAILABLE', metadata: { requestId: reqId, source, target } })
    return apiJson({ error: 'FX_SOURCE_UNAVAILABLE', requestId: reqId }, 503, { 'Retry-After': '30', 'X-Request-ID': reqId })
  }
}
