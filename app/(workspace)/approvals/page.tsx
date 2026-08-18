'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Check, CheckCircle2, Clock3, FileCheck2, MessageSquareText, Send, ShieldCheck, X, XCircle } from 'lucide-react'
import { useWorkspace } from '@/components/workspace/WorkspaceProvider'
import { useLanguage } from '@/components/LanguageContext'
import { PageHeader, MetricCard, StatusBadge } from '@/components/workspace/primitives'
import { Card } from '@/components/ui/card'
import { Button, buttonVariants } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/client'
import { money, relativeDate } from '@/lib/metrics'
import type { PaymentApprovalEvent, PaymentDraft } from '@/lib/types'
import { cn } from '@/lib/utils'

const activeStates = new Set(['required', 'pending', 'rejected'])

export default function ApprovalsPage() {
  const ws = useWorkspace()
  const { lang } = useLanguage()
  const ru = lang === 'ru'
  const search = useSearchParams()
  const requestedPayment = search.get('payment') || ''
  const [selectedId, setSelectedId] = useState(requestedPayment)
  const [note, setNote] = useState('')
  const [working, setWorking] = useState(false)
  const [notice, setNotice] = useState('')
  const [filter, setFilter] = useState<'queue'|'all'>('queue')

  useEffect(()=>{if(requestedPayment)setSelectedId(requestedPayment)},[requestedPayment])

  const payments = useMemo(() => ws.payments.filter(payment => payment.approval_status !== 'not_required'), [ws.payments])
  const queue = payments.filter(payment => activeStates.has(payment.approval_status))
  const selected = payments.find(payment => payment.id === selectedId) || queue[0] || payments[0] || null
  const pending = payments.filter(payment => payment.approval_status === 'pending').length
  const approved = payments.filter(payment => payment.approval_status === 'approved').length
  const rejected = payments.filter(payment => payment.approval_status === 'rejected').length
  const rows = filter === 'queue' ? queue : payments

  async function token() {
    const { data } = await createClient().auth.getSession()
    return data.session?.access_token || ''
  }

  async function mutate(method: 'POST'|'PATCH', payment: PaymentDraft, decision?: 'approved'|'rejected') {
    setWorking(true)
    setNotice('')
    try {
      const accessToken = await token()
      if (!accessToken) throw new Error('UNAUTHORIZED')
      const response = await fetch('/api/approvals', {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ paymentId: payment.id, ...(decision ? { decision } : {}), note }),
      })
      if (!response.ok) throw new Error('APPROVAL_FAILED')
      setNote('')
      setNotice(decision === 'approved' ? (ru ? 'Платёж согласован.' : 'Payment approved.') : decision === 'rejected' ? (ru ? 'Платёж отклонён.' : 'Payment rejected.') : (ru ? 'Платёж отправлен на согласование.' : 'Payment sent for approval.'))
      await ws.refresh()
    } catch {
      setNotice(ru ? 'Не удалось изменить состояние согласования. Обновите страницу и попробуйте ещё раз.' : 'Could not update the approval state. Refresh and try again.')
    } finally {
      setWorking(false)
    }
  }

  return <div className="fp-enter">
    <PageHeader
      eyebrow="FlowPay Control"
      title={ru ? 'Согласования' : 'Approvals'}
      subtitle={ru ? 'Контрольный этап перед исполнением платежа: правило блокирует переход дальше, пока решение не завершено.' : 'A control gate before execution: the payment cannot advance until the decision is complete.'}
      actions={<Link href="/settings" className={cn(buttonVariants({variant:'secondary',size:'md'}))}><ShieldCheck size={15}/>{ru ? 'Политика контроля' : 'Control policy'}</Link>}
    />

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label={ru?'Очередь':'In queue'} value={String(queue.length)} meta={ru?'требуют действия':'require action'} icon={<FileCheck2 size={17}/>}/>
      <MetricCard label={ru?'Ожидают решения':'Pending decision'} value={String(pending)} meta={ru?'запрос уже создан':'request already submitted'} icon={<Clock3 size={17}/>}/>
      <MetricCard label={ru?'Согласовано':'Approved'} value={String(approved)} meta={ru?'можно переводить в Ready':'can move to Ready'} icon={<CheckCircle2 size={17}/>}/>
      <MetricCard label={ru?'Отклонено':'Rejected'} value={String(rejected)} meta={ru?'можно исправить и отправить снова':'can be revised and resubmitted'} icon={<XCircle size={17}/>}/>
    </div>

    <Card className="mt-4 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[var(--fp-border)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[15px] font-semibold">{ru?'Очередь контроля':'Control queue'}</h2>
          <p className="mt-1 text-[13px] text-[var(--fp-muted)]">{ws.profile?.approval_enabled ? (ru?`Политика включена · порог ${money(ws.profile.approval_threshold,ws.profile.preferred_currency||'EUR',lang)}`:`Policy enabled · threshold ${money(ws.profile.approval_threshold,ws.profile.preferred_currency||'EUR',lang)}`) : (ru?'Автоматическая политика выключена. Ранее созданные согласования остаются в истории.':'Automatic policy is off. Existing approval history remains available.')}</p>
        </div>
        <div className="inline-flex rounded-[10px] border border-[var(--fp-border)] bg-[#f7f8f5] p-1">
          <button onClick={()=>setFilter('queue')} className={cn('rounded-[8px] px-3 py-1.5 text-[13px] font-semibold',filter==='queue'?'bg-white text-[var(--fp-text)] shadow-sm':'text-[var(--fp-muted)]')}>{ru?'Очередь':'Queue'}</button>
          <button onClick={()=>setFilter('all')} className={cn('rounded-[8px] px-3 py-1.5 text-[13px] font-semibold',filter==='all'?'bg-white text-[var(--fp-text)] shadow-sm':'text-[var(--fp-muted)]')}>{ru?'История':'History'}</button>
        </div>
      </div>

      <div className="grid min-h-[520px] xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="border-b border-[var(--fp-border)] xl:border-b-0 xl:border-r">
          {rows.length ? <div className="divide-y divide-[var(--fp-border)]">
            {rows.map(payment => <button key={payment.id} onClick={()=>setSelectedId(payment.id)} className={cn('flex w-full items-center gap-4 px-5 py-4 text-left transition hover:bg-[#f8faf7]',selected?.id===payment.id&&'bg-[#f3f8f4]')}>
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-[12px]',payment.approval_status==='rejected'?'bg-[var(--fp-red-soft)] text-[var(--fp-red)]':payment.approval_status==='approved'?'bg-[var(--fp-green-soft)] text-[var(--fp-green)]':'bg-[var(--fp-blue-soft)] text-[var(--fp-blue)]')}>{payment.approval_status==='approved'?<Check size={18}/>:payment.approval_status==='rejected'?<X size={18}/>:<FileCheck2 size={18}/>}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2"><strong className="truncate text-[14px]">{payment.supplier_name}</strong><StatusBadge status={payment.approval_status}/></span>
                <small className="mt-1 block truncate text-[13px] text-[var(--fp-muted)]">{payment.invoice_number||(ru?'Без номера счёта':'No invoice number')} · {money(payment.amount,payment.currency,lang)} · {payment.due_date ? relativeDate(payment.due_date,lang) : (ru?'без срока':'no due date')}</small>
              </span>
            </button>)}
          </div> : <div className="grid min-h-[360px] place-items-center p-8 text-center"><div><span className="mx-auto grid size-12 place-items-center rounded-[14px] bg-[var(--fp-green-soft)] text-[var(--fp-green)]"><CheckCircle2 size={21}/></span><strong className="mt-4 block text-[15px]">{ru?'Очередь пуста':'Queue is clear'}</strong><p className="mt-2 max-w-sm text-[14px] leading-5 text-[var(--fp-muted)]">{ru?'Нет платежей, требующих решения по согласованию.':'No payments currently require an approval decision.'}</p></div></div>}
        </div>

        <aside className="p-5 sm:p-6">
          {selected ? <>
            <div className="flex items-start justify-between gap-3"><div><span className="text-[12px] font-semibold uppercase tracking-[.12em] text-[var(--fp-subtle)]">{ru?'Платёж':'Payment'}</span><h3 className="mt-1 text-[18px] font-semibold tracking-[-.03em]">{selected.supplier_name}</h3><p className="mt-1 text-[13px] text-[var(--fp-muted)]">{selected.invoice_number||'—'}</p></div><StatusBadge status={selected.approval_status}/></div>
            <dl className="mt-5 space-y-3 border-y border-[var(--fp-border)] py-4 text-[13px]">
              <div className="flex justify-between gap-4"><dt className="text-[var(--fp-muted)]">{ru?'Сумма':'Amount'}</dt><dd className="font-semibold">{money(selected.amount,selected.currency,lang)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--fp-muted)]">{ru?'Срок':'Due'}</dt><dd>{relativeDate(selected.due_date,lang)}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--fp-muted)]">{ru?'Маршрут':'Route'}</dt><dd className="text-right">{selected.route_from_country&&selected.route_to_country?`${selected.route_from_country} → ${selected.route_to_country}`:'—'}</dd></div>
              <div className="flex justify-between gap-4"><dt className="text-[var(--fp-muted)]">{ru?'Провайдер':'Provider'}</dt><dd className="max-w-[190px] truncate text-right">{selected.route_provider_code||'—'}</dd></div>
            </dl>

            <label className="mt-5 block"><span className="mb-1.5 flex items-center gap-1.5 text-[13px] font-semibold text-[var(--fp-muted)]"><MessageSquareText size={14}/>{ru?'Комментарий':'Comment'}</span><Input value={note} onChange={e=>setNote(e.target.value)} maxLength={500} placeholder={ru?'Необязательно':'Optional'}/></label>

            <div className="mt-4 grid gap-2">
              {(selected.approval_status==='required'||selected.approval_status==='rejected')&&<Button disabled={working} onClick={()=>mutate('POST',selected)}><Send size={15}/>{selected.approval_status==='rejected'?(ru?'Отправить повторно':'Resubmit'):(ru?'Запросить согласование':'Request approval')}</Button>}
              {selected.approval_status==='pending'&&<div className="grid grid-cols-2 gap-2"><Button disabled={working} onClick={()=>mutate('PATCH',selected,'approved')}><Check size={15}/>{ru?'Согласовать':'Approve'}</Button><Button variant="secondary" className="text-[var(--fp-red)]" disabled={working} onClick={()=>mutate('PATCH',selected,'rejected')}><X size={15}/>{ru?'Отклонить':'Reject'}</Button></div>}
              {selected.approval_status==='approved'&&<Link href={`/payments?selected=${selected.id}`} className={cn(buttonVariants({variant:'soft',size:'md'}),'w-full')}>{ru?'Открыть платёж':'Open payment'}</Link>}
            </div>
            {notice&&<p className="mt-4 rounded-[10px] bg-[#f5f7f4] p-3 text-[13px] leading-5 text-[var(--fp-muted)]">{notice}</p>}

            <div className="mt-6 border-t border-[var(--fp-border)] pt-4"><div className="flex items-center justify-between"><strong className="text-[13px]">{ru?'История':'History'}</strong><Badge tone="neutral">{ws.approvalEvents.filter(event=>event.payment_id===selected.id).length}</Badge></div><div className="mt-3 space-y-3">{ws.approvalEvents.filter(event=>event.payment_id===selected.id).slice(0,6).map(event=>{const snapshot=approvalEventSnapshot(event);return <div key={event.id} className="flex gap-3"><span className="mt-1 size-2 rounded-full bg-[var(--fp-green)]"/><div className="min-w-0"><strong className="block text-[13px]">{event.event==='requested'?(ru?'Запрошено согласование':'Approval requested'):event.event==='approved'?(ru?'Согласовано':'Approved'):(ru?'Отклонено':'Rejected')}</strong><p className="mt-0.5 text-[12px] text-[var(--fp-subtle)]">{relativeDate(event.created_at,lang)}{event.note?` · ${event.note}`:''}</p>{snapshot.amount!=null&&snapshot.currency&&<p className="mt-1 text-[11px] text-[var(--fp-muted)]">{ru?'Снимок решения':'Decision snapshot'} · {money(snapshot.amount,snapshot.currency,lang)}{snapshot.routeProvider?` · ${snapshot.routeProvider}`:''}</p>}</div></div>})}</div></div>
          </> : <div className="grid min-h-[320px] place-items-center text-center"><p className="text-[14px] text-[var(--fp-muted)]">{ru?'Выберите платёж слева.':'Select a payment on the left.'}</p></div>}
        </aside>
      </div>
    </Card>
  </div>
}

function approvalEventSnapshot(event:PaymentApprovalEvent){
  const raw=event.payment_snapshot||{}
  const amount=typeof raw.amount==='number'?raw.amount:typeof raw.amount==='string'&&raw.amount.trim()?Number(raw.amount):null
  return {
    amount:amount!=null&&Number.isFinite(amount)?amount:null,
    currency:typeof raw.currency==='string'?raw.currency:'',
    routeProvider:typeof raw.route_provider_code==='string'?raw.route_provider_code:'',
  }
}
