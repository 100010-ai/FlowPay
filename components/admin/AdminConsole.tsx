'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Database,
  Download,
  FileKey2,
  FileText,
  Gauge,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  Route,
  Save,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Users,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { CountryFlag } from '@/components/brand/CountryFlag'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { SearchSelect } from '@/components/ui/search-select'
import { SelectMenu } from '@/components/ui/select-menu'
import { MetricCard, PageHeader, SectionTitle, StatusBadge } from '@/components/workspace/primitives'
import { countryOptions, currencyOptions } from '@/lib/countries'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

type AdminTab = 'overview' | 'users' | 'operations' | 'api' | 'security' | 'routes'
type Rule = {
  id: string
  provider_code: string
  display_name: string
  from_country: string
  to_country: string
  currencies: string[]
  fee_percent: number
  fixed_fee: number
  fx_markup_percent: number
  speed_minutes: number
  min_amount: number
  max_amount: number
  priority: number
  active: boolean
  source: string
  source_updated_at: string | null
  reliability_percent: number | null
  intermediary_banks: number | null
  created_at?: string
}
type RuleEditor = Omit<Rule, 'id'> & { id?: string }
type AdminUser = {
  id: string
  email: string
  created_at: string
  last_sign_in_at: string | null
  email_confirmed_at: string | null
  company: string
  country: string
  currency: string
  onboarding_completed_at: string | null
}
type Payment = { id:string; user_id:string; supplier_name:string; invoice_number:string; amount:number; currency:string; status:string; due_date:string|null; route_provider_code:string|null; created_at:string; updated_at:string }
type Invoice = { id:string; user_id:string; invoice_number:string; supplier_name:string; amount:number; currency:string; status:string; due_date:string|null; payment_draft_id:string|null; created_at:string; updated_at:string }
type ApiKey = { id:string; user_id:string; name:string; key_prefix:string; scope:string; expires_at:string; last_used_at:string|null; created_at:string; revoked_at:string|null }
type ApiLog = { id:string; user_id:string; endpoint:string; status_code:number; duration_ms:number|null; request_id:string|null; created_at:string }
type ApiUsage = { user_id:string; endpoint:string; usage_date:string; request_count:number; success_count:number; error_count:number; total_duration_ms:number; max_duration_ms:number; updated_at:string }
type AuditLog = { id:string; user_id:string; entity_type:string; entity_id:string|null; action:string; created_at:string }
type SystemEvent = { id:string; user_id:string|null; level:'info'|'warning'|'error'; source:string; code:string; message:string; created_at:string }
type LegalAcceptance = { id:number; user_id:string; document_type:string; document_version:string; action:string; locale:string; source:string; accepted_at:string; created_at:string }
type Overview = {
  version:string
  generatedAt:string
  usersTruncated:boolean
  metrics:{
    users:number; companies:number; payments:number; invoices:number; counterparties:number; audits:number; calculations:number;
    activeApiKeys:number; activeRules:number; systemErrors24h:number; apiRequests7d:number; apiSuccessRate:number; apiAverageDurationMs:number;
    termsReceipts:number; privacyReceipts:number
  }
  coverage:{providers:number;corridors:number;currencies:number}
  breakdowns:{payments:Record<string,number>;invoices:Record<string,number>;systemEvents:Record<string,number>}
  health:{application:boolean;database:boolean;routing:boolean;recentSystemErrors:boolean}
  users:AdminUser[]
  payments:Payment[]
  invoices:Invoice[]
  apiKeys:ApiKey[]
  apiLogs:ApiLog[]
  apiUsage:ApiUsage[]
  auditLogs:AuditLog[]
  events:SystemEvent[]
  legalAcceptances:LegalAcceptance[]
  rules:Rule[]
  requestId:string
}

const blankRule: RuleEditor = {
  provider_code:'', display_name:'', from_country:'*', to_country:'*', currencies:['EUR'], fee_percent:0, fixed_fee:0,
  fx_markup_percent:0, speed_minutes:1440, min_amount:1, max_amount:1000000, priority:5, active:true, source:'manual',
  source_updated_at:null, reliability_percent:null, intermediary_banks:null,
}

