'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Clipboard, Code2, KeyRound, Loader2, Play, Plus, Send, ShieldCheck, ShieldX, TriangleAlert } from 'lucide-react'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
import { useLanguage } from '@/components/LanguageContext'
import { workspaceDictionaries } from '@/lib/workspace-i18n'
import { workspaceCopy } from '@/lib/workspace-copy'
import { PageHeader, EmptyState, MetricCard, StatusBadge } from '@/components/workspace/primitives'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { CountryFlag } from '@/components/brand/CountryFlag'
import { CurrencyFlag } from '@/components/brand/CurrencyFlag'
import { countryOptions, currencyOptions } from '@/lib/countries'
import { relativeDate } from '@/lib/metrics'
import { userError } from '@/lib/user-error'

type PlaygroundResult={status:number;duration:number;body:unknown}|null
type HealthState={ok:boolean;status:string;checks:{application:boolean;database:boolean;routing:boolean};timestamp:string}|null

export default function ApiPage(){
  const ws=useWorkspace()
  const {lang}=useLanguage()
  const router=useRouter()
  const t=workspaceDictionaries[lang]
  const copy=workspaceCopy[lang]
  const [error,setError]=useState('')
  const [origin,setOrigin]=useState('https://flowpay-network.vercel.app')
  const [playKey,setPlayKey]=useState('')
  const [fromCountry,setFromCountry]=useState(ws.profile?.country||'FR')
  const [toCountry,setToCountry]=useState('TR')
  const [sourceCurrency,setSourceCurrency]=useState(ws.profile?.preferred_currency||'EUR')
  const [recipientCurrency,setRecipientCurrency]=useState('TRY')
  const [amount,setAmount]=useState('25000')
  const [playing,setPlaying]=useState(false)
  const [playResult,setPlayResult]=useState<PlaygroundResult>(null)
  const [health,setHealth]=useState<HealthState>(null)

  useEffect(()=>{
    setOrigin(window.location.origin)
    fetch('/api/health',{cache:'no-store'}).then(async response=>await response.json() as HealthState).then(setHealth).catch(()=>setHealth(null))
  },[])

  const active=ws.apiKeys.filter(k=>!k.revoked_at&&new Date(k.expires_at).getTime()>Date.now())
  const stats=useMemo(()=>ws.apiUsage.reduce((acc,row)=>({total:acc.total+Number(row.request_count),success:acc.success+Number(row.success_count),errors:acc.errors+Number(row.error_count)}),{total:0,success:0,errors:0}),[ws.apiUsage])
  const countries=useMemo(()=>countryOptions(lang).map(([code,label])=>({value:code,label,description:code,leading:<CountryFlag code={code}/>})),[lang])
  const currencies=useMemo(()=>currencyOptions(lang).map(item=>({value:item.code,label:item.code,description:item.name,leading:<CurrencyFlag currency={item.code}/>})),[lang])

  async function authToken(){const mod=await import('@/lib/supabase/client');const {data}=await mod.createClient().auth.getSession();return data.session?.access_token||''}


  async function revoke(id:string){
    if(!confirm(lang==='ru'?'Отозвать этот API-ключ?':'Revoke this API key?'))return
    setError('')
    try{
      const accessToken=await authToken();if(!accessToken)throw new Error('UNAUTHORIZED')
      const res=await fetch('/api/keys',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${accessToken}`},body:JSON.stringify({id})})
      if(!res.ok)throw new Error('KEY_REVOKE_FAILED');await ws.refresh()
    }catch{setError(userError(lang,'api'))}
  }

  async function runPlayground(){
    if(!playKey.trim()||!fromCountry||!toCountry||!sourceCurrency||!recipientCurrency||Number(amount)<=0||playing)return
    setPlaying(true);setPlayResult(null)
    const started=performance.now()
    try{
      const response=await fetch('/api/v1/quote',{method:'POST',headers:{Authorization:`Bearer ${playKey.trim()}`,'Content-Type':'application/json'},body:JSON.stringify({fromCountry,toCountry,amount:Number(amount),sourceCurrency,recipientCurrency})})
      let body:unknown
      try{body=await response.json()}catch{body={error:'NON_JSON_RESPONSE'}}
      setPlayResult({status:response.status,duration:Math.round(performance.now()-started),body})
      await ws.refresh()
    }catch{
      setPlayResult({status:0,duration:Math.round(performance.now()-started),body:{error:'NETWORK_ERROR'}})
    }finally{setPlaying(false)}
  }

  const curl=`curl -X POST ${origin}/api/v1/quote \\\n  -H "Authorization: Bearer $FLOWPAY_API_KEY" \\\n  -H "Content-Type: application/json" \\\n  -d '{"fromCountry":"${fromCountry}","toCountry":"${toCountry}","amount":${Number(amount)||0},"sourceCurrency":"${sourceCurrency}","recipientCurrency":"${recipientCurrency}"}'`

  return <div className="fp-enter">
    <PageHeader title={t.api.title} subtitle={t.api.subtitle} actions={<Button onClick={()=>router.push('/developer/keys/new')}><Plus size={15}/>{t.api.create}</Button>}/>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label={copy.api.activeKeys} value={String(active.length)} meta={lang==='ru'?'доступны для интеграций':'available for integrations'} icon={<KeyRound size={16}/>}/>
      <MetricCard label={copy.api.requests} value={String(stats.total)} meta={lang==='ru'?'точный счётчик использования':'exact usage counter'} icon={<Code2 size={16}/>}/>
      <MetricCard label={copy.api.success} value={stats.total?`${Math.round(stats.success/stats.total*100)}%`:'0'} meta={stats.total?`${stats.success} ${lang==='ru'?'успешных запросов':'successful requests'}`:(lang==='ru'?'запросов пока нет':'no requests yet')} icon={<CheckCircle2 size={16}/>}/>
      <MetricCard label={lang==='ru'?'Ошибки API':'API errors'} value={String(stats.errors)} meta={stats.errors?(lang==='ru'?'проверьте журнал запросов':'review request log'):(lang==='ru'?'критичных ошибок нет':'no recorded errors')} icon={<TriangleAlert size={16}/>} className={stats.errors?'[&_strong]:text-[var(--fp-red)]':''}/>
    </div>

    <Card className="mt-4 px-5 py-4"><div className="flex flex-col gap-3 md:flex-row md:items-center"><div className="flex items-center gap-2"><span className={`size-2.5 rounded-full ${health?.ok?'bg-[var(--fp-green)]':'bg-[var(--fp-amber)]'}`}/><strong className="text-[14px]">{lang==='ru'?'Состояние API':'API health'}</strong><span className="text-[13px] text-[var(--fp-muted)]">{health?(health.ok?(lang==='ru'?'Работает штатно':'Operational'):(lang==='ru'?'Требует внимания':'Needs attention')):(lang==='ru'?'Проверяем…':'Checking…')}</span></div><div className="flex flex-wrap gap-2 md:ml-auto">{health&&Object.entries(health.checks).map(([key,value])=><Badge key={key} tone={value?'success':'warning'}>{key}: {value?'OK':'DOWN'}</Badge>)}</div></div></Card>

    <div className="mt-4 grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
      <Card className="p-5"><div className="flex items-center justify-between"><h2 className="text-[14px] font-semibold">{t.api.keys}</h2><KeyRound size={16} className="text-[var(--fp-green)]"/></div>{ws.apiKeys.length?<div className="mt-4 divide-y divide-[var(--fp-border)]">{ws.apiKeys.map(k=>{const expired=new Date(k.expires_at).getTime()<=Date.now();const status=k.revoked_at?'revoked':expired?'expired':'active';return <div key={k.id} className="py-3"><div className="flex items-start justify-between gap-3"><div><strong className="block text-[14px]">{k.name}</strong><code className="mt-1 block text-[14px] text-[var(--fp-muted)]">{k.key_prefix}••••••••••</code><span className="mt-1 block text-[11px] text-[var(--fp-subtle)]">scope: {k.scope} · {lang==='ru'?'до':'until'} {new Date(k.expires_at).toLocaleDateString(lang)}</span></div><StatusBadge status={status}/></div><div className="mt-2 flex items-center justify-between"><span className="text-[14px] text-[var(--fp-muted)]">{t.api.lastUsed}: {relativeDate(k.last_used_at,lang)}</span>{!k.revoked_at&&!expired&&<button onClick={()=>revoke(k.id)} className="inline-flex items-center gap-1 text-[14px] font-medium text-[var(--fp-red)]"><ShieldX size={11}/>{t.api.revoke}</button>}</div></div>})}</div>:<div className="mt-4"><EmptyState compact title={t.api.noKeys} description={lang==='ru'?'Создайте ключ, чтобы подключить сервер, CRM или внутренний финансовый сервис.':'Create a key to connect your server, CRM or internal finance system.'} actionLabel={t.api.create} onAction={()=>router.push('/developer/keys/new')}/></div>}</Card>

      <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-[var(--fp-border)] px-5 py-4"><h2 className="text-[14px] font-semibold">{lang==='ru'?'Последние запросы':'Recent requests'}</h2><Code2 size={16} className="text-[var(--fp-green)]"/></div>{ws.apiLogs.length?<div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-[14px]"><thead><tr className="bg-[#fafbf8] text-[var(--fp-muted)]"><th className="px-4 py-3">{copy.api.endpoint}</th><th>{copy.api.status}</th><th>{copy.api.duration}</th><th>{copy.api.date}</th></tr></thead><tbody>{ws.apiLogs.slice(0,30).map(l=><tr key={l.id} className="border-t border-[var(--fp-border)]"><td className="px-4 py-3 font-mono">{l.endpoint}</td><td><StatusBadge status={l.status_code<400?'completed':'failed'}/><span className="ml-2 text-[var(--fp-muted)]">{l.status_code}</span></td><td className="text-[var(--fp-muted)]">{l.duration_ms==null?'—':`${l.duration_ms} ms`}</td><td className="text-[var(--fp-muted)]">{relativeDate(l.created_at,lang)}</td></tr>)}</tbody></table></div>:<div className="p-5"><EmptyState compact title={t.api.noUsage} description={lang==='ru'?'Запросы из API Playground и ваших интеграций появятся здесь автоматически.':'Requests from API Playground and your integrations will appear here automatically.'}/></div>}</Card>
    </div>

    <Card className="mt-4 overflow-hidden">
      <div className="flex flex-col gap-2 border-b border-[var(--fp-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex items-center gap-2"><Play size={16} className="text-[var(--fp-green)]"/><h2 className="text-[15px] font-semibold">API Playground</h2></div><p className="mt-1 text-[13px] text-[var(--fp-muted)]">{lang==='ru'?'Проверьте настоящий production endpoint прямо из кабинета. Ключ остаётся только в памяти этой вкладки.':'Test the real production endpoint from the dashboard. The key stays only in this tab memory.'}</p></div><span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--fp-green)]"><ShieldCheck size={14}/>{lang==='ru'?'Ключ не сохраняется':'Key is not stored'}</span></div>
      <div className="grid gap-5 p-5 lg:grid-cols-[.9fr_1.1fr]">
        <div className="space-y-4">
          <label className="block space-y-1.5 text-[13px] font-medium text-[var(--fp-muted)]"><span>{lang==='ru'?'API-ключ':'API key'}</span><Input type="password" autoComplete="off" value={playKey} onChange={e=>setPlayKey(e.target.value)} placeholder="fp_live_…"/></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="space-y-1.5 text-[13px] font-medium text-[var(--fp-muted)]"><span>{lang==='ru'?'Откуда':'From'}</span><SearchSelect value={fromCountry} onChange={setFromCountry} options={countries}/></label><label className="space-y-1.5 text-[13px] font-medium text-[var(--fp-muted)]"><span>{lang==='ru'?'Куда':'To'}</span><SearchSelect value={toCountry} onChange={setToCountry} options={countries}/></label><label className="space-y-1.5 text-[13px] font-medium text-[var(--fp-muted)]"><span>{lang==='ru'?'Сумма':'Amount'}</span><Input type="number" min="1" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><div/><label className="space-y-1.5 text-[13px] font-medium text-[var(--fp-muted)]"><span>{lang==='ru'?'Валюта отправки':'Source currency'}</span><SearchSelect value={sourceCurrency} onChange={setSourceCurrency} options={currencies} variant="currency"/></label><label className="space-y-1.5 text-[13px] font-medium text-[var(--fp-muted)]"><span>{lang==='ru'?'Валюта получения':'Recipient currency'}</span><SearchSelect value={recipientCurrency} onChange={setRecipientCurrency} options={currencies} variant="currency"/></label></div>
          <Button className="w-full" onClick={runPlayground} disabled={playing||!playKey.trim()||fromCountry===toCountry||Number(amount)<=0}>{playing?<Loader2 size={15} className="animate-spin"/>:<Send size={15}/>} {lang==='ru'?'Отправить запрос':'Send request'}</Button>
        </div>
        <div className="min-w-0"><div className="flex items-center justify-between"><strong className="text-[13px]">Response</strong>{playResult&&<div className="flex items-center gap-2 text-[12px]"><span className={playResult.status>=200&&playResult.status<300?'text-[var(--fp-green)]':'text-[var(--fp-red)]'}>HTTP {playResult.status||'ERR'}</span><span className="text-[var(--fp-subtle)]">{playResult.duration} ms</span></div>}</div><pre className="fp-scrollbar mt-2 min-h-[310px] max-h-[430px] overflow-auto rounded-[12px] border border-[var(--fp-border)] bg-[#f6f8f5] p-4 text-[12px] leading-5 text-[#365042]">{playResult?JSON.stringify(playResult.body,null,2):(lang==='ru'?'Ответ API появится здесь.':'The API response will appear here.')}</pre></div>
      </div>
    </Card>

    <Card className="mt-4 p-5 sm:p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-[14px] font-semibold">POST /api/v1/quote</h2><p className="mt-2 text-[14px] leading-5 text-[var(--fp-muted)]">{copy.api.auth} <code className="rounded bg-[#f1f2ef] px-1.5 py-0.5">Authorization: Bearer fp_live_…</code>. {copy.api.description}</p></div><button type="button" onClick={()=>navigator.clipboard.writeText(curl)} className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[var(--fp-border)] text-[var(--fp-green)] hover:bg-[var(--fp-green-soft)]" aria-label="Copy cURL"><Clipboard size={15}/></button></div><pre className="fp-scrollbar mt-4 overflow-x-auto rounded-[11px] border border-[var(--fp-border)] bg-[#f6f8f5] p-4 text-[14px] leading-5 text-[#365042]">{curl}</pre></Card>


  </div>
}
