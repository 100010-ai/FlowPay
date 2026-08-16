import { z } from 'zod'
import { isSupportedCountry, isSupportedCurrency } from './countries'

const country = z.string().trim().toUpperCase().refine(isSupportedCountry, 'UNSUPPORTED_COUNTRY')
const currency = z.string().trim().toUpperCase().refine(isSupportedCurrency, 'UNSUPPORTED_CURRENCY')
const quoteFields = {
  fromCountry: country,
  toCountry: country,
  amount: z.coerce.number().finite().positive().max(10_000_000),
  sourceCurrency: currency,
  recipientCurrency: currency,
}

export const quoteSchema = z.object(quoteFields).refine(
  (value) => value.fromCountry !== value.toCountry,
  { message: 'SAME_COUNTRY', path: ['toCountry'] },
)

export const auditSchema = z.object({
  ...quoteFields,
  email: z.string().trim().toLowerCase().email().max(254),
  actualFee: z.coerce.number().finite().min(0).max(10_000_000),
  website: z.string().optional().default(''),
}).superRefine((value, ctx) => {
  if (value.fromCountry === value.toCountry) {
    ctx.addIssue({ code: 'custom', message: 'SAME_COUNTRY', path: ['toCountry'] })
  }
  if (value.actualFee > value.amount) {
    ctx.addIssue({ code: 'custom', message: 'FEE_EXCEEDS_AMOUNT', path: ['actualFee'] })
  }
})

export const profileSchema = z.object({
  name: z.string().trim().max(160),
  registration_number: z.string().trim().max(100),
  business_address: z.string().trim().max(300),
  country,
  preferred_currency: currency,
})
