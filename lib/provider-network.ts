import { countryCodes, currencies } from './countries'

/**
 * Documented provider-network reach only.
 *
 * This catalog is deliberately separated from provider_rules. A provider being
 * listed here does NOT make it eligible for quote routing. Quotes are produced
 * exclusively from active provider_rules with verified pricing and route data.
 */
export type ProviderNetworkProfile = {
  code: string
  name: string
  markets: number | null
  marketsPlus: boolean
  currencies: number | null
  currenciesPlus: boolean
  capability: 'bank_payouts' | 'business_payments' | 'payment_infrastructure' | 'multi_currency'
  sourceUrl: string
  sourceLabel: string
  verifiedAt: string
  note: string
}

const VERIFIED_AT = '2026-08-17'

export const providerNetworkCatalog: readonly ProviderNetworkProfile[] = [
  {
    code: 'wise',
    name: 'Wise Business',
    markets: null,
    marketsPlus: false,
    currencies: 40,
    currenciesPlus: true,
    capability: 'multi_currency',
    sourceUrl: 'https://wise.com/help/articles/2897238/which-currencies-can-i-add-keep-and-receive-in-my-wise-account',
    sourceLabel: 'Wise Help Centre',
    verifiedAt: VERIFIED_AT,
    note: '40+ account currencies; exact send availability depends on the route and account region.',
  },
  {
    code: 'airwallex',
    name: 'Airwallex',
    markets: 200,
    marketsPlus: true,
    currencies: 90,
    currenciesPlus: true,
    capability: 'bank_payouts',
    sourceUrl: 'https://www.airwallex.com/docs/payouts/payout-network/bank-accounts',
    sourceLabel: 'Airwallex Docs',
    verifiedAt: VERIFIED_AT,
    note: 'Local and SWIFT bank payouts; local clearing is available in a subset of markets.',
  },
  {
    code: 'revolut_business',
    name: 'Revolut Business',
    markets: null,
    marketsPlus: false,
    currencies: 27,
    currenciesPlus: false,
    capability: 'business_payments',
    sourceUrl: 'https://developer.revolut.com/docs/guides/build-banking-apps/tutorials/work-with-draft-payments',
    sourceLabel: 'Revolut Developer',
    verifiedAt: VERIFIED_AT,
    note: 'Published draft-payment currency list; destination support is intended to be checked dynamically.',
  },
  {
    code: 'currencycloud',
    name: 'Currencycloud',
    markets: 212,
    marketsPlus: true,
    currencies: 37,
    currenciesPlus: false,
    capability: 'payment_infrastructure',
    sourceUrl: 'https://developer.currencycloud.com/guides/integration-guides/make-simple-payments/',
    sourceLabel: 'Currencycloud Developer',
    verifiedAt: VERIFIED_AT,
    note: 'Priority/SWIFT reach exceeds 212 countries; payment currency availability is product-specific.',
  },
  {
    code: 'nium',
    name: 'Nium',
    markets: 190,
    marketsPlus: true,
    currencies: null,
    currenciesPlus: false,
    capability: 'payment_infrastructure',
    sourceUrl: 'https://docs.nium.com/docs/payouts',
    sourceLabel: 'Nium Docs',
    verifiedAt: VERIFIED_AT,
    note: 'Payout network supports bank, card, wallet and selected cash-pickup endpoints.',
  },
  {
    code: 'corpay',
    name: 'Corpay Cross-Border',
    markets: 200,
    marketsPlus: true,
    currencies: 145,
    currenciesPlus: true,
    capability: 'business_payments',
    sourceUrl: 'https://www.corpay.com/en-GB/cross-border/global-payments/integrated-payments',
    sourceLabel: 'Corpay',
    verifiedAt: VERIFIED_AT,
    note: 'Global cross-border payment network; local/same-day availability varies by currency and country.',
  },
  {
    code: 'convera',
    name: 'Convera',
    markets: 200,
    marketsPlus: true,
    currencies: 140,
    currenciesPlus: false,
    capability: 'business_payments',
    sourceUrl: 'https://convera.com/platform/payment-network/',
    sourceLabel: 'Convera',
    verifiedAt: VERIFIED_AT,
    note: 'Cross-border network with local and correspondent payment channels.',
  },
  {
    code: 'ofx',
    name: 'OFX',
    markets: 170,
    marketsPlus: true,
    currencies: 50,
    currenciesPlus: true,
    capability: 'business_payments',
    sourceUrl: 'https://www.ofx.com/en-us/faqs/where-can-i-make-a-transfer-to/',
    sourceLabel: 'OFX',
    verifiedAt: VERIFIED_AT,
    note: 'Business and international transfer reach; availability varies by customer jurisdiction.',
  },
  {
    code: 'worldfirst',
    name: 'WorldFirst',
    markets: 210,
    marketsPlus: true,
    currencies: 100,
    currenciesPlus: true,
    capability: 'business_payments',
    sourceUrl: 'https://www.worldfirst.com/uk/product/pay/pay-business-partners/',
    sourceLabel: 'WorldFirst',
    verifiedAt: VERIFIED_AT,
    note: 'Supplier/business payments via local networks or SWIFT depending on the transaction.',
  },
  {
    code: 'thunes',
    name: 'Thunes',
    markets: 140,
    marketsPlus: true,
    currencies: 90,
    currenciesPlus: true,
    capability: 'payment_infrastructure',
    sourceUrl: 'https://www.thunes.com/',
    sourceLabel: 'Thunes',
    verifiedAt: VERIFIED_AT,
    note: 'Direct Global Network; B2B availability can be narrower than the full network footprint.',
  },
  {
    code: 'banking_circle',
    name: 'Banking Circle',
    markets: null,
    marketsPlus: false,
    currencies: 24,
    currenciesPlus: false,
    capability: 'payment_infrastructure',
    sourceUrl: 'https://www.bankingcircle.com/payments/',
    sourceLabel: 'Banking Circle',
    verifiedAt: VERIFIED_AT,
    note: 'Payments infrastructure with local and cross-border capabilities in 24 currencies.',
  },
  {
    code: 'payoneer',
    name: 'Payoneer',
    markets: 190,
    marketsPlus: true,
    currencies: 70,
    currenciesPlus: false,
    capability: 'multi_currency',
    sourceUrl: 'https://www.payoneer.com/business/',
    sourceLabel: 'Payoneer',
    verifiedAt: VERIFIED_AT,
    note: 'Published withdrawal/global account reach; individual payment products have their own eligibility.',
  },
  {
    code: 'ibanfirst',
    name: 'iBanFirst',
    markets: 180,
    marketsPlus: true,
    currencies: 135,
    currenciesPlus: true,
    capability: 'business_payments',
    sourceUrl: 'https://ibanfirst.com/currency-reference-centre',
    sourceLabel: 'iBanFirst',
    verifiedAt: VERIFIED_AT,
    note: 'Cross-border business payments across major and emerging-market currencies.',
  },
] as const

export function getProviderNetworkCoverage() {
  const marketValues = providerNetworkCatalog.flatMap(provider => provider.markets == null ? [] : [provider.markets])
  const currencyValues = providerNetworkCatalog.flatMap(provider => provider.currencies == null ? [] : [provider.currencies])
  return {
    providers: providerNetworkCatalog.length,
    markets: Math.max(...marketValues),
    marketsPlus: providerNetworkCatalog.some(provider => provider.markets === Math.max(...marketValues) && provider.marketsPlus),
    currencies: Math.max(...currencyValues),
    currenciesPlus: providerNetworkCatalog.some(provider => provider.currencies === Math.max(...currencyValues) && provider.currenciesPlus),
    platformCountries: countryCodes.length,
    platformCurrencies: currencies.length,
    verifiedAt: VERIFIED_AT,
    providersDetail: providerNetworkCatalog,
  }
}
