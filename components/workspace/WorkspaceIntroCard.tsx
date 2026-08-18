'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Route, Users, WalletCards, X } from 'lucide-react'
import { useLanguage } from '@/components/LanguageContext'
import { useWorkspace } from './WorkspaceProvider'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function WorkspaceIntroCard(){
  const ws=useWorkspace();const {lang}=useLanguage();const ru=lang==='ru';const [visible,setVisible]=useState(false)
  useEffect(()=>{try{setVisible(localStorage.getItem('flowpay:v21:intro-dismissed')!=='1')}catch{setVisible(true)}},[])
  if(!visible||ws.payments.length>=5)return null
  const next=ws.counterparties.length===0?{href:'/counterparties',label:ru?'Добавить поставщика':'Add supplier',icon:Users}:ws.payments.length===0?{href:'/payments/new',label:ru?'Создать первый платёж':'Create first payment',icon:WalletCards}:ws.calculations.length===0?{href:'/routes',label:ru?'Сравнить варианты':'Compare options',icon:Route}:{href:'/operations',label:ru?'Посмотреть задачи':'Review attention items',icon:WalletCards}
  const Icon=next.icon
  function dismiss(){try{localStorage.setItem('flowpay:v21:intro-dismissed','1')}catch{}setVisible(false)}
  return <div className="mb-5 overflow-hidden rounded-[18px] border border-[#cfe0d3] bg-[linear-gradient(110deg,#f4faf5_0%,#ffffff_64%)] shadow-[0_10px_34px_rgba(24,74,41,.04)]"><div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-center"><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="text-[11px] font-bold uppercase tracking-[.12em] text-[var(--fp-green)]">{ru?'Начните отсюда':'Start here'}</span><button onClick={dismiss} className="ml-auto grid size-7 place-items-center rounded-lg text-[var(--fp-subtle)] hover:bg-white lg:hidden"><X size={14}/></button></div><h2 className="mt-2 text-[19px] font-semibold tracking-[-.035em]">{ru?'FlowPay ведёт платёж по одному понятному пути':'FlowPay follows one clear payment workflow'}</h2><p className="mt-1.5 max-w-3xl text-[13px] leading-5 text-[var(--fp-muted)]">{ru?'Поставщик → платёж → сравнение способов → согласование → оплата → сверка. Если не знаете, куда нажать, используйте кнопку справа — FlowPay выберет следующий логичный шаг.':'Supplier → payment → compare options → approval → settlement → reconciliation. If you are unsure where to go, use the next-step button.'}</p><div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-semibold text-[var(--fp-muted)]">{(ru?['1 Поставщик','2 Платёж','3 Варианты','4 Контроль','5 Сверка']:['1 Supplier','2 Payment','3 Options','4 Control','5 Reconcile']).map(x=><span key={x} className="rounded-full border border-[var(--fp-border)] bg-white px-2.5 py-1">{x}</span>)}</div></div><div className="flex shrink-0 items-center gap-2"><Link href={next.href} className={cn(buttonVariants({size:'md'}),'min-w-[190px] justify-center')}><Icon size={15}/>{next.label}<ArrowRight size={14}/></Link><button onClick={dismiss} className="hidden size-9 place-items-center rounded-[10px] text-[var(--fp-subtle)] hover:bg-white lg:grid" aria-label={ru?'Скрыть':'Dismiss'}><X size={15}/></button></div></div></div>
}
