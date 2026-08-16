import Link from 'next/link'
import { ArrowLeft, Compass } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'

export default function NotFound() {
  return <main className="min-h-screen bg-[var(--fp-bg)] px-5 py-8">
    <div className="mx-auto max-w-[1180px]"><FlowPayLogo /></div>
    <section className="mx-auto grid min-h-[70vh] max-w-[720px] place-items-center text-center">
      <div className="fp-enter">
        <span className="mx-auto grid size-12 place-items-center rounded-[14px] border border-[var(--fp-border)] bg-white text-[var(--fp-green)] shadow-[var(--fp-shadow)]"><Compass size={21}/></span>
        <p className="mt-5 text-[13px] font-semibold uppercase tracking-[.14em] text-[var(--fp-green)]">404</p>
        <h1 className="mt-2 text-[34px] font-semibold tracking-[-.05em] sm:text-[44px]">Страница не найдена</h1>
        <p className="mx-auto mt-3 max-w-[440px] text-[12px] leading-6 text-[var(--fp-muted)]">Адрес больше не существует или был изменён.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--fp-green)] px-4 text-[12px] font-semibold text-white transition hover:bg-[var(--fp-green-strong)]"><ArrowLeft size={14}/>На главную</Link>
      </div>
    </section>
  </main>
}
