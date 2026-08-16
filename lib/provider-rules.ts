import { unstable_cache, revalidateTag } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ProviderRuleSummary, RouteStep } from '@/lib/types'

export type ProviderRuleRow = {
  id: string
  provider_code: string
  display_name: string | null
  from_country: string
  to_country: string
  currencies: string[]
  fee_percent: number | string
  fixed_fee: number | string
  fx_markup_percent: number | string
  speed_minutes: number
  min_amount: number | string
  max_amount: number | string
  priority: number
  reliability_percent: number | string | null
  intermediary_banks: number | null
  route_steps: RouteStep[] | null
  source: string | null
  source_updated_at: string | null
}

const select = 'id,provider_code,display_name,from_country,to_country,currencies,fee_percent,fixed_fee,fx_markup_percent,speed_minutes,min_amount,max_amount,priority,reliability_percent,intermediary_banks,route_steps,source,source_updated_at'

const cachedCorridorRules = unstable_cache(async (fromCountry: string, toCountry: string) => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('provider_rules')
    .select(select)
    .eq('active', true)
    .in('from_country', [fromCountry, '*'])
    .in('to_country', [toCountry, '*'])
    .limit(2000)
  if (error) throw error
  if (!data) throw new Error('PROVIDER_RULES_EMPTY_RESPONSE')
  return data as ProviderRuleRow[]
}, ['flowpay-provider-rules-v13'], { revalidate: 60, tags: ['provider-rules'] })

export async function getEligibleProviderRules(input: {
  fromCountry: string
  toCountry: string
  sourceCurrency: string
  recipientCurrency: string
  amount: number
}) {
  const rows = await cachedCorridorRules(input.fromCountry, input.toCountry)
  const required = new Set([input.sourceCurrency, input.recipientCurrency])
  return rows.filter(row => {
    if (!Array.isArray(row.currencies)) throw new Error(`PROVIDER_RULE_INVALID_CURRENCIES:${row.id}`)
    const currencies = new Set(row.currencies.map(value => value.toUpperCase()))
    if ([...required].some(currency => !currencies.has(currency))) return false
    const min = Number(row.min_amount)
    const max = Number(row.max_amount)
    return Number.isFinite(min) && Number.isFinite(max) && input.amount >= min && input.amount <= max
  })
}

const cachedCoverageRules = unstable_cache(async () => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('provider_rules')
    .select('provider_code,display_name,from_country,to_country,currencies')
    .eq('active', true)
    .limit(5000)
  if (error) throw error
  if (!data) throw new Error('PROVIDER_COVERAGE_EMPTY_RESPONSE')
  return data
}, ['flowpay-provider-coverage-v13'], { revalidate: 300, tags: ['provider-rules'] })

export async function getProviderCoverage() {
  const rules = await cachedCoverageRules()
  const publicRules = rules.filter(rule => Boolean(rule.display_name)).slice(0, 3).map(rule => ({
    provider_code: rule.provider_code,
    display_name: rule.display_name,
    from_country: rule.from_country,
    to_country: rule.to_country,
    currencies: rule.currencies,
  }))
  return {
    providers: new Set(rules.map(rule => rule.provider_code)).size,
    corridors: new Set(rules.map(rule => `${rule.from_country}:${rule.to_country}`)).size,
    currencies: new Set(rules.flatMap(rule => rule.currencies)).size,
    rules: publicRules,
  }
}

export function invalidateProviderRuleCache() {
  revalidateTag('provider-rules')
}


const cachedProviderRuleSummaries = unstable_cache(async () => {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('provider_rules')
    .select('id,provider_code,display_name,from_country,to_country,currencies,active,source_updated_at')
    .eq('active', true)
    .order('priority', { ascending: true })
    .order('provider_code', { ascending: true })
    .limit(5000)
  if (error) throw error
  if (!data) throw new Error('PROVIDER_SUMMARIES_EMPTY_RESPONSE')
  return data as ProviderRuleSummary[]
}, ['flowpay-provider-rule-summaries-v13'], { revalidate: 60, tags: ['provider-rules'] })

/**
 * Returns provider-rule metadata for API/UI consumers without exposing fees,
 * internal routing weights, or other sensitive rule fields.
 */
export async function getProviderRuleSummaries() {
  return cachedProviderRuleSummaries()
}
