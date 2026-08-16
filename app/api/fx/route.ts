import { NextResponse } from 'next/server'
import { getReferenceFx } from '@/lib/fx'
import { isSupportedCurrency } from '@/lib/countries'

export const revalidate = 21600

export async function GET(request: Request) {
  const url = new URL(request.url)
  const source = (url.searchParams.get('source') || 'EUR').toUpperCase()
  const target = (url.searchParams.get('target') || 'USD').toUpperCase()
  if (!isSupportedCurrency(source) || !isSupportedCurrency(target)) return NextResponse.json({ error:'INVALID_CURRENCY' }, { status:400 })
  const rate = await getReferenceFx(source, target)
  if (!rate) return NextResponse.json({ error:'RATE_UNAVAILABLE' }, { status:404 })
  return NextResponse.json(rate)
}
