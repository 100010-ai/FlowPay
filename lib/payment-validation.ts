const ibanCountries = new Set(['AL','AD','AT','AZ','BH','BY','BE','BA','BR','BG','CR','HR','CY','CZ','DK','DO','EE','FO','FI','FR','GE','DE','GI','GR','GL','GT','HU','IS','IE','IL','IT','JO','KZ','XK','KW','LV','LB','LI','LT','LU','MK','MT','MR','MU','MD','MC','ME','NL','NO','PK','PS','PL','PT','QA','RO','SM','SA','RS','SK','SI','ES','SE','CH','TN','TR','AE','GB','VA'])

export function normalizeIban(value: string) {
  return value.replace(/\s+/g, '').toUpperCase()
}

export function countryUsesIban(country: string) {
  return ibanCountries.has(country.trim().toUpperCase())
}

export function isValidIban(value: string) {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$/.test(iban)) return false
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const numeric = ch >= 'A' && ch <= 'Z' ? String(ch.charCodeAt(0) - 55) : ch
    for (const digit of numeric) remainder = (remainder * 10 + Number(digit)) % 97
  }
  return remainder === 1
}

export function isValidBic(value: string) {
  const bic = value.replace(/\s+/g, '').toUpperCase()
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic)
}

export function formatIban(value: string) {
  return normalizeIban(value).replace(/(.{4})/g, '$1 ').trim()
}

export type BankDetailsState = 'details_ready' | 'details_missing' | 'details_invalid'

export function bankDetailsState(bankCountry: string | null | undefined, accountNumber: string | null | undefined, bic: string | null | undefined): BankDetailsState {
  const country=(bankCountry||'').trim().toUpperCase()
  const account=(accountNumber||'').trim()
  const swift=(bic||'').trim()
  if (!country || !account) return 'details_missing'
  if (countryUsesIban(country) && !isValidIban(account)) return 'details_invalid'
  if (!countryUsesIban(country) && account.replace(/\s+/g,'').length < 4) return 'details_invalid'
  if (swift && !isValidBic(swift)) return 'details_invalid'
  return 'details_ready'
}
