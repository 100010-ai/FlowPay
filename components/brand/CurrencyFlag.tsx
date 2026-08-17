import { CircleDollarSign } from 'lucide-react'
import { CountryFlag } from '@/components/brand/CountryFlag'
import { currencyFlagCountry } from '@/lib/countries'
import { cn } from '@/lib/utils'

export function CurrencyFlag({currency,className}:{currency?:string|null;className?:string}) {
  const country=currency?currencyFlagCountry(currency):null
  if(!country) return <span className={cn('grid h-[18px] w-[24px] shrink-0 place-items-center rounded-[4px] bg-[#eef2ed] text-[var(--fp-muted)]',className)}><CircleDollarSign size={13}/></span>
  return <CountryFlag code={country} title={currency||country} className={cn('h-[18px] w-[24px] rounded-[4px]',className)}/>
}
