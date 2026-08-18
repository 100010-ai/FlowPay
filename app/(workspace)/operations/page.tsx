'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, CircleGauge, Clock3, FileCheck2, Landmark, Route, ShieldAlert, Sparkles, Users } from 'lucide-react'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
import { useLanguage } from '@/components/LanguageContext'
import { PageHeader, MetricCard } from '@/components/workspace/primitives'
import { Card } from '@/components/ui/card'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { buildOperationsSnapshot, type OperationsTask, type OperationsTaskKind, type OperationsTaskSeverity } from '@/lib/operations'
import { money, relativeDate } from '@/lib/metrics'
import { cn } from '@/lib/utils'
import type { Language } from '@/lib/types'

const kindIcons: Record<OperationsTaskKind, typeof Route> = { payment: Landmark, invoice: FileCheck2, counterparty: Users, approval: ShieldAlert, routing: Route }
const severityTone: Record<OperationsTaskSeverity, BadgeTone> = { critical: 'danger', high: 'warning', medium: 'info', low: 'neutral' }

export default function OperationsPage() {
  const ws = useWorkspace()
  const { lang } = useLanguage()
  const ru = lang === 'ru'
  const snapshot = useMemo(() => buildOperationsSnapshot({ payments: ws.payments, invoices: ws.invoices, counterparties: ws.counterparties, providerRules: ws.providerRules, lang }), [ws.payments, ws.invoices, ws.counterparties, ws.providerRules, lang])
  const [kind, setKind] = useState<'all'|OperationsTaskKind>('all')
  const tasks = kind === 'all' ? snapshot.tasks : snapshot.tasks.filter(task => task.kind === kind)
  const providerCount = new Set(ws.providerRules.map(rule => rule.provider_code)).size
  const activePayments = ws.payments.filter(payment => !['received','cancelled'].includes(payment.status)).length
  const clean = snapshot.tasks.length === 0

  return <div className="fp-enter">
    <PageHeader
      eyebrow="FlowPay Ops"
      title={ru ? 'Операционный центр' : 'Operations center'}
      subtitle={ru ? 'Единая очередь действий по платежам, счетам, согласованиям, реквизитам и production routing.' : 'One action queue across payments, invoices, approvals, payment details and production routing.'}
      actions={<Link href="/payments/new" className={cn(buttonVariants({size:'md'}))}>{ru?'Новый платёж':'New payment'}<ArrowRight size={15}/></Link>}
    />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <MetricCard className="xl:col-span-1" accent label={ru?'Ops score':'Ops score'} value={`${snapshot.score}/100`} meta={snapshot.score>=90?(ru?'операционная очередь чистая':'operations are under control'):snapshot.score>=70?(ru?'есть задачи на сегодня':'there are actions to review'):(ru?'нужна приоритизация':'prioritization required')} icon={<CircleGauge size={17}/>}/>
      <MetricCard label={ru?'Критичные':'Critical'} value={String(snapshot.critical)} meta={ru?'просрочки и блокирующие задачи':'overdue and blocking items'} icon={<AlertTriangle size={17}/>}/>
      <MetricCard label={ru?'7 дней':'Next 7 days'} value={String(snapshot.dueSevenDays)} meta={ru?'активных платежей со сроком':'active payments coming due'} icon={<Clock3 size={17}/>}/>
      <MetricCard label={ru?'Согласования':'Approvals'} value={String(snapshot.approvalQueue)} meta={ru?'требуют действия':'require action'} icon={<ShieldAlert size={17}/>}/>
      <MetricCard label={ru?'Routing health':'Routing health'} value={String(snapshot.routingGaps)} meta={providerCount?`${providerCount} ${ru?'production-провайдеров':'production providers'}`:(ru?'нет активных правил':'no active rules')} icon={<Route size={17}/>}/>
    </div>

    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--fp-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-[15px] font-semibold">{ru?'Очередь действий':'Action queue'}</h2><p className="mt-1 text-[13px] text-[var(--fp-muted)]">{ru?'Отсортировано по критичности и ближайшему сроку.':'Sorted by severity and nearest due date.'}</p></div>
          <div className="flex flex-wrap gap-1.5">{(['all','payment','approval','invoice','counterparty','routing'] as const).map(value=><button key={value} onClick={()=>setKind(value)} className={cn('rounded-[9px] px-2.5 py-1.5 text-[12px] font-semibold transition',kind===value?'bg-[#eaf3ec] text-[var(--fp-green-strong)]':'bg-[#f5f6f3] text-[var(--fp-muted)] hover:text-[var(--fp-text)]')}>{value==='all'?(ru?'Все':'All'):value==='payment'?(ru?'Платежи':'Payments'):value==='approval'?(ru?'Согласования':'Approvals'):value==='invoice'?(ru?'Счета':'Invoices'):value==='counterparty'?(ru?'Реквизиты':'Details'):'Routing'}</button>)}</div>
        </div>
        {tasks.length?<div className="divide-y divide-[var(--fp-border)]">{tasks.map(task=><TaskRow key={task.id} task={task} lang={lang}/>)}</div>:<div className="grid min-h-[430px] place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-[14px] bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><CheckCircle2 size={22}/></span><strong className="mt-4 block text-[16px]">{ru?'Очередь чистая':'Queue is clear'}</strong><p className="mt-2 max-w-md text-[14px] leading-5 text-[var(--fp-muted)]">{ru?'FlowPay не видит срочных действий по текущим данным. Новые задачи появятся здесь автоматически из реальных операций.':'FlowPay does not see urgent actions in the current data. New tasks will appear here automatically from real operations.'}</p></div></div>}
      </Card>

      <div className="space-y-4">
        <Card className="overflow-hidden border-[#d7e3d9] bg-[linear-gradient(145deg,#ffffff_0%,#f2f8f3_100%)] p-5 sm:p-6">
          <div className="flex items-center justify-between"><span className="grid size-10 place-items-center rounded-[12px] bg-white text-[var(--fp-green)] shadow-sm"><Sparkles size={18}/></span><Badge tone={clean?'success':'neutral'}>{clean?(ru?'Чисто':'Clear'):(ru?`${snapshot.tasks.length} задач`:`${snapshot.tasks.length} tasks`)}</Badge></div>
          <h2 className="mt-5 text-[19px] font-semibold tracking-[-.035em]">{ru?'Следующее лучшее действие':'Next best action'}</h2>
          {snapshot.tasks[0]?<><p className="mt-2 text-[14px] leading-6 text-[var(--fp-muted)]">{snapshot.tasks[0].title}. {snapshot.tasks[0].description}</p><Link href={snapshot.tasks[0].href} className="mt-5 inline-flex items-center gap-1.5 text-[14px] font-semibold text-[var(--fp-green)]">{ru?'Открыть задачу':'Open action'}<ArrowRight size={14}/></Link></>:<p className="mt-2 text-[14px] leading-6 text-[var(--fp-muted)]">{ru?'Срочных задач нет. Можно перейти к планированию будущих платежей и маршрутов.':'No urgent actions. You can focus on upcoming payments and route planning.'}</p>}
        </Card>

        <Card className="p-5 sm:p-6">
          <h2 className="text-[15px] font-semibold">{ru?'Контрольные показатели':'Control indicators'}</h2>
          <div className="mt-4 space-y-3"><ControlRow label={ru?'Активные платежи':'Active payments'} value={activePayments} good={activePayments>=0}/><ControlRow label={ru?'Settlement watch':'Settlement watch'} value={snapshot.settlementWatch} good={snapshot.settlementWatch===0}/><ControlRow label={ru?'Проблемы реквизитов':'Payment detail issues'} value={snapshot.dataIssues} good={snapshot.dataIssues===0}/><ControlRow label={ru?'Проблемы routing':'Routing issues'} value={snapshot.routingGaps} good={snapshot.routingGaps===0}/><ControlRow label={ru?'Очередь согласований':'Approval queue'} value={snapshot.approvalQueue} good={snapshot.approvalQueue===0}/></div>
          <div className="mt-5 border-t border-[var(--fp-border)] pt-4"><Link href="/activity" className="flex items-center justify-between rounded-[10px] px-1 py-2 text-[14px] font-semibold"><span>{ru?'Журнал активности':'Activity log'}</span><ArrowRight size={14} className="text-[var(--fp-subtle)]"/></Link><Link href="/treasury" className="flex items-center justify-between rounded-[10px] px-1 py-2 text-[14px] font-semibold"><span>{ru?'План обязательств':'Commitment plan'}</span><ArrowRight size={14} className="text-[var(--fp-subtle)]"/></Link></div>
        </Card>
      </div>
    </div>
  </div>
}

function TaskRow({task,lang}:{task:OperationsTask;lang:Language}) {
  const ru=lang==='ru';const Icon=kindIcons[task.kind]
  const iconClass=task.severity==='critical'?'bg-[var(--fp-red-soft)] text-[var(--fp-red)]':task.severity==='high'?'bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]':task.severity==='medium'?'bg-[var(--fp-blue-soft)] text-[var(--fp-blue)]':'bg-[#f0f3ef] text-[var(--fp-muted)]'
  return <Link href={task.href} className="group flex gap-4 px-5 py-4 transition hover:bg-[#f8faf7] sm:items-center"><span className={cn('grid size-10 shrink-0 place-items-center rounded-[12px]',iconClass)}><Icon size={18}/></span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><strong className="text-[14px]">{task.title}</strong><Badge tone={severityTone[task.severity]}>{task.severity==='critical'?(ru?'Критично':'Critical'):task.severity==='high'?(ru?'Высокий':'High'):task.severity==='medium'?(ru?'Средний':'Medium'):(ru?'Низкий':'Low')}</Badge></span><p className="mt-1 text-[13px] leading-5 text-[var(--fp-muted)]">{task.description}</p><div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-[var(--fp-subtle)]"><span>{task.entityLabel}</span>{task.amount!=null&&task.currency&&<span>{money(task.amount,task.currency,lang)}</span>}{task.dueAt&&<span>{ru?'Срок':'Due'}: {relativeDate(task.dueAt,lang)}</span>}</div></span><ArrowRight size={15} className="mt-2 shrink-0 text-[var(--fp-subtle)] transition group-hover:translate-x-0.5 sm:mt-0"/></Link>
}

function ControlRow({label,value,good}:{label:string;value:number;good:boolean}){return <div className="flex items-center justify-between gap-3"><span className="text-[13px] text-[var(--fp-muted)]">{label}</span><span className={cn('inline-flex min-w-8 items-center justify-center rounded-full px-2 py-1 text-[12px] font-bold',good?'bg-[var(--fp-green-soft)] text-[var(--fp-green)]':'bg-[var(--fp-amber-soft)] text-[var(--fp-amber)]')}>{value}</span></div>}
