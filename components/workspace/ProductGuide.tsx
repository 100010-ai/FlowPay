'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle2, FileCheck2, Landmark, Route, ShieldCheck, Users, WalletCards, X } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useWorkspace } from './WorkspaceProvider'
import { cn } from '@/lib/utils'

export function ProductGuide({open,onClose}:{open:boolean;onClose:()=>void}){
  const {lang}=useLanguage();const ws=useWorkspace();const ru=lang==='ru'
  if(!open)return null
  const steps=[
    {done:ws.counterparties.length>0,icon:Users,title:ru?'1. Добавьте поставщика':'1. Add a supplier',text:ru?'Сохраните компанию-получателя и банковские реквизиты один раз.':'Save the beneficiary and bank details once.',href:'/counterparties'},
    {done:ws.payments.length>0,icon:WalletCards,title:ru?'2. Создайте платёж':'2. Create a payment',text:ru?'Укажите сумму, валюту, срок и счёт. Это будет рабочая карточка платежа.':'Add amount, currency, due date and invoice. This becomes the working payment record.',href:'/payments/new'},
    {done:ws.calculations.length>0,icon:Route,title:ru?'3. Сравните варианты':'3. Compare payment options',text:ru?'FlowPay покажет только доступные production routes из подтверждённых правил.':'FlowPay shows only available production routes backed by configured rules.',href:'/routes'},
    {done:ws.payments.some(p=>p.approval_status==='approved'||p.status==='paid'||p.status==='received'),icon:FileCheck2,title:ru?'4. Проверьте и отправьте':'4. Review and send',text:ru?'Если политика требует согласования, сначала получите решение, затем меняйте статус платежа.':'If controls require approval, record the decision before moving the payment forward.',href:'/approvals'},
    {done:ws.payments.some(p=>p.reconciliation_status==='matched'),icon:Landmark,title:ru?'5. Сверьте результат':'5. Reconcile the result',text:ru?'После оплаты подтвердите банковский reference, фактическую комиссию и сумму получателя.':'After settlement, record the bank reference, actual fee and recipient amount.',href:'/reconciliation'},
  ]
  const done=steps.filter(s=>s.done).length
  return <div className="fixed inset-0 z-[120] bg-[rgba(12,18,14,.22)] backdrop-blur-[2px]" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
    <aside className="fp-guide-drawer absolute inset-y-0 right-0 flex w-full max-w-[470px] flex-col border-l border-[var(--fp-border)] bg-white shadow-[var(--fp-shadow-lg)]">
      <div className="flex items-start justify-between gap-4 border-b border-[var(--fp-border)] p-5 sm:p-6"><div><div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.12em] text-[var(--fp-green)]"><ShieldCheck size={14}/>{ru?'Как работает FlowPay':'How FlowPay works'}</div><h2 className="mt-3 text-[25px] font-semibold tracking-[-.045em]">{ru?'От счёта до сверки, без путаницы':'From invoice to reconciliation, without the maze'}</h2><p className="mt-2 text-[13px] leading-5 text-[var(--fp-muted)]">{ru?'FlowPay помогает подготовить международный платёж, сравнить доступные способы, пройти контроль и сохранить фактический результат. Сам сервис не выдумывает маршруты и не подменяет отсутствующие банковские данные.':'FlowPay helps prepare an international payment, compare available options, apply controls and record the actual result. It does not invent missing routes or banking data.'}</p></div><button onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-[10px] border border-[var(--fp-border)] hover:bg-[var(--fp-surface-muted)]" aria-label={ru?'Закрыть':'Close'}><X size={17}/></button></div>
      <div className="fp-scrollbar flex-1 overflow-y-auto p-4 sm:p-5"><div className="mb-4 flex items-center justify-between rounded-[13px] border border-[#dce7de] bg-[#f4f8f4] px-4 py-3"><span className="text-[13px] font-medium text-[var(--fp-muted)]">{ru?'Ваш прогресс':'Your progress'}</span><strong className="text-[14px] text-[var(--fp-green)]">{done}/{steps.length}</strong></div><div className="space-y-2.5">{steps.map(step=>{const Icon=step.icon;return <Link key={step.href} href={step.href} onClick={onClose} className="group flex gap-3 rounded-[14px] border border-[var(--fp-border)] p-4 transition hover:border-[#cbd9ce] hover:bg-[#fafcf9]"><span className={cn('grid size-10 shrink-0 place-items-center rounded-[11px]',step.done?'bg-[var(--fp-green-soft)] text-[var(--fp-green)]':'bg-[#f1f4f0] text-[var(--fp-muted)]')}>{step.done?<CheckCircle2 size={17}/>:<Icon size={17}/>}</span><span className="min-w-0 flex-1"><strong className="block text-[14px]">{step.title}</strong><span className="mt-1 block text-[12px] leading-5 text-[var(--fp-muted)]">{step.text}</span></span><ArrowRight size={14} className="mt-1 shrink-0 text-[var(--fp-subtle)] transition group-hover:translate-x-0.5"/></Link>})}</div>
        <div className="mt-5 rounded-[14px] bg-[#111914] p-4 text-white"><strong className="text-[13px]">{ru?'Самая простая логика':'The simplest mental model'}</strong><p className="mt-2 text-[12px] leading-5 text-white/70">{ru?'Поставщик → Платёж → Сравнение вариантов → Согласование → Оплата → Сверка. Всё остальное в интерфейсе помогает контролировать эти шесть шагов.':'Supplier → Payment → Compare options → Approval → Settlement → Reconciliation. Everything else exists to control those six steps.'}</p></div>
      </div>
    </aside>
  </div>
}
