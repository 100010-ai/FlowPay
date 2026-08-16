import type { Language } from './types'

const localeMap: Record<Language, string> = {
  ru: 'ru-RU',
  en: 'en-US',
  fr: 'fr-FR',
  de: 'de-DE',
  es: 'es-ES',
}

// Full ISO 3166-1 alpha-2 country/territory coverage. Names are localized at runtime with Intl.DisplayNames.
export const countryCodes = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AQ','AR','AS','AT','AU','AW','AX','AZ','BA','BB','BD','BE','BF','BG',
  'BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BV','BW','BY','BZ','CA','CC','CD','CF','CG','CH','CI',
  'CK','CL','CM','CN','CO','CR','CU','CV','CW','CX','CY','CZ','DE','DJ','DK','DM','DO','DZ','EC','EE','EG','EH',
  'ER','ES','ET','FI','FJ','FK','FM','FO','FR','GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ',
  'GR','GS','GT','GU','GW','GY','HK','HM','HN','HR','HT','HU','ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP','KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ','LA','LB','LC','LI','LK','LR','LS',
  'LT','LU','LV','LY','MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU',
  'MV','MW','MX','MY','MZ','NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ','OM','PA','PE','PF','PG',
  'PH','PK','PL','PM','PN','PR','PS','PT','PW','PY','QA','RE','RO','RS','RU','RW','SA','SB','SC','SD','SE','SG',
  'SH','SI','SJ','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ','TC','TD','TF','TG','TH','TJ','TK',
  'TL','TM','TN','TO','TR','TT','TV','TW','TZ','UA','UG','UM','US','UY','UZ','VA','VC','VE','VG','VI','VN','VU',
  'WF','WS','YE','YT','ZA','ZM','ZW',
] as const

export const currencies = [
  'AED','AFN','ALL','AMD','ANG','AOA','ARS','AUD','AWG','AZN','BAM','BBD','BDT','BGN','BHD','BIF','BMD','BND','BOB','BRL','BSD','BTN','BWP','BYN','BZD',
  'CAD','CDF','CHF','CLP','CNY','COP','CRC','CUP','CVE','CZK','DJF','DKK','DOP','DZD','EGP','ERN','ETB','EUR','FJD','FKP','GBP','GEL','GHS','GIP','GMD','GNF','GTQ','GYD',
  'HKD','HNL','HRK','HTG','HUF','IDR','ILS','INR','IQD','IRR','ISK','JMD','JOD','JPY','KES','KGS','KHR','KMF','KRW','KWD','KZT','LAK','LBP','LKR','LRD','LSL','LYD','MAD','MDL','MGA','MKD','MMK','MNT','MOP','MRU','MUR','MVR','MWK','MXN','MYR','MZN',
  'NAD','NGN','NIO','NOK','NPR','NZD','OMR','PAB','PEN','PGK','PHP','PKR','PLN','PYG','QAR','RON','RSD','RUB','RWF','SAR','SBD','SCR','SDG','SEK','SGD','SHP','SLE','SOS','SRD','SSP','STN','SYP','SZL',
  'THB','TJS','TMT','TND','TOP','TRY','TTD','TWD','TZS','UAH','UGX','USD','UYU','UZS','VES','VND','VUV','WST','XAF','XCD','XOF','XPF','YER','ZAR','ZMW','ZWL',
] as const

const staticCountryNames: Record<string, string> = {
  AE: 'United Arab Emirates', AL: 'Albania', AM: 'Armenia', AO: 'Angola', AR: 'Argentina', AT: 'Austria', AU: 'Australia', AZ: 'Azerbaijan', BA: 'Bosnia & Herzegovina', BD: 'Bangladesh', BE: 'Belgium', BG: 'Bulgaria', BH: 'Bahrain', BO: 'Bolivia', BR: 'Brazil', BY: 'Belarus', CA: 'Canada', CH: 'Switzerland', CL: 'Chile', CM: 'Cameroon', CN: 'China', CO: 'Colombia', CR: 'Costa Rica', CY: 'Cyprus', CZ: 'Czechia', DE: 'Germany', DK: 'Denmark', DO: 'Dominican Republic', DZ: 'Algeria', EC: 'Ecuador', EE: 'Estonia', EG: 'Egypt', ES: 'Spain', ET: 'Ethiopia', FI: 'Finland', FR: 'France', GB: 'United Kingdom', GE: 'Georgia', GH: 'Ghana', GR: 'Greece', GT: 'Guatemala', HK: 'Hong Kong', HN: 'Honduras', HR: 'Croatia', HU: 'Hungary', ID: 'Indonesia', IE: 'Ireland', IL: 'Israel', IN: 'India', IS: 'Iceland', IT: 'Italy', JO: 'Jordan', JP: 'Japan', KE: 'Kenya', KG: 'Kyrgyzstan', KH: 'Cambodia', KR: 'South Korea', KW: 'Kuwait', KZ: 'Kazakhstan', LB: 'Lebanon', LK: 'Sri Lanka', LT: 'Lithuania', LU: 'Luxembourg', LV: 'Latvia', MA: 'Morocco', MD: 'Moldova', ME: 'Montenegro', MK: 'North Macedonia', MN: 'Mongolia', MT: 'Malta', MU: 'Mauritius', MX: 'Mexico', MY: 'Malaysia', NG: 'Nigeria', NL: 'Netherlands', NO: 'Norway', NP: 'Nepal', NZ: 'New Zealand', OM: 'Oman', PA: 'Panama', PE: 'Peru', PH: 'Philippines', PK: 'Pakistan', PL: 'Poland', PT: 'Portugal', PY: 'Paraguay', QA: 'Qatar', RO: 'Romania', RS: 'Serbia', RW: 'Rwanda', SA: 'Saudi Arabia', SE: 'Sweden', SG: 'Singapore', SI: 'Slovenia', SK: 'Slovakia', SN: 'Senegal', TH: 'Thailand', TN: 'Tunisia', TR: 'Türkiye', TW: 'Taiwan', TZ: 'Tanzania', UA: 'Ukraine', UG: 'Uganda', US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan', VE: 'Venezuela', VN: 'Vietnam', ZA: 'South Africa', ZM: 'Zambia', ZW: 'Zimbabwe',
}

