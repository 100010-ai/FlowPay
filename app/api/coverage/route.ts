import { NextResponse } from 'next/server'
import { getProviderCoverage } from '@/lib/provider-rules'

export const revalidate = 300

export async function GET() {
  try {
    const coverage = await getProviderCoverage()
    return NextResponse.json({ coverage }, { headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=900' } })
  } catch {
    return NextResponse.json({ error: 'COVERAGE_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