function dateTime(value:string|null|undefined, lang:string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }).format(date)
}
function shortDate(value:string|null|undefined, lang:string) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(lang === 'ru' ? 'ru-RU' : 'en-US', { day:'2-digit', month:'short', year:'numeric' }).format(date)
}
function money(amount:number, currency:string) {
  return `${currency || ''} ${Number(amount || 0).toLocaleString(undefined,{maximumFractionDigits:2})}`.trim()
}
function csvEscape(value:unknown) {
  const raw = value == null ? '' : String(value)
  return `"${raw.replaceAll('"','""')}"`
}
function downloadCsv(filename:string, rows:Record<string,unknown>[]) {
  if (!rows.length) return
  const headers = Object.keys(rows[0])
  const content = [headers.map(csvEscape).join(','), ...rows.map(row => headers.map(key => csvEscape(row[key])).join(','))].join('\r\n')
  const blob = new Blob([`\uFEFF${content}`], { type:'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}
function ownerLabel(userId:string, users:AdminUser[]) {
  const user = users.find(item => item.id === userId)
  return user?.company || user?.email || userId.slice(0,8)
}
function keyState(key:ApiKey) {
  if (key.revoked_at) return 'revoked'
  if (new Date(key.expires_at).getTime() <= Date.now()) return 'expired'
  return 'active'
}

function AdminTabs({active,onChange,lang}:{active:AdminTab;onChange:(tab:AdminTab)=>void;lang:string}) {
  const items:[AdminTab,React.ReactNode,string][] = [
    ['overview',<Gauge size={15} key="i"/>,lang==='ru'?'Обзор':'Overview'],
    ['users',<Users size={15} key="i"/>,lang==='ru'?'Пользователи':'Users'],
    ['operations',<WalletCards size={15} key="i"/>,lang==='ru'?'Операции':'Operations'],
    ['api',<FileKey2 size={15} key="i"/>,'API'],
    ['security',<ShieldCheck size={15} key="i"/>,lang==='ru'?'Безопасность':'Security'],
    ['routes',<Route size={15} key="i"/>,lang==='ru'?'Маршруты':'Routes'],
  ]
  return <div className="fp-scrollbar mb-6 flex gap-1 overflow-x-auto rounded-[14px] border border-[var(--fp-border)] bg-white p-1.5 shadow-[var(--fp-shadow)]">
    {items.map(([key,icon,label])=><button key={key} onClick={()=>onChange(key)} className={cn('flex h-9 shrink-0 items-center gap-2 rounded-[9px] px-3 text-[13px] font-semibold text-[var(--fp-muted)] transition',active===key?'bg-[#eaf2eb] text-[var(--fp-green-strong)]':'hover:bg-[#f5f7f4] hover:text-[var(--fp-text)]')}>{icon}{label}</button>)}
  </div>
}

function LaunchRow({ok,label,detail,manual=false}:{ok:boolean;label:string;detail:string;manual?:boolean}) {
  return <div className="flex items-start gap-3 rounded-[12px] border border-[#e4e8e3] bg-[#fbfcfa] p-3.5">
    <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full',manual?'bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]':ok?'bg-[var(--fp-green-soft)] text-[var(--fp-green-strong)]':'bg-[var(--fp-red-soft)] text-[var(--fp-red)]')}>{manual?<Clock3 size={14}/>:ok?<CheckCircle2 size={14}/>:<XCircle size={14}/>}</span>
    <div className="min-w-0"><strong className="block text-[13px]">{label}</strong><p className="mt-0.5 text-[12px] leading-5 text-[var(--fp-muted)]">{detail}</p></div>
  </div>
}

export function AdminConsole() {
  const {lang}=useLanguage()
  const [data,setData]=useState<Overview|null>(null)
  const [loading,setLoading]=useState(true)
  const [forbidden,setForbidden]=useState(false)
  const [message,setMessage]=useState('')
  const [tab,setTab]=useState<AdminTab>('overview')
  const [query,setQuery]=useState('')
  const [operationType,setOperationType]=useState<'payments'|'invoices'>('payments')
  const [editing,setEditing]=useState<RuleEditor>({...blankRule})
  const [saving,setSaving]=useState(false)

  const countryChoices=useMemo(()=>[{value:'*',label:lang==='ru'?'Любая страна':'Any country'},...countryOptions(lang).map(([code,label])=>({value:code,label,leading:<CountryFlag code={code}/> }))],[lang])
  const currencyChoices=useMemo(()=>currencyOptions(lang).map(item=>({value:item.code,label:item.code,description:item.name})),[lang])

  async function token(){const {data:session}=await createClient().auth.getSession();return session.session?.access_token||''}
  async function load(){
    setLoading(true);setMessage('')
    try{
      const auth=await token()
      const response=await fetch('/api/admin/overview',{headers:{Authorization:`Bearer ${auth}`},cache:'no-store'})
      if(response.status===403){setForbidden(true);return}
      if(!response.ok)throw new Error('ADMIN_LOAD_FAILED')
      setForbidden(false);setData(await response.json())
    }catch{setMessage(lang==='ru'?'Не удалось загрузить административные данные.':'Could not load administrative data.')}
    finally{setLoading(false)}
  }
  useEffect(()=>{void load()},[])

  const q=query.trim().toLowerCase()
  const filteredUsers=useMemo(()=>data?.users.filter(user=>!q||`${user.email} ${user.company} ${user.country} ${user.currency}`.toLowerCase().includes(q))||[],[data?.users,q])
  const filteredPayments=useMemo(()=>data?.payments.filter(row=>!q||`${row.supplier_name} ${row.invoice_number} ${row.currency} ${row.status} ${ownerLabel(row.user_id,data?.users||[])}`.toLowerCase().includes(q))||[],[data?.payments,data?.users,q])
  const filteredInvoices=useMemo(()=>data?.invoices.filter(row=>!q||`${row.supplier_name} ${row.invoice_number} ${row.currency} ${row.status} ${ownerLabel(row.user_id,data?.users||[])}`.toLowerCase().includes(q))||[],[data?.invoices,data?.users,q])
  const filteredKeys=useMemo(()=>data?.apiKeys.filter(row=>!q||`${row.name} ${row.key_prefix} ${row.scope} ${ownerLabel(row.user_id,data?.users||[])}`.toLowerCase().includes(q))||[],[data?.apiKeys,data?.users,q])
  const filteredEvents=useMemo(()=>data?.events.filter(row=>!q||`${row.code} ${row.source} ${row.message} ${row.level}`.toLowerCase().includes(q))||[],[data?.events,q])
  const filteredRules=useMemo(()=>data?.rules.filter(row=>!q||`${row.display_name} ${row.provider_code} ${row.from_country} ${row.to_country} ${row.currencies.join(' ')}`.toLowerCase().includes(q))||[],[data?.rules,q])

  async function saveRule(){
    setSaving(true);setMessage('')
    try{
      const auth=await token();const method=editing.id?'PATCH':'POST'
      const payload={...editing,currencies:editing.currencies||[],reliability_percent:editing.reliability_percent==null?null:Number(editing.reliability_percent),intermediary_banks:editing.intermediary_banks==null?null:Number(editing.intermediary_banks)}
      const response=await fetch('/api/admin/provider-rules',{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth}`},body:JSON.stringify(payload)})
      if(!response.ok)throw new Error('RULE_SAVE_FAILED')
      setEditing({...blankRule});await load()
    }catch{setMessage(lang==='ru'?'Не удалось сохранить правило маршрута.':'Could not save route rule.')}
    finally{setSaving(false)}
  }
  async function removeRule(id:string){
    if(!confirm(lang==='ru'?'Удалить правило маршрута? Это действие нельзя отменить.':'Delete this route rule? This cannot be undone.'))return
    const auth=await token();const response=await fetch('/api/admin/provider-rules',{method:'DELETE',headers:{'Content-Type':'application/json',Authorization:`Bearer ${auth}`},body:JSON.stringify({id})})
    if(response.ok){if(editing.id===id)setEditing({...blankRule});await load()}else setMessage(lang==='ru'?'Не удалось удалить правило.':'Could not delete rule.')
  }

  if(loading)return <div className="grid min-h-[58vh] place-items-center"><div className="text-center"><Loader2 size={28} className="mx-auto animate-spin text-[var(--fp-green)]"/><p className="mt-3 text-[13px] text-[var(--fp-muted)]">{lang==='ru'?'Загружаем административные данные…':'Loading administrative data…'}</p></div></div>
  if(forbidden)return <div className="mx-auto max-w-xl pt-16"><Card className="p-8 text-center"><LockKeyhole size={28} className="mx-auto text-[var(--fp-green)]"/><h1 className="mt-4 text-[24px] font-semibold">{lang==='ru'?'Доступ ограничен':'Access restricted'}</h1><p className="mt-2 text-[14px] leading-6 text-[var(--fp-muted)]">{lang==='ru'?'Этот аккаунт не входит в список администраторов FlowPay.':'This account is not authorized for FlowPay administration.'}</p></Card></div>
  if(!data)return <div className="mx-auto max-w-xl pt-16"><Card className="p-8 text-center"><AlertTriangle size={28} className="mx-auto text-[var(--fp-amber)]"/><p className="mt-4 text-[14px] text-[var(--fp-muted)]">{message||'ADMIN_LOAD_FAILED'}</p><Button className="mt-5" onClick={load}><RefreshCw size={14}/>{lang==='ru'?'Повторить':'Retry'}</Button></Card></div>

  return <div className="fp-enter">
    <PageHeader eyebrow={`FlowPay Admin · v${data.version}`} title={lang==='ru'?'Панель управления':'Administration'} subtitle={lang==='ru'?'Единый центр состояния продукта, пользователей, операций, API, безопасности и платёжных маршрутов.':'One place for product health, users, operations, API, security and payment routing.'} actions={<><Badge tone={data.health.application&&data.health.database&&data.health.routing?'success':'warning'} className="h-9 px-3">Production</Badge><Button variant="secondary" onClick={load}><RefreshCw size={14}/>{lang==='ru'?'Обновить':'Refresh'}</Button></>}/>
    {message&&<div className="mb-4 rounded-[12px] border border-[#ead9ad] bg-[var(--fp-amber-soft)] p-3 text-[13px] text-[var(--fp-amber)]">{message}</div>}
    <AdminTabs active={tab} onChange={value=>{setTab(value);setQuery('')}} lang={lang}/>

    {tab==='overview'&&<OverviewTab data={data} lang={lang}/>} 
    {tab==='users'&&<UsersTab data={data} rows={filteredUsers} query={query} setQuery={setQuery} lang={lang}/>} 
    {tab==='operations'&&<OperationsTab data={data} payments={filteredPayments} invoices={filteredInvoices} query={query} setQuery={setQuery} type={operationType} setType={setOperationType} lang={lang}/>} 
    {tab==='api'&&<ApiTab data={data} rows={filteredKeys} query={query} setQuery={setQuery} lang={lang}/>} 
    {tab==='security'&&<SecurityTab data={data} events={filteredEvents} query={query} setQuery={setQuery} lang={lang}/>} 
    {tab==='routes'&&<RoutesTab data={data} rows={filteredRules} query={query} setQuery={setQuery} editing={editing} setEditing={setEditing} save={saveRule} remove={removeRule} saving={saving} countries={countryChoices} currencies={currencyChoices} lang={lang}/>} 
  </div>
}

function OverviewTab({data,lang}:{data:Overview;lang:string}){
  const recentUsers=data.users.slice().sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,6)
  const recentEvents=data.events.slice(0,6)
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label={lang==='ru'?'Пользователи':'Users'} value={String(data.metrics.users)} meta={lang==='ru'?`${data.metrics.companies} завершили onboarding`:`${data.metrics.companies} completed onboarding`} icon={<Users size={17}/>} accent/>
      <MetricCard label={lang==='ru'?'Платежи':'Payments'} value={String(data.metrics.payments)} meta={lang==='ru'?`${data.metrics.invoices} счетов · ${data.metrics.counterparties} контрагентов`:`${data.metrics.invoices} invoices · ${data.metrics.counterparties} counterparties`} icon={<WalletCards size={17}/>}/>
      <MetricCard label={lang==='ru'?'API за 7 дней':'API · 7 days'} value={data.metrics.apiRequests7d.toLocaleString()} meta={`${data.metrics.apiSuccessRate.toFixed(1)}% success · ${data.metrics.apiAverageDurationMs} ms avg`} icon={<BarChart3 size={17}/>}/>
      <MetricCard label={lang==='ru'?'Системные ошибки · 24ч':'System errors · 24h'} value={String(data.metrics.systemErrors24h)} meta={data.metrics.systemErrors24h===0?(lang==='ru'?'Новых ошибок не зафиксировано':'No new errors recorded'):(lang==='ru'?'Требуется проверка':'Review required')} icon={<ShieldAlert size={17}/>} />
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
      <Card className="p-5 sm:p-6">
        <SectionTitle title={lang==='ru'?'Launch Center':'Launch Center'} subtitle={lang==='ru'?'Что уже готово к публичному запуску и что требует ручной проверки.':'Production gates and items that still need a human check.'}/>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <LaunchRow ok={data.health.application&&data.health.database} label={lang==='ru'?'Приложение и база':'Application & database'} detail={data.health.database?(lang==='ru'?'Admin API читает production-данные.':'Admin API can read production data.'):(lang==='ru'?'База недоступна.':'Database unavailable.')}/>
          <LaunchRow ok={data.health.routing} label={lang==='ru'?'Маршрутизация':'Routing'} detail={lang==='ru'?`${data.coverage.providers} провайдера · ${data.coverage.corridors} направления · ${data.coverage.currencies} валют`:`${data.coverage.providers} providers · ${data.coverage.corridors} corridors · ${data.coverage.currencies} currencies`}/>
          <LaunchRow ok={data.health.recentSystemErrors} label={lang==='ru'?'Runtime-состояние':'Runtime health'} detail={data.health.recentSystemErrors?(lang==='ru'?'За 24 часа системных ошибок нет.':'No system errors in the last 24 hours.'):(lang==='ru'?`${data.metrics.systemErrors24h} ошибок за 24 часа.`:`${data.metrics.systemErrors24h} errors in 24 hours.`)}/>
          <LaunchRow ok={data.metrics.activeApiKeys>=0} label={lang==='ru'?'Security release':'Security release'} detail={lang==='ru'?`v${data.version}, AAL2 admin gate, ${data.metrics.activeApiKeys} активных API-ключей.`:`v${data.version}, AAL2 admin gate, ${data.metrics.activeApiKeys} active API keys.`}/>
          <LaunchRow manual ok={false} label={lang==='ru'?'SMTP и письма':'SMTP & email'} detail={lang==='ru'?'Перед внешним трафиком вручную протестировать signup confirmation и reset password.':'Manually test signup confirmation and password reset before external traffic.'}/>
          <LaunchRow manual ok={false} label={lang==='ru'?'Юридические реквизиты':'Legal operator details'} detail={lang==='ru'?`В журнале ${data.metrics.termsReceipts} Terms и ${data.metrics.privacyReceipts} Privacy receipts. Реквизиты оператора всё равно проверить вручную.`:`${data.metrics.termsReceipts} Terms and ${data.metrics.privacyReceipts} Privacy receipts. Operator details still require manual review.`}/>
        </div>
      </Card>
      <Card className="p-5 sm:p-6">
        <SectionTitle title={lang==='ru'?'Покрытие продукта':'Product coverage'} subtitle={lang==='ru'?'Только активные production rules.':'Active production rules only.'}/>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat label={lang==='ru'?'Провайдеры':'Providers'} value={data.coverage.providers}/><MiniStat label={lang==='ru'?'Направления':'Corridors'} value={data.coverage.corridors}/><MiniStat label={lang==='ru'?'Валюты':'Currencies'} value={data.coverage.currencies}/>
        </div>
        <div className="mt-5 border-t border-[var(--fp-border)] pt-5"><SectionTitle title={lang==='ru'?'Операционные объекты':'Operational objects'}/><div className="mt-3 grid grid-cols-2 gap-2"><MiniStat label={lang==='ru'?'Аудиты':'Audits'} value={data.metrics.audits}/><MiniStat label={lang==='ru'?'Расчёты':'Quotes saved'} value={data.metrics.calculations}/><MiniStat label={lang==='ru'?'Активные ключи':'Active keys'} value={data.metrics.activeApiKeys}/><MiniStat label={lang==='ru'?'Правила':'Active rules'} value={data.metrics.activeRules}/></div></div>
      </Card>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <Card className="overflow-hidden"><div className="p-5 sm:p-6"><SectionTitle title={lang==='ru'?'Новые пользователи':'Recent users'}/></div><div className="border-t border-[var(--fp-border)]">{recentUsers.length?recentUsers.map(user=><div key={user.id} className="flex items-center gap-3 border-b border-[var(--fp-border)] px-5 py-3 last:border-b-0"><span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#edf3ee] text-[12px] font-bold text-[var(--fp-green-strong)]">{(user.company||user.email||'?').slice(0,2).toUpperCase()}</span><div className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{user.company||user.email}</strong><span className="block truncate text-[12px] text-[var(--fp-muted)]">{user.email}</span></div><div className="text-right"><Badge tone={user.onboarding_completed_at?'success':'warning'}>{user.onboarding_completed_at?(lang==='ru'?'Готов':'Ready'):(lang==='ru'?'Onboarding':'Onboarding')}</Badge><div className="mt-1 text-[11px] text-[var(--fp-subtle)]">{shortDate(user.created_at,lang)}</div></div></div>):<p className="p-6 text-[13px] text-[var(--fp-muted)]">{lang==='ru'?'Пользователей пока нет.':'No users yet.'}</p>}</div></Card>
      <Card className="overflow-hidden"><div className="p-5 sm:p-6"><SectionTitle title={lang==='ru'?'Системные события':'System events'}/></div><div className="border-t border-[var(--fp-border)]">{recentEvents.length?recentEvents.map(event=><div key={event.id} className="flex items-start gap-3 border-b border-[var(--fp-border)] px-5 py-3 last:border-b-0"><EventDot level={event.level}/><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong className="truncate text-[13px]">{event.code}</strong><span className="text-[11px] text-[var(--fp-subtle)]">{event.source}</span></div><p className="mt-0.5 truncate text-[12px] text-[var(--fp-muted)]">{event.message||'—'}</p></div><span className="shrink-0 text-[11px] text-[var(--fp-subtle)]">{shortDate(event.created_at,lang)}</span></div>):<p className="p-6 text-[13px] text-[var(--fp-muted)]">{lang==='ru'?'Событий нет.':'No events.'}</p>}</div></Card>
    </div>
  </>
}

function UsersTab({data,rows,query,setQuery,lang}:{data:Overview;rows:AdminUser[];query:string;setQuery:(v:string)=>void;lang:string}){
  return <Card className="overflow-hidden">
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><SectionTitle title={lang==='ru'?'Пользователи':'Users'} subtitle={lang==='ru'?`${data.metrics.users} аккаунтов · ${data.metrics.companies} завершили onboarding`:`${data.metrics.users} accounts · ${data.metrics.companies} completed onboarding`}/>{data.usersTruncated&&<p className="mt-2 text-[11px] text-[var(--fp-amber)]">{lang==='ru'?'Показаны первые 2000 Auth-пользователей.':'Showing the first 2,000 Auth users.'}</p>}</div><div className="flex gap-2"><SearchBox value={query} onChange={setQuery} placeholder={lang==='ru'?'Email, компания, страна…':'Email, company, country…'}/><Button variant="secondary" onClick={()=>downloadCsv('flowpay-users.csv',rows.map(user=>({email:user.email,company:user.company,country:user.country,currency:user.currency,created_at:user.created_at,last_sign_in_at:user.last_sign_in_at,onboarding_completed_at:user.onboarding_completed_at})))}><Download size={14}/>CSV</Button></div></div>
    <div className="overflow-x-auto border-t border-[var(--fp-border)]"><table className="w-full min-w-[900px] text-left"><thead><tr className="bg-[#f8faf7] text-[11px] uppercase tracking-[.06em] text-[var(--fp-subtle)]"><Th>{lang==='ru'?'Аккаунт':'Account'}</Th><Th>{lang==='ru'?'Компания':'Company'}</Th><Th>{lang==='ru'?'Регион':'Region'}</Th><Th>{lang==='ru'?'Статус':'Status'}</Th><Th>{lang==='ru'?'Создан':'Created'}</Th><Th>{lang==='ru'?'Последний вход':'Last sign-in'}</Th></tr></thead><tbody>{rows.map(user=><tr key={user.id} className="border-t border-[var(--fp-border)] hover:bg-[#fbfcfa]"><Td><strong className="block text-[13px]">{user.email||'—'}</strong><span className="text-[11px] text-[var(--fp-subtle)]">{user.id.slice(0,8)}…</span></Td><Td>{user.company||'—'}</Td><Td><span className="inline-flex items-center gap-2">{user.country&&<CountryFlag code={user.country}/>} {user.country||'—'} {user.currency&&<span className="text-[var(--fp-subtle)]">· {user.currency}</span>}</span></Td><Td><div className="flex gap-1.5"><Badge tone={user.email_confirmed_at?'success':'warning'}>{user.email_confirmed_at?(lang==='ru'?'Email ✓':'Email ✓'):(lang==='ru'?'Email ?':'Email ?')}</Badge><Badge tone={user.onboarding_completed_at?'success':'warning'}>{user.onboarding_completed_at?(lang==='ru'?'Onboarded':'Onboarded'):(lang==='ru'?'Не настроен':'Not set')}</Badge></div></Td><Td>{shortDate(user.created_at,lang)}</Td><Td>{dateTime(user.last_sign_in_at,lang)}</Td></tr>)}</tbody></table>{!rows.length&&<EmptyTable text={lang==='ru'?'Ничего не найдено.':'Nothing found.'}/>}</div>
  </Card>
}

function OperationsTab({data,payments,invoices,query,setQuery,type,setType,lang}:{data:Overview;payments:Payment[];invoices:Invoice[];query:string;setQuery:(v:string)=>void;type:'payments'|'invoices';setType:(v:'payments'|'invoices')=>void;lang:string}){
  const rows=type==='payments'?payments:invoices
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={lang==='ru'?'Всего платежей':'Payments'} value={String(data.metrics.payments)} icon={<WalletCards size={17}/>}/><MetricCard label={lang==='ru'?'Всего счетов':'Invoices'} value={String(data.metrics.invoices)} icon={<FileText size={17}/>}/><MetricCard label={lang==='ru'?'Контрагенты':'Counterparties'} value={String(data.metrics.counterparties)} icon={<Building2 size={17}/>}/><MetricCard label={lang==='ru'?'Сохранённые расчёты':'Saved quotes'} value={String(data.metrics.calculations)} icon={<CircleDollarSign size={17}/>}/></div>
    <Card className="mt-4 overflow-hidden"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex items-center gap-2"><button onClick={()=>setType('payments')} className={cn('rounded-[9px] px-3 py-2 text-[13px] font-semibold',type==='payments'?'bg-[#eaf2eb] text-[var(--fp-green-strong)]':'text-[var(--fp-muted)] hover:bg-[#f5f7f4]')}>{lang==='ru'?'Платежи':'Payments'}</button><button onClick={()=>setType('invoices')} className={cn('rounded-[9px] px-3 py-2 text-[13px] font-semibold',type==='invoices'?'bg-[#eaf2eb] text-[var(--fp-green-strong)]':'text-[var(--fp-muted)] hover:bg-[#f5f7f4]')}>{lang==='ru'?'Счета':'Invoices'}</button></div><div className="flex gap-2"><SearchBox value={query} onChange={setQuery} placeholder={lang==='ru'?'Поставщик, статус, компания…':'Supplier, status, company…'}/><Button variant="secondary" onClick={()=>downloadCsv(`flowpay-${type}.csv`,rows.map(row=>({...row,owner:ownerLabel(row.user_id,data.users)})))}><Download size={14}/>CSV</Button></div></div>
      <div className="overflow-x-auto border-t border-[var(--fp-border)]"><table className="w-full min-w-[980px] text-left"><thead><tr className="bg-[#f8faf7] text-[11px] uppercase tracking-[.06em] text-[var(--fp-subtle)]"><Th>{lang==='ru'?'Документ':'Record'}</Th><Th>{lang==='ru'?'Компания':'Owner'}</Th><Th>{lang==='ru'?'Сумма':'Amount'}</Th><Th>{lang==='ru'?'Статус':'Status'}</Th><Th>{lang==='ru'?'Срок':'Due'}</Th><Th>{lang==='ru'?'Обновлён':'Updated'}</Th></tr></thead><tbody>{rows.map(row=><tr key={row.id} className="border-t border-[var(--fp-border)] hover:bg-[#fbfcfa]"><Td><strong className="block text-[13px]">{row.supplier_name}</strong><span className="text-[11px] text-[var(--fp-subtle)]">{row.invoice_number||row.id.slice(0,8)}</span></Td><Td>{ownerLabel(row.user_id,data.users)}</Td><Td><strong>{money(row.amount,row.currency)}</strong></Td><Td><StatusBadge status={row.status}/></Td><Td>{shortDate(row.due_date,lang)}</Td><Td>{dateTime(row.updated_at,lang)}</Td></tr>)}</tbody></table>{!rows.length&&<EmptyTable text={lang==='ru'?'Операций не найдено.':'No operations found.'}/>}</div>
    </Card>
  </>
}

function ApiTab({data,rows,query,setQuery,lang}:{data:Overview;rows:ApiKey[];query:string;setQuery:(v:string)=>void;lang:string}){
  const errors7d=data.apiUsage.reduce((sum,row)=>sum+row.error_count,0)
  const endpointStats=Object.values(data.apiUsage.reduce<Record<string,{endpoint:string;requests:number;errors:number;duration:number}>>((acc,row)=>{const current=acc[row.endpoint]||{endpoint:row.endpoint,requests:0,errors:0,duration:0};current.requests+=row.request_count;current.errors+=row.error_count;current.duration+=row.total_duration_ms;acc[row.endpoint]=current;return acc},{})).sort((a,b)=>b.requests-a.requests)
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={lang==='ru'?'Запросы · 7 дней':'Requests · 7 days'} value={data.metrics.apiRequests7d.toLocaleString()} icon={<BarChart3 size={17}/>}/><MetricCard label={lang==='ru'?'Успешность':'Success rate'} value={`${data.metrics.apiSuccessRate.toFixed(1)}%`} icon={<CheckCircle2 size={17}/>}/><MetricCard label={lang==='ru'?'Среднее время':'Average latency'} value={`${data.metrics.apiAverageDurationMs} ms`} icon={<Activity size={17}/>}/><MetricCard label={lang==='ru'?'Ошибки · 7 дней':'Errors · 7 days'} value={String(errors7d)} icon={<AlertTriangle size={17}/>}/></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="overflow-hidden"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><SectionTitle title={lang==='ru'?'API-ключи':'API keys'} subtitle={lang==='ru'?`${data.metrics.activeApiKeys} активных ключей`:`${data.metrics.activeApiKeys} active keys`}/><SearchBox value={query} onChange={setQuery} placeholder={lang==='ru'?'Ключ, владелец…':'Key, owner…'}/></div><div className="overflow-x-auto border-t border-[var(--fp-border)]"><table className="w-full min-w-[780px] text-left"><thead><tr className="bg-[#f8faf7] text-[11px] uppercase tracking-[.06em] text-[var(--fp-subtle)]"><Th>{lang==='ru'?'Ключ':'Key'}</Th><Th>{lang==='ru'?'Владелец':'Owner'}</Th><Th>Scope</Th><Th>{lang==='ru'?'Состояние':'State'}</Th><Th>{lang==='ru'?'Последнее использование':'Last used'}</Th><Th>{lang==='ru'?'Истекает':'Expires'}</Th></tr></thead><tbody>{rows.map(key=>{const state=keyState(key);return <tr key={key.id} className="border-t border-[var(--fp-border)] hover:bg-[#fbfcfa]"><Td><strong className="block text-[13px]">{key.name}</strong><span className="font-mono text-[11px] text-[var(--fp-subtle)]">{key.key_prefix}••••</span></Td><Td>{ownerLabel(key.user_id,data.users)}</Td><Td><code className="text-[12px]">{key.scope}</code></Td><Td><StatusBadge status={state}/></Td><Td>{dateTime(key.last_used_at,lang)}</Td><Td>{shortDate(key.expires_at,lang)}</Td></tr>})}</tbody></table>{!rows.length&&<EmptyTable text={lang==='ru'?'API-ключей не найдено.':'No API keys found.'}/>}</div></Card>
      <Card className="p-5 sm:p-6"><SectionTitle title={lang==='ru'?'Endpoint usage · 7 дней':'Endpoint usage · 7 days'}/><div className="mt-5 space-y-3">{endpointStats.length?endpointStats.map(row=>{const errorRate=row.requests?row.errors/row.requests*100:0;return <div key={row.endpoint} className="rounded-[12px] border border-[var(--fp-border)] p-3.5"><div className="flex items-center justify-between gap-3"><code className="truncate text-[12px] font-semibold">{row.endpoint}</code><strong className="text-[13px]">{row.requests.toLocaleString()}</strong></div><div className="mt-2 flex items-center justify-between text-[11px] text-[var(--fp-muted)]"><span>{errorRate.toFixed(1)}% errors</span><span>{row.requests?Math.round(row.duration/row.requests):0} ms avg</span></div></div>}):<EmptyTable text={lang==='ru'?'API ещё не использовался.':'No API usage yet.'}/>}</div></Card>
    </div>
    <Card className="mt-4 overflow-hidden"><div className="p-5 sm:p-6"><SectionTitle title={lang==='ru'?'Последние API-запросы':'Recent API requests'}/></div><div className="overflow-x-auto border-t border-[var(--fp-border)]"><table className="w-full min-w-[850px] text-left"><thead><tr className="bg-[#f8faf7] text-[11px] uppercase tracking-[.06em] text-[var(--fp-subtle)]"><Th>Endpoint</Th><Th>{lang==='ru'?'Владелец':'Owner'}</Th><Th>HTTP</Th><Th>{lang==='ru'?'Время':'Latency'}</Th><Th>Request ID</Th><Th>{lang==='ru'?'Дата':'Date'}</Th></tr></thead><tbody>{data.apiLogs.slice(0,80).map(log=><tr key={log.id} className="border-t border-[var(--fp-border)]"><Td><code className="text-[12px]">{log.endpoint}</code></Td><Td>{ownerLabel(log.user_id,data.users)}</Td><Td><Badge tone={log.status_code>=500?'danger':log.status_code>=400?'warning':'success'}>{log.status_code}</Badge></Td><Td>{log.duration_ms==null?'—':`${log.duration_ms} ms`}</Td><Td><code className="text-[11px] text-[var(--fp-subtle)]">{log.request_id||'—'}</code></Td><Td>{dateTime(log.created_at,lang)}</Td></tr>)}</tbody></table>{!data.apiLogs.length&&<EmptyTable text={lang==='ru'?'Логов API пока нет.':'No API logs yet.'}/>}</div></Card>
  </>
}

function SecurityTab({data,events,query,setQuery,lang}:{data:Overview;events:SystemEvent[];query:string;setQuery:(v:string)=>void;lang:string}){
  const latestAudit=data.auditLogs.slice(0,100)
  const errorCount=data.breakdowns.systemEvents.error||0;const warningCount=data.breakdowns.systemEvents.warning||0
  return <>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={lang==='ru'?'Ошибки · журнал':'Errors · log'} value={String(errorCount)} icon={<ShieldAlert size={17}/>}/><MetricCard label={lang==='ru'?'Предупреждения':'Warnings'} value={String(warningCount)} icon={<AlertTriangle size={17}/>}/><MetricCard label={lang==='ru'?'Terms receipts':'Terms receipts'} value={String(data.metrics.termsReceipts)} icon={<FileText size={17}/>}/><MetricCard label={lang==='ru'?'Privacy receipts':'Privacy receipts'} value={String(data.metrics.privacyReceipts)} icon={<LockKeyhole size={17}/>}/></div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[1.12fr_.88fr]">
      <Card className="overflow-hidden"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><SectionTitle title={lang==='ru'?'Системный security/event log':'System security & event log'}/><SearchBox value={query} onChange={setQuery} placeholder={lang==='ru'?'Код, источник, сообщение…':'Code, source, message…'}/></div><div className="border-t border-[var(--fp-border)]">{events.slice(0,100).map(event=><div key={event.id} className="flex items-start gap-3 border-b border-[var(--fp-border)] px-5 py-3 last:border-b-0"><EventDot level={event.level}/><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-[13px]">{event.code}</strong><Badge tone={event.level==='error'?'danger':event.level==='warning'?'warning':'neutral'}>{event.level}</Badge><span className="text-[11px] text-[var(--fp-subtle)]">{event.source}</span></div><p className="mt-1 text-[12px] leading-5 text-[var(--fp-muted)]">{event.message||'—'}</p></div><span className="shrink-0 text-[11px] text-[var(--fp-subtle)]">{dateTime(event.created_at,lang)}</span></div>)}{!events.length&&<EmptyTable text={lang==='ru'?'Событий не найдено.':'No events found.'}/>}</div></Card>
      <Card className="overflow-hidden"><div className="p-5 sm:p-6"><SectionTitle title={lang==='ru'?'Workspace audit trail':'Workspace audit trail'} subtitle={lang==='ru'?'Последние изменения пользовательских объектов.':'Recent changes to user-owned records.'}/></div><div className="border-t border-[var(--fp-border)]">{latestAudit.slice(0,60).map(row=><div key={row.id} className="border-b border-[var(--fp-border)] px-5 py-3 last:border-b-0"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><strong className="block truncate text-[13px]">{row.entity_type} · {row.action}</strong><span className="block truncate text-[11px] text-[var(--fp-subtle)]">{ownerLabel(row.user_id,data.users)} · {row.entity_id?.slice(0,8)||'—'}</span></div><span className="text-[11px] text-[var(--fp-subtle)]">{shortDate(row.created_at,lang)}</span></div></div>)}{!latestAudit.length&&<EmptyTable text={lang==='ru'?'Audit trail пуст.':'Audit trail is empty.'}/>}</div></Card>
    </div>
  </>
}

function RoutesTab({data,rows,query,setQuery,editing,setEditing,save,remove,saving,countries,currencies,lang}:{data:Overview;rows:Rule[];query:string;setQuery:(v:string)=>void;editing:RuleEditor;setEditing:React.Dispatch<React.SetStateAction<RuleEditor>>;save:()=>void;remove:(id:string)=>void;saving:boolean;countries:{value:string;label:string;leading?:React.ReactNode}[];currencies:{value:string;label:string;description:string}[];lang:string}){
  return <>
    <div className="grid gap-4 sm:grid-cols-3"><MetricCard label={lang==='ru'?'Активные правила':'Active rules'} value={String(data.metrics.activeRules)} icon={<Route size={17}/>}/><MetricCard label={lang==='ru'?'Провайдеры':'Providers'} value={String(data.coverage.providers)} icon={<Database size={17}/>}/><MetricCard label={lang==='ru'?'Направления':'Corridors'} value={String(data.coverage.corridors)} icon={<Activity size={17}/>}/></div>
    <div className="mt-4 grid gap-4 2xl:grid-cols-[390px_minmax(0,1fr)]">
      <Card className="p-5 sm:p-6"><SectionTitle title={editing.id?(lang==='ru'?'Редактировать правило':'Edit route rule'):(lang==='ru'?'Новое правило':'New route rule')} subtitle={lang==='ru'?'Изменение сразу влияет на production routing после сохранения.':'Changes affect production routing immediately after save.'}/><div className="mt-5 grid gap-3 sm:grid-cols-2 2xl:grid-cols-1"><Field label="Provider code"><Input value={editing.provider_code} onChange={e=>setEditing(v=>({...v,provider_code:e.target.value}))} placeholder="provider_name"/></Field><Field label={lang==='ru'?'Название':'Display name'}><Input value={editing.display_name} onChange={e=>setEditing(v=>({...v,display_name:e.target.value}))}/></Field><Field label={lang==='ru'?'Откуда':'From'}><SearchSelect value={editing.from_country} onChange={value=>setEditing(v=>({...v,from_country:value}))} options={countries}/></Field><Field label={lang==='ru'?'Куда':'To'}><SearchSelect value={editing.to_country} onChange={value=>setEditing(v=>({...v,to_country:value}))} options={countries}/></Field><Field label={lang==='ru'?'Валюта':'Currency'}><SearchSelect value={editing.currencies?.[0]||''} onChange={value=>setEditing(v=>({...v,currencies:Array.from(new Set([value,...(v.currencies||[]).filter(x=>x!==value)]))}))} options={currencies} variant="currency"/></Field><Num label="Fee %" value={editing.fee_percent} set={fee_percent=>setEditing(v=>({...v,fee_percent}))}/><Num label={lang==='ru'?'Фикс. комиссия':'Fixed fee'} value={editing.fixed_fee} set={fixed_fee=>setEditing(v=>({...v,fixed_fee}))}/><Num label="FX markup %" value={editing.fx_markup_percent} set={fx_markup_percent=>setEditing(v=>({...v,fx_markup_percent}))}/><Num label={lang==='ru'?'Скорость, мин':'Speed, min'} value={editing.speed_minutes} set={speed_minutes=>setEditing(v=>({...v,speed_minutes}))}/><Num label="Min amount" value={editing.min_amount} set={min_amount=>setEditing(v=>({...v,min_amount}))}/><Num label="Max amount" value={editing.max_amount} set={max_amount=>setEditing(v=>({...v,max_amount}))}/><Num label={lang==='ru'?'Надёжность %':'Reliability %'} value={editing.reliability_percent??0} set={reliability_percent=>setEditing(v=>({...v,reliability_percent}))}/><Field label={lang==='ru'?'Источник':'Source'}><Input value={editing.source} onChange={e=>setEditing(v=>({...v,source:e.target.value}))}/></Field><Field label={lang==='ru'?'Статус':'Status'}><SelectMenu value={editing.active?'active':'inactive'} onChange={value=>setEditing(v=>({...v,active:value==='active'}))} options={[{value:'active',label:lang==='ru'?'Активно':'Active'},{value:'inactive',label:lang==='ru'?'Выключено':'Inactive'}]}/></Field></div><div className="mt-5 flex gap-2"><Button onClick={save} disabled={saving}><Save size={14}/>{saving?(lang==='ru'?'Сохраняем…':'Saving…'):(lang==='ru'?'Сохранить':'Save')}</Button>{editing.id&&<Button variant="secondary" onClick={()=>setEditing({...blankRule})}>{lang==='ru'?'Отмена':'Cancel'}</Button>}</div></Card>
      <Card className="overflow-hidden"><div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><SectionTitle title={lang==='ru'?'Production routing rules':'Production routing rules'} subtitle={lang==='ru'?`${rows.length} из ${data.rules.length} правил`:`${rows.length} of ${data.rules.length} rules`}/><SearchBox value={query} onChange={setQuery} placeholder={lang==='ru'?'Провайдер, страна, валюта…':'Provider, country, currency…'}/></div><div className="overflow-x-auto border-t border-[var(--fp-border)]"><table className="w-full min-w-[1100px] text-left"><thead><tr className="bg-[#f8faf7] text-[11px] uppercase tracking-[.06em] text-[var(--fp-subtle)]"><Th>{lang==='ru'?'Провайдер':'Provider'}</Th><Th>{lang==='ru'?'Маршрут':'Route'}</Th><Th>{lang==='ru'?'Валюты':'Currencies'}</Th><Th>{lang==='ru'?'Комиссия':'Fee'}</Th><Th>FX</Th><Th>{lang==='ru'?'Скорость':'Speed'}</Th><Th>{lang==='ru'?'Надёжность':'Reliability'}</Th><Th>{lang==='ru'?'Статус':'Status'}</Th><Th>{lang==='ru'?'Действия':'Actions'}</Th></tr></thead><tbody>{rows.map(rule=><tr key={rule.id} className="border-t border-[var(--fp-border)] hover:bg-[#fbfcfa]"><Td><strong className="block text-[13px]">{rule.display_name||rule.provider_code}</strong><span className="font-mono text-[11px] text-[var(--fp-subtle)]">{rule.provider_code}</span></Td><Td>{rule.from_country} → {rule.to_country}</Td><Td>{rule.currencies.join(', ')||'—'}</Td><Td>{rule.fee_percent}% + {rule.fixed_fee}</Td><Td>{rule.fx_markup_percent}%</Td><Td>{rule.speed_minutes} min</Td><Td>{rule.reliability_percent==null?'—':`${rule.reliability_percent}%`}</Td><Td><StatusBadge status={rule.active?'active':'inactive'}/></Td><Td><div className="flex gap-1"><Button size="sm" variant="secondary" onClick={()=>setEditing({...rule})}>{lang==='ru'?'Изменить':'Edit'}</Button><Button size="sm" variant="ghost" onClick={()=>remove(rule.id)}><Trash2 size={13}/></Button></div></Td></tr>)}</tbody></table>{!rows.length&&<EmptyTable text={lang==='ru'?'Правил не найдено.':'No rules found.'}/>}</div></Card>
    </div>
  </>
}

function MiniStat({label,value}:{label:string;value:number|string}){return <div className="rounded-[12px] border border-[var(--fp-border)] bg-[#fafbf9] p-3"><strong className="block text-[22px] font-semibold tracking-[-.04em]">{value}</strong><span className="mt-1 block text-[11px] text-[var(--fp-muted)]">{label}</span></div>}
function EventDot({level}:{level:string}){return <span className={cn('mt-1.5 size-2 shrink-0 rounded-full',level==='error'?'bg-[var(--fp-red)]':level==='warning'?'bg-[var(--fp-amber)]':'bg-[var(--fp-green)]')}/>}
function SearchBox({value,onChange,placeholder}:{value:string;onChange:(value:string)=>void;placeholder:string}){return <label className="flex h-9 min-w-[220px] items-center gap-2 rounded-[9px] border border-[var(--fp-border)] bg-white px-3"><Search size={14} className="text-[var(--fp-subtle)]"/><input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} className="min-w-0 flex-1 bg-transparent text-[12px] outline-none placeholder:text-[var(--fp-subtle)]"/></label>}
function Th({children}:{children:React.ReactNode}){return <th className="px-4 py-3 font-semibold">{children}</th>}
function Td({children}:{children:React.ReactNode}){return <td className="px-4 py-3 text-[12px] text-[#39423d]">{children}</td>}
function EmptyTable({text}:{text:string}){return <div className="p-8 text-center text-[13px] text-[var(--fp-muted)]">{text}</div>}
function Field({label,children}:{label:string;children:React.ReactNode}){return <label className="block"><span className="mb-1.5 block text-[11px] font-semibold text-[var(--fp-muted)]">{label}</span>{children}</label>}
function Num({label,value,set}:{label:string;value:number;set:(value:number)=>void}){return <Field label={label}><Input type="number" value={Number.isFinite(value)?value:0} onChange={e=>set(Number(e.target.value)||0)}/></Field>}
