export type ReferenceFx = {
  sourceCurrency: string
  targetCurrency: string
  rate: number
  date: string
  source: 'ECB'
  isReference: true
}

const ECB_SUPPORTED = new Set([
  'USD','JPY','BGN','CZK','DKK','GBP','HUF','PLN','RON','SEK','CHF','ISK','NOK','TRY','AUD','BRL','CAD','CNY','HKD','IDR','ILS','INR','KRW','MXN','MYR','NZD','PHP','SGD','THB','ZAR'
])

function csvRows(text: string) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) throw new Error('ECB_RESPONSE_EMPTY')
  const headers = lines[0].split(',').map((s) => s.replace(/^"|"$/g, ''))
  return lines.slice(1).map((line) => {
    const cells: string[] = []
    let current = ''; let quoted = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') quoted = !quoted
      else if (c === ',' && !quoted) { cells.push(current); current = '' }
      else current += c
    }
    cells.push(current)
    return Object.fromEntries(headers.map((h, i) => [h, (cells[i] ?? '').replace(/^"|"$/g, '')]))
  })
}

async function eurRate(currency: string) {
  if (currency === 'EUR') {
    return { rate: 1, date: new Date().toISOString().slice(0, 10) }
  }
  if (!ECB_SUPPORTED.has(currency)) throw new Error(`ECB_UNSUPPORTED_CURRENCY:${currency}`)
  const url = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?lastNObservations=1&detail=dataonly&format=csvdata`
  const response = await fetch(url, { next: { revalidate: 3600 * 6 }, headers: { Accept: 'text/csv' }, signal: AbortSignal.timeout(5_000) })
  if (!response.ok) throw new Error(`ECB_HTTP_${response.status}`)
  const row = csvRows(await response.text())[0]
  if (!row) throw new Error('ECB_RESPONSE_EMPTY')
  const rate = Number(row.OBS_VALUE)
  const date = row.TIME_PERIOD?.trim()
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('ECB_INVALID_RATE')
  if (!date) throw new Error('ECB_MISSING_DATE')
  return { rate, date }
}

export async function getReferenceFx(sourceCurrency: string, targetCurrency: string): Promise<ReferenceFx> {
  const source = sourceCurrency.toUpperCase()
  const target = targetCurrency.toUpperCase()
  if (source === target) return { sourceCurrency: source, targetCurrency: target, rate: 1, date: new Date().toISOString().slice(0, 10), source: 'ECB', isReference: true }
  const [src, dst] = await Promise.all([eurRate(source), eurRate(target)])
  return { sourceCurrency: source, targetCurrency: target, rate: dst.rate / src.rate, date: dst.date, source: 'ECB', isReference: true }
}
