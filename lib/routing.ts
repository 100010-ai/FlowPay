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

function scoreRoute(fee: number, amount: number, speedMinutes: number, priority: number, reliability: number | null) {
  const feeRatio = fee / Math.max(amount, 1)
  const feeScore = Math.max(0, 100 - feeRatio * 3000)
  const speedScore = Math.max(0, 100 - Math.min(speedMinutes, 4320) / 60)
  const reliabilityScore = reliability == null ? 75 : Math.max(0, Math.min(100, reliability))
  return Math.max(0, Math.min(100, Math.round((feeScore * .52 + speedScore * .20 + priority * 10 * .08 + reliabilityScore * .20) * 10) / 10))
}

function specificity(rule: ProviderRule, fromCountry: string, toCountry: string) {
  return (rule.from_country === fromCountry ? 2 : 0) + (rule.to_country === toCountry ? 2 : 0)
}

export function buildRoutes(rules: ProviderRule[], amount: number, fromCountry: string, toCountry: string, recipientRate: number | null = null): QuoteRoute[] {
  const selected = new Map<string, ProviderRule>()
  for (const rule of rules) {
    const current = selected.get(rule.provider_code)
    if (!current) { selected.set(rule.provider_code, rule); continue }
    const nextSpecificity = specificity(rule, fromCountry, toCountry)
    const currentSpecificity = specificity(current, fromCountry, toCountry)
    if (nextSpecificity > currentSpecificity || (nextSpecificity === currentSpecificity && rule.priority > current.priority)) selected.set(rule.provider_code, rule)
  }

  const routes = Array.from(selected.values()).flatMap((row) => {
    const fixedFee = Number(row.fixed_fee)
    const feePercent = Number(row.fee_percent)
    const fxMarkupPercent = Number(row.fx_markup_percent)
    const speedMinutes = Number(row.speed_minutes)
    const reliability = row.reliability_percent == null ? null : Number(row.reliability_percent)
    if (
      !Number.isFinite(fixedFee) || fixedFee < 0 ||
      !Number.isFinite(feePercent) || feePercent < 0 ||
      !Number.isFinite(fxMarkupPercent) || fxMarkupPercent < 0 ||
      !Number.isFinite(speedMinutes) || speedMinutes <= 0 ||
      (reliability != null && (!Number.isFinite(reliability) || reliability < 0 || reliability > 100))
    ) return []
    const percentageFee = amount * feePercent / 100
    const fxMarkup = amount * fxMarkupPercent / 100
    const fee = Math.round((fixedFee + percentageFee + fxMarkup) * 100) / 100
    return [{
      id: row.id,
      providerCode: row.provider_code,
      providerName: row.display_name?.trim() || row.provider_code,
      fee,
      fixedFee: Math.round(fixedFee * 100) / 100,
      percentageFee: Math.round(percentageFee * 100) / 100,
      fxMarkup: Math.round(fxMarkup * 100) / 100,
      fxMarkupPct: Math.round(fxMarkupPercent * 10000) / 10000,
      effectiveRatePct: Math.round((fee / Math.max(amount,1)) * 10000) / 100,
      totalCost: Math.round((amount + fee) * 100) / 100,
      recipientGets: recipientRate == null ? null : Math.round((amount * recipientRate) * 100) / 100,
      speedMinutes,
      score: scoreRoute(fee, amount, speedMinutes, row.priority, reliability),
      reliabilityPercent: reliability,
      intermediaryBanks: row.intermediary_banks ?? null,
      routeSteps: Array.isArray(row.route_steps) ? row.route_steps : [],
      source: row.source || 'manual',
      sourceUpdatedAt: row.source_updated_at || null,
      isEstimate: true,
      why: [] as string[],
    }]
  }).sort((a,b) => b.score - a.score || a.fee - b.fee)

  if (routes.length) {
    const cheapest = Math.min(...routes.map(r=>r.fee))
    const fastest = Math.min(...routes.map(r=>r.speedMinutes))
    const lowestFx = Math.min(...routes.map(r=>r.fxMarkup))
    for (const route of routes) {
      if (route.fee === cheapest) route.why?.push('LOWEST_COST')
      if (route.speedMinutes === fastest) route.why?.push('FASTEST')
      if (route.fxMarkup === lowestFx) route.why?.push('LOW_FX_MARKUP')
      if (route.score >= 85) route.why?.push('HIGH_SCORE')
    }
  }
  return routes
}

export function estimatedSaving(routes: QuoteRoute[]) {
  if (routes.length < 2) return 0
  const best = routes[0].fee
  const highest = Math.max(...routes.map((route) => route.fee))
  return Math.max(0, Math.round((highest - best) * 100) / 100)
}
