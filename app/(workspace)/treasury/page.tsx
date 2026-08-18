'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowRight, CalendarClock, CircleDollarSign, Coins, Landmark, Layers3, TriangleAlert } from 'lucide-react'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
import { useLanguage } from '@/components/LanguageContext'
import { PageHeader, MetricCard } from '@/components/workspace/primitives'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useFxMap } from '@/hooks/use-fx-map'
import { money, normalize, relativeDate } from '@/lib/metrics'
import { cn } from '@/lib/utils'

export default function TreasuryPage(){
  const ws=useWorkspace();const {lang}=useLanguage();const ru=lang==='ru';const base=ws.profile?.preferred_currency||null
  const active=useMemo(()=>ws.payments.filter(p=>!['paid','received','cancelled'].includes(p.status)),[ws.payments])
  const orphanInvoices=useMemo(()=>ws.invoices.filter(i=>['open','scheduled'].includes(i.status)&&!i.payment_draft_id),[ws.invoices])
  const currencies=useMemo(()=>Array.from(new Set([...active.map(p=>p.currency),...orphanInvoices.map(i=>i.currency)])),[active,orphanInvoices])
  const fx=useFxMap(base,currencies)
  const today=useMemo(()=>{const d=new Date();d.setHours(0,0,0,0);return d},[])
  const days=(date:string|null)=>date?Math.floor((new Date(`${date}T00:00:00`).getTime()-today.getTime())/86_400_000):null
  const inWindow=(due:string|null,max:number,min=0)=>{const d=days(due);return d!=null&&d>=min&&d<=max}
  const overdue=active.filter(p=>{const d=days(p.due_date);return d!=null&&d<0})
  const next7=active.filter(p=>inWindow(p.due_date,7))
  const next30=active.filter(p=>inWindow(p.due_date,30))
  const next90=active.filter(p=>inWindow(p.due_date,90))
  const normalized=(rows:typeof active)=>base?rows.map(p=>normalize(Number(p.amount),p.currency,base,fx.rates)) : []
  const total=(rows:typeof active)=>{if(!base)return null;const values=normalized(rows);return values.every(v=>v!=null)?values.reduce((s,v)=>s+Number(v),0):null}
  const exposure=useMemo(()=>{const map=new Map<string,{currency:string;amount:number;count:number;normalized:number|null}>();for(const p of active){const row=map.get(p.currency)||{currency:p.currency,amount:0,count:0,normalized:base?0:null};row.amount+=Number(p.amount);row.count++;const value=base?normalize(Number(p.amount),p.currency,base,fx.rates):null;if(base&&(value==null||row.normalized==null))row.normalized=null;else if(base)row.normalized=Number(row.normalized)+Number(value);map.set(p.currency,row)}return [...map.values()].sort((a,b)=>((b.normalized??b.amount)-(a.normalized??a.amount)))},[active,base,fx.rates])
  const dated=active.filter(p=>p.due_date).sort((a,b)=>String(a.due_date).localeCompare(String(b.due_date))).slice(0,10)
  const maxExposure=Math.max(1,...exposure.map(row=>row.normalized??row.amount))

  return <div className="fp-enter">
    <PageHeader eyebrow="FlowPay Treasury" title={ru?'Обязательства и ликвидность':'Commitments & liquidity'} subtitle={ru?'План исходящих обязательств по фактическим платежам. Никаких синтетических FX: если референсный курс недоступен, валюта остаётся отдельной.':'A forward view of actual outgoing commitments. No synthetic FX: when a reference rate is unavailable, that currency remains separate.'} actions={<Link href="/payments" className="inline-flex h-11 items-center gap-2 rounded-[11px] border border-[var(--fp-border)] bg-white px-5 text-[14px] font-semibold hover:bg-[var(--fp-surface-muted)]">{ru?'Платежи':'Payments'}<ArrowRight size={14}/></Link>}/>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard accent label={ru?'Следующие 7 дней':'Next 7 days'} value={base&&total(next7)!=null?money(total(next7),base,lang,true):String(next7.length)} meta={base&&total(next7)==null?(ru?'есть валюты без reference FX':'some currencies lack reference FX'):(ru?`${next7.length} платежей`:`${next7.length} payments`)} icon={<CalendarClock size={17}/>}/>
      <MetricCard label={ru?'30 дней':'30 days'} value={base&&total(next30)!=null?money(total(next30),base,lang,true):String(next30.length)} meta={ru?'активные обязательства':'active commitments'} icon={<CircleDollarSign size={17}/>}/>
      <MetricCard label={ru?'90 дней':'90 days'} value={base&&total(next90)!=null?money(total(next90),base,lang,true):String(next90.length)} meta={ru?'плановый горизонт':'planning horizon'} icon={<Layers3 size={17}/>}/>
      <MetricCard label={ru?'Просрочено':'Overdue'} value={String(overdue.length)} meta={overdue.length?(ru?'требуют немедленного внимания':'require immediate attention'):(ru?'просрочек нет':'no overdue commitments')} icon={<TriangleAlert size={17}/>} className={overdue.length?'[&_strong]:text-[var(--fp-red)]':''}/>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[1.15fr_.85fr]">
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4"><div><h2 className="text-[16px] font-semibold tracking-[-.02em]">{ru?'Валютная экспозиция':'Currency exposure'}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{ru?'Только незавершённые платежи. Полосы нормализуются в базовую валюту только при наличии reference FX.':'Outstanding payments only. Bars normalize to the reporting currency only when reference FX is available.'}</p></div><Badge tone="neutral">{base||'multi-currency'}</Badge></div>
        <div className="mt-6 space-y-4">{exposure.length?exposure.map(row=><div key={row.currency}><div className="flex items-end justify-between gap-4"><div><strong className="text-[14px]">{row.currency}</strong><span className="ml-2 text-[12px] text-[var(--fp-subtle)]">{row.count} {ru?'плат.':'payments'}</span></div><div className="text-right"><strong className="block text-[14px]">{money(row.amount,row.currency,lang)}</strong>{base&&row.currency!==base&&<span className="text-[12px] text-[var(--fp-subtle)]">{row.normalized!=null?`≈ ${money(row.normalized,base,lang)}`:(ru?'reference FX недоступен':'reference FX unavailable')}</span>}</div></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0ec]"><div className={cn('h-full rounded-full',row.normalized==null&&base?'bg-[#c9cec9]':'bg-[var(--fp-green)]')} style={{width:`${Math.max(4,Math.min(100,((row.normalized??row.amount)/maxExposure)*100))}%`}}/></div></div>):<p className="rounded-[12px] bg-[#f6f8f5] p-5 text-center text-[14px] text-[var(--fp-muted)]">{ru?'Нет активных обязательств.':'No active commitments.'}</p>}</div>
        {fx.missing.length>0&&<div className="mt-5 rounded-[11px] border border-[#eadfca] bg-[var(--fp-amber-soft)] p-3 text-[13px] leading-5 text-[var(--fp-amber)]">{ru?'Не включены в общий нормализованный итог':'Excluded from normalized totals'}: {fx.missing.join(', ')}.</div>}
      </Card>

      <Card className="overflow-hidden"><div className="border-b border-[var(--fp-border)] px-5 py-4"><h2 className="text-[16px] font-semibold tracking-[-.02em]">{ru?'Ближайший календарь':'Upcoming calendar'}</h2><p className="mt-1 text-[13px] text-[var(--fp-muted)]">{ru?'Следующие платежи по due date':'Next payments by due date'}</p></div>{dated.length?<div className="divide-y divide-[var(--fp-border)]">{dated.map(payment=><Link key={payment.id} href={`/payments?selected=${payment.id}`} className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-[#f8faf7]"><span className="grid size-9 shrink-0 place-items-center rounded-[11px] bg-[#f0f5f0] text-[var(--fp-green)]"><Landmark size={16}/></span><span className="min-w-0 flex-1"><strong className="block truncate text-[13px]">{payment.supplier_name}</strong><small className="mt-0.5 block text-[12px] text-[var(--fp-muted)]">{money(payment.amount,payment.currency,lang)}</small></span><span className={cn('text-right text-[12px] font-medium',Number(days(payment.due_date))<0?'text-[var(--fp-red)]':'text-[var(--fp-muted)]')}>{relativeDate(payment.due_date,lang)}</span></Link>)}</div>:<div className="p-6 text-center text-[14px] text-[var(--fp-muted)]">{ru?'Платежей со сроками пока нет.':'No dated payments yet.'}</div>}</Card>
    </div>

    {orphanInvoices.length>0&&<Card className="mt-4 p-5 sm:p-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[var(--fp-blue-soft)] text-[var(--fp-blue)]"><Coins size={18}/></span><div><h2 className="text-[15px] font-semibold">{ru?'Счета вне платёжного плана':'Invoices outside the payment plan'}</h2><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{ru?`${orphanInvoices.length} открытых счетов ещё не связаны с платежами и поэтому не входят в основной cash commitment.`:`${orphanInvoices.length} open invoices are not linked to payments, so they are not included in the main cash commitment.`}</p></div></div><Link href="/invoices" className="shrink-0 text-[13px] font-semibold text-[var(--fp-green)]">{ru?'Разобрать счета':'Review invoices'} →</Link></div></Card>}
  </div>
}
