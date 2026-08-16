'use client'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { useLanguage } from '@/components/LanguageContext'

export type LegalSection={title:string;body:string[]}
export function LegalPage({title,updated,sections}:{title:Record<string,string>;updated:Record<string,string>;sections:Record<string,LegalSection[]>}){
  const {lang}=useLanguage();const pick=(map:Record<string,string>)=>map[lang]||map.en;const rows=sections[lang]||sections.en||[]
  return <div className="min-h-screen bg-[#fafaf7]"><header className="border-b border-[var(--fp-border)] bg-white"><div className="mx-auto flex h-[68px] max-w-[1120px] items-center justify-between px-5"><FlowPayLogo/><Link href="/" className="inline-flex items-center gap-2 text-[14px] font-medium text-[var(--fp-muted)] hover:text-[var(--fp-text)]"><ArrowLeft size={14}/>{lang==='ru'?'На главную':'Back to home'}</Link></div></header><main className="mx-auto max-w-[860px] px-5 py-12 sm:py-16"><span className="text-[12px] font-semibold uppercase tracking-[.13em] text-[var(--fp-green)]">FlowPay</span><h1 className="mt-3 text-[38px] font-semibold tracking-[-.055em] sm:text-[46px]">{pick(title)}</h1><p className="mt-3 text-[14px] text-[var(--fp-muted)]">{pick(updated)}</p><div className="mt-10 space-y-8">{rows.map(section=><section key={section.title} className="rounded-[18px] border border-[var(--fp-border)] bg-white p-6 sm:p-7"><h2 className="text-[20px] font-semibold tracking-[-.03em]">{section.title}</h2><div className="mt-4 space-y-3 text-[15px] leading-7 text-[var(--fp-muted)]">{section.body.map((body,i)=><p key={i}>{body}</p>)}</div></section>)}</div></main></div>
}
