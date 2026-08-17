import { NextResponse } from 'next/server'
import { getProviderRuleSummaries } from '@/lib/provider-rules'

export const dynamic='force-dynamic'

export async function GET(){
  try{
    const rules=await getProviderRuleSummaries()
    // Public catalogue intentionally exposes only what the product UI needs.
    // Internal source labels and database identifiers never leave this route.
    const providers=rules.map(rule=>({
      provider_code:rule.provider_code,
      display_name:rule.display_name,
      from_country:rule.from_country,
      to_country:rule.to_country,
      currencies:rule.currencies,
      source_updated_at:rule.source_updated_at,
    }))
    return NextResponse.json({providers},{headers:{'Cache-Control':'public, s-maxage=300','X-Content-Type-Options':'nosniff'}})
  }catch{
    return NextResponse.json({error:'PROVIDERS_UNAVAILABLE'},{status:503,headers:{'Cache-Control':'no-store'}})
  }
}
