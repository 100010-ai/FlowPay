'use client'

import { useMemo, useState } from 'react'
import { Activity, CheckCircle2, FileCheck2, KeyRound, Landmark, Search, Settings2, ShieldAlert } from 'lucide-react'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
import { useLanguage } from '@/components/LanguageContext'
import { PageHeader, MetricCard } from '@/components/workspace/primitives'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { relativeDate } from '@/lib/metrics'
import { cn } from '@/lib/utils'

type Row={id:string;kind:'approval'|'audit'|'payment';title:string;subtitle:string;date:string;tone:BadgeTone;icon:typeof Activity}

export default function ActivityPage(){
  const ws=useWorkspace();const {lang}=useLanguage();const ru=lang==='ru';const [query,setQuery]=useState('');const [filter,setFilter]=useState<'all'|'approval'|'audit'|'payment'>('all')
  const rows=useMemo<Row[]>(()=>{
    const result:Row[]=[]
    for(const event of ws.approvalEvents){const payment=ws.payments.find(p=>p.id===event.payment_id);const snapshotSupplier=typeof event.payment_snapshot?.supplier_name==='string'?event.payment_snapshot.supplier_name:'';result.push({id:`approval-${event.id}`,kind:'approval',title:event.event==='requested'?(ru?'Запрошено согласование':'Approval requested'):event.event==='approved'?(ru?'Платёж согласован':'Payment approved'):(ru?'Платёж отклонён':'Payment rejected'),subtitle:`${payment?.supplier_name||snapshotSupplier||event.payment_id}${event.note?` · ${event.note}`:''}`,date:event.created_at,tone:event.event==='approved'?'success':event.event==='rejected'?'danger':'info',icon:FileCheck2})}
    for(const event of ws.auditLogs){const isKey=event.entity_type==='api_keys';const isProfile=event.entity_type==='company_profiles';result.push({id:`audit-${event.id}`,kind:'audit',title:isKey?(ru?'Изменён API-доступ':'API access changed'):isProfile?(ru?'Изменены настройки компании':'Company settings changed'):(ru?'Изменён объект workspace':'Workspace object changed'),subtitle:`${event.entity_type} · ${event.action}`,date:event.created_at,tone:isKey?'warning':'neutral',icon:isKey?KeyRound:isProfile?Settings2:ShieldAlert})}
    for(const payment of ws.payments.slice(0,120)){result.push({id:`payment-${payment.id}-${payment.updated_at}`,kind:'payment',title:payment.status==='received'?(ru?'Платёж получен':'Payment received'):payment.status==='paid'?(ru?'Платёж оплачен':'Payment paid'):payment.status==='ready'?(ru?'Платёж готов':'Payment ready'):payment.status==='failed'?(ru?'Ошибка платежа':'Payment failed'):(ru?'Платёж обновлён':'Payment updated'),subtitle:`${payment.supplier_name} · ${payment.currency} ${Number(payment.amount).toLocaleString()}`,date:payment.updated_at,tone:['paid','received'].includes(payment.status)?'success':payment.status==='failed'?'danger':payment.status==='ready'?'info':'neutral',icon:Landmark})}
    return result.sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime()).filter((row,index,all)=>all.findIndex(other=>other.id===row.id)===index)
  },[ws.approvalEvents,ws.auditLogs,ws.payments,ru])
  const filtered=rows.filter(row=>(filter==='all'||row.kind===filter)&&(!query.trim()||`${row.title} ${row.subtitle}`.toLowerCase().includes(query.trim().toLowerCase())))
  const last24=rows.filter(row=>Date.now()-new Date(row.date).getTime()<=86_400_000).length
  const security=rows.filter(row=>row.kind==='audit'&&row.tone==='warning').length
  const approvals=rows.filter(row=>row.kind==='approval').length

  return <div className="fp-enter"><PageHeader eyebrow="FlowPay Timeline" title={ru?'Журнал активности':'Activity timeline'} subtitle={ru?'Единая хронология изменений платежей, согласований и чувствительных действий в workspace.':'A unified timeline of payment changes, approvals and sensitive workspace actions.'}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label={ru?'События':'Events'} value={String(rows.length)} meta={ru?'в загруженной истории':'in loaded history'} icon={<Activity size={17}/>}/><MetricCard label={ru?'24 часа':'Last 24h'} value={String(last24)} meta={ru?'последние изменения':'recent changes'} icon={<CheckCircle2 size={17}/>}/><MetricCard label={ru?'Согласования':'Approvals'} value={String(approvals)} meta={ru?'контрольные решения':'control decisions'} icon={<FileCheck2 size={17}/>}/><MetricCard label={ru?'Доступ и ключи':'Access & keys'} value={String(security)} meta={ru?'события, требующие внимания':'attention-worthy events'} icon={<KeyRound size={17}/>}/></div>
    <Card className="mt-4 overflow-hidden"><div className="flex flex-col gap-3 border-b border-[var(--fp-border)] p-4 sm:flex-row sm:items-center"><label className="flex h-10 flex-1 items-center gap-2 rounded-[10px] border border-[var(--fp-border)] bg-white px-3"><Search size={15} className="text-[var(--fp-subtle)]"/><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder={ru?'Поиск по журналу…':'Search activity…'} className="h-auto border-0 bg-transparent p-0 shadow-none focus-visible:ring-0"/></label><div className="flex gap-1 rounded-[10px] bg-[#f3f5f2] p-1">{(['all','payment','approval','audit'] as const).map(value=><button key={value} onClick={()=>setFilter(value)} className={cn('rounded-[8px] px-3 py-1.5 text-[12px] font-semibold',filter===value?'bg-white shadow-sm':'text-[var(--fp-muted)]')}>{value==='all'?(ru?'Все':'All'):value==='payment'?(ru?'Платежи':'Payments'):value==='approval'?(ru?'Согласования':'Approvals'):(ru?'Система':'System')}</button>)}</div></div>
      {filtered.length?<div className="divide-y divide-[var(--fp-border)]">{filtered.slice(0,250).map(row=>{const Icon=row.icon;return <div key={row.id} className="flex gap-4 px-5 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-[12px] bg-[#f1f5f1] text-[var(--fp-green)]"><Icon size={17}/></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-[14px]">{row.title}</strong><Badge tone={row.tone}>{row.kind==='approval'?(ru?'Контроль':'Control'):row.kind==='payment'?(ru?'Платёж':'Payment'):(ru?'Система':'System')}</Badge></div><p className="mt-1 truncate text-[13px] text-[var(--fp-muted)]">{row.subtitle}</p></div><span className="shrink-0 text-[12px] text-[var(--fp-subtle)]">{relativeDate(row.date,lang)}</span></div>})}</div>:<div className="grid min-h-[360px] place-items-center text-center"><p className="text-[14px] text-[var(--fp-muted)]">{ru?'По этому фильтру событий нет.':'No events match this filter.'}</p></div>}
    </Card>
  </div>
}
