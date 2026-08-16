import type { QuoteRoute, RouteStep } from './types'

type ProviderRule = {
  id: string
  provider_code: string
  display_name?: string | null
  from_country: string
  to_country: string
  fee_percent: number | string
  fixed_fee: number | string
  fx_markup_percent: number | string
  speed_minutes: number
  priority: number
  reliability_percent?: number | string | null
  intermediary_banks?: number | null
  route_steps?: RouteStep[] | null
  source?: string | null
  source_updated_at?: string | null
}

function scoreRoute(fee: number, amount: number, speedMinutes: number, priority: number, reliability: number) {
  const feeRatio = fee / Math.max(amount, 1)
  const feeScore = Math.max(0, 100 - feeRatio * 3000)
  const speedScore = Math.max(0, 100 - Math.min(speedMinutes, 4320) / 60)
  const reliabilityScore = Math.max(0, Math.min(100, reliability))
  return Math.max(0, Math.min(100, Math.round((feeScore * .52 + speedScore * .20 + priority * 10 * .08 + reliabilityScore * .20) * 10) / 10))
}

function specificity(rule: ProviderRule, fromCountry: string, toCountry: string) {
  return (rule.from_country === fromCountry ? 2 : 0) + (rule.to_country === toCountry ? 2 : 0)
}

function strictRule(row: ProviderRule) {
  const fixedFee = Number(row.fixed_fee)
  const feePercent = Number(row.fee_percent)
  const fxMarkupPercent = Number(row.fx_markup_percent)
  const speedMinutes = Number(row.speed_minutes)
  const reliability = Number(row.reliability_percent)
  const intermediaryBanks = Number(row.intermediary_banks)
  const providerName = row.display_name?.trim()
  const source = row.source?.trim()
  const sourceUpdatedAt = row.source_updated_at?.trim()

  if (!providerName) throw new Error(`PROVIDER_RULE_MISSING_DISPLAY_NAME:${row.id}`)
  if (!source) throw new Error(`PROVIDER_RULE_MISSING_SOURCE:${row.id}`)
  if (!sourceUpdatedAt) throw new Error(`PROVIDER_RULE_MISSING_SOURCE_UPDATED_AT:${row.id}`)
  if (!Array.isArray(row.route_steps)) throw new Error(`PROVIDER_RULE_MISSING_ROUTE_STEPS:${row.id}`)
  if (!Number.isFinite(fixedFee) || fixedFee < 0) throw new Error(`PROVIDER_RULE_INVALID_FIXED_FEE:${row.id}`)
  if (!Number.isFinite(feePercent) || feePercent < 0) throw new Error(`PROVIDER_RULE_INVALID_FEE_PERCENT:${row.id}`)
  if (!Number.isFinite(fxMarkupPercent) || fxMarkupPercent < 0) throw new Error(`PROVIDER_RULE_INVALID_FX_MARKUP:${row.id}`)
  if (!Number.isFinite(speedMinutes) || speedMinutes <= 0) throw new Error(`PROVIDER_RULE_INVALID_SPEED:${row.id}`)
  if (!Number.isFinite(reliability) || reliability < 0 || reliability > 100) throw new Error(`PROVIDER_RULE_INVALID_RELIABILITY:${row.id}`)
  if (!Number.isInteger(intermediaryBanks) || intermediaryBanks < 0) throw new Error(`PROVIDER_RULE_INVALID_INTERMEDIARY_BANKS:${row.id}`)

  return { fixedFee, feePercent, fxMarkupPercent, speedMinutes, reliability, intermediaryBanks, providerName, source, sourceUpdatedAt, routeSteps: row.route_steps }
}

export function buildRoutes(rules: ProviderRule[], amount: number, fromCountry: string, toCountry: string, recipientRate: number): QuoteRoute[] {
  if (!Number.isFinite(recipientRate) || recipientRate <= 0) throw new Error('INVALID_RECIPIENT_RATE')
  const selected = new Map<string, ProviderRule>()
  for (const rule of rules) {
    const current = selected.get(rule.provider_code)
    if (!current) { selected.set(rule.provider_code, rule); continue }
    const nextSpecificity = specificity(rule, fromCountry, toCountry)
    const currentSpecificity = specificity(current, fromCountry, toCountry)
    if (nextSpecificity > currentSpecificity || (nextSpecificity === currentSpecificity && rule.priority > current.priority)) selected.set(rule.provider_code, rule)
  }

  const routes = Array.from(selected.values()).map((row) => {
    const strict = strictRule(row)
    const percentageFee = amount * strict.feePercent / 100
    const fxMarkup = amount * strict.fxMarkupPercent / 100
    const fee = Math.round((strict.fixedFee + percentageFee + fxMarkup) * 100) / 100
    return {
      id: row.id,
      providerCode: row.provider_code,
      providerName: strict.providerName,
      fee,
      fixedFee: Math.round(strict.fixedFee * 100) / 100,
      percentageFee: Math.round(percentageFee * 100) / 100,
      fxMarkup: Math.round(fxMarkup * 100) / 100,
      fxMarkupPct: Math.round(strict.fxMarkupPercent * 10000) / 10000,
      effectiveRatePct: Math.round((fee / Math.max(amount, 1)) * 10000) / 100,
      totalCost: Math.round((amount + fee) * 100) / 100,
      recipientGets: Math.round((amount * recipientRate) * 100) / 100,
      speedMinutes: strict.speedMinutes,
      score: scoreRoute(fee, amount, strict.speedMinutes, row.priority, strict.reliability),
      reliabilityPercent: strict.reliability,
      intermediaryBanks: strict.intermediaryBanks,
      routeSteps: strict.routeSteps,
      source: strict.source,
      sourceUpdatedAt: strict.sourceUpdatedAt,
      isEstimate: true,
      why: [] as string[],
    }
  }).sort((a, b) => b.score - a.score || a.fee - b.fee)

  if (routes.length === 0) throw new Error('NO_ELIGIBLE_PROVIDER_ROUTES')
  const cheapest = Math.min(...routes.map(route => route.fee))
  const fastest = Math.min(...routes.map(route => route.speedMinutes))
  const lowestFx = Math.min(...routes.map(route => route.fxMarkup))
  for (const route of routes) {
    if (route.fee === cheapest) route.why?.push('LOWEST_COST')
    if (route.speedMinutes === fastest) route.why?.push('FASTEST')
    if (route.fxMarkup === lowestFx) route.why?.push('LOW_FX_MARKUP')
    if (route.score >= 85) route.why?.push('HIGH_SCORE')
  }
  return routes
}

export function estimatedSaving(routes: QuoteRoute[]) {
  if (routes.length < 2) return 0
  const best = routes[0].fee
  const highest = Math.max(...routes.map(route => route.fee))
  return Math.max(0, Math.round((highest - best) * 100) / 100)
}