export function localeForLanguage(lang: Language) {
  return localeMap[lang]
}

export function countryFlag(code: string) {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

export function countryName(code: string, lang: Language) {
  try {
    const display = new Intl.DisplayNames([localeMap[lang]], { type: 'region' })
    return display.of(code.toUpperCase()) || staticCountryNames[code] || code
  } catch {
    return staticCountryNames[code] || code
  }
}

export function countryOptions(lang: Language) {
  return countryCodes
    .map((code) => [code, countryName(code, lang)] as const)
    .sort((a, b) => a[1].localeCompare(b[1], localeMap[lang]))
}

export function currencySymbol(code: string, lang: Language) {
  try {
    const parts = new Intl.NumberFormat(localeMap[lang], { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' }).formatToParts(0)
    return parts.find((part) => part.type === 'currency')?.value || code
  } catch {
    return code
  }
}

export function currencyName(code: string, lang: Language) {
  try {
    const parts = new Intl.NumberFormat(localeMap[lang], { style: 'currency', currency: code, currencyDisplay: 'name' }).formatToParts(0)
    return parts.find((part) => part.type === 'currency')?.value || code
  } catch {
    return code
  }
}

export function currencyOptions(lang: Language) {
  return currencies.map((code) => ({
    code,
    symbol: currencySymbol(code, lang),
    name: currencyName(code, lang),
  }))
}

const countryCurrencyMap: Record<string, string> = {
  AE:'AED',AL:'ALL',AM:'AMD',AO:'AOA',AR:'ARS',AT:'EUR',AU:'AUD',AZ:'AZN',BA:'BAM',BD:'BDT',BE:'EUR',BG:'BGN',BH:'BHD',BO:'BOB',BR:'BRL',BY:'BYN',CA:'CAD',CH:'CHF',CL:'CLP',CM:'XAF',CN:'CNY',CO:'COP',CR:'CRC',CY:'EUR',CZ:'CZK',DE:'EUR',DK:'DKK',DO:'DOP',DZ:'DZD',EC:'USD',EE:'EUR',EG:'EGP',ES:'EUR',ET:'ETB',FI:'EUR',FR:'EUR',GB:'GBP',GE:'GEL',GH:'GHS',GR:'EUR',GT:'GTQ',HK:'HKD',HN:'HNL',HR:'EUR',HU:'HUF',ID:'IDR',IE:'EUR',IL:'ILS',IN:'INR',IS:'ISK',IT:'EUR',JO:'JOD',JP:'JPY',KE:'KES',KG:'KGS',KH:'KHR',KR:'KRW',KW:'KWD',KZ:'KZT',LB:'LBP',LK:'LKR',LT:'EUR',LU:'EUR',LV:'EUR',MA:'MAD',MD:'MDL',ME:'EUR',MK:'MKD',MN:'MNT',MT:'EUR',MU:'MUR',MX:'MXN',MY:'MYR',NG:'NGN',NL:'EUR',NO:'NOK',NP:'NPR',NZ:'NZD',OM:'OMR',PA:'USD',PE:'PEN',PH:'PHP',PK:'PKR',PL:'PLN',PT:'EUR',PY:'PYG',QA:'QAR',RO:'RON',RS:'RSD',RW:'RWF',SA:'SAR',SE:'SEK',SG:'SGD',SI:'EUR',SK:'EUR',SN:'XOF',TH:'THB',TN:'TND',TR:'TRY',TW:'TWD',TZ:'TZS',UA:'UAH',UG:'UGX',US:'USD',UY:'UYU',UZ:'UZS',VE:'VES',VN:'VND',ZA:'ZAR',ZM:'ZMW',ZW:'USD',
}

export function defaultCurrencyForCountry(code: string) {
  return countryCurrencyMap[code.toUpperCase()] || ''
}

export function isSupportedCountry(code: string) {
  return (countryCodes as readonly string[]).includes(code.toUpperCase())
}

export function isSupportedCurrency(code: string) {
  return (currencies as readonly string[]).includes(code.toUpperCase())
}
