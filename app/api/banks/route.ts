import { apiJson, requestId } from '@/lib/http'
import { isSupportedCountry } from '@/lib/countries'
import { requireAal2 } from '@/lib/server-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { curatedBanks, safeWikimediaLogo, type BankDirectoryEntry } from '@/lib/bank-directory'

export const dynamic='force-dynamic'

type Binding={bank?:{value?:string};bankLabel?:{value?:string};bic?:{value?:string};website?:{value?:string};logo?:{value?:string}}
type WikidataResponse={results?:{bindings?:Binding[]}}

function langCode(value:string|null){return ['ru','en','fr','de','es'].includes(value||'')?(value as 'ru'|'en'|'fr'|'de'|'es'):'en'}
function website(value:string|undefined){if(!value)return null;try{const u=new URL(value);return u.protocol==='https:'||u.protocol==='http:'?u.toString():null}catch{return null}}
function dedupe(rows:BankDirectoryEntry[]){const seen=new Set<string>();return rows.filter(row=>{const key=row.name.trim().toLocaleLowerCase();if(!key||seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,120)}

async function wikidataBanks(country:string,lang:string):Promise<BankDirectoryEntry[]>{
  const query=`SELECT ?bank ?bankLabel (SAMPLE(?bicValue) AS ?bic) (SAMPLE(?websiteValue) AS ?website) (SAMPLE(?logoValue) AS ?logo) WHERE {\n  ?country wdt:P297 "${country}".\n  ?bank wdt:P17 ?country; wdt:P31/wdt:P279* wd:Q22687.\n  OPTIONAL { ?bank wdt:P2627 ?bicValue. }\n  OPTIONAL { ?bank wdt:P856 ?websiteValue. }\n  OPTIONAL { ?bank wdt:P154 ?logoValue. }\n  SERVICE wikibase:label { bd:serviceParam wikibase:language "${lang},en". ?bank rdfs:label ?bankLabel. }\n} GROUP BY ?bank ?bankLabel LIMIT 120`
  const url=new URL('https://query.wikidata.org/sparql')
  url.searchParams.set('query',query)
  url.searchParams.set('format','json')
  const response=await fetch(url,{headers:{Accept:'application/sparql-results+json','User-Agent':'FlowPay/2.0 bank-directory (https://flowpay-network.vercel.app/security)'},next:{revalidate:86_400},signal:AbortSignal.timeout(5_500)})
  if(!response.ok)throw new Error(`WIKIDATA_${response.status}`)
  const payload=await response.json() as WikidataResponse
  return dedupe((payload.results?.bindings||[]).map(row=>({
    id:`wikidata:${row.bank?.value?.split('/').pop()||crypto.randomUUID()}`,
    name:(row.bankLabel?.value||'').trim(),
    bic:(row.bic?.value||'').trim().toUpperCase()||null,
    website:website(row.website?.value),
    logoUrl:safeWikimediaLogo(row.logo?.value),
    source:'wikidata' as const,
  })).filter(row=>row.name))
}

export async function GET(request:Request){
  const reqId=requestId(request)
  const auth=await requireAal2(request)
  if(!auth.ok)return apiJson({error:auth.code,requestId:reqId},auth.code==='MFA_REQUIRED'?403:401,{'X-Request-ID':reqId})
  const limited=await checkRateLimit(request,'bank-directory',40,60,{subject:auth.auth.user.id})
  if(!limited.available)return apiJson({error:'RATE_LIMIT_UNAVAILABLE',requestId:reqId},503,{'X-Request-ID':reqId})
  if(!limited.allowed)return apiJson({error:'RATE_LIMITED',requestId:reqId},429,{'X-Request-ID':reqId})
  const url=new URL(request.url)
  const country=(url.searchParams.get('country')||'').trim().toUpperCase()
  if(!isSupportedCountry(country))return apiJson({error:'INVALID_COUNTRY',requestId:reqId},400,{'X-Request-ID':reqId})
  const lang=langCode(url.searchParams.get('lang'))
  const fallback=curatedBanks(country)
  try{
    const remote=await wikidataBanks(country,lang)
    const banks=dedupe([...remote,...fallback])
    return apiJson({country,banks,source:remote.length?'wikidata':'curated',requestId:reqId},200,{'X-Request-ID':reqId})
  }catch{
    return apiJson({country,banks:fallback,source:'curated',degraded:true,requestId:reqId},200,{'X-Request-ID':reqId})
  }
}
