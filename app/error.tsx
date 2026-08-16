'use client'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { Button } from '@/components/ui/button'

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="min-h-screen bg-[var(--fp-bg)] px-5 py-8">
    <div className="mx-auto max-w-[1180px]"><FlowPayLogo /></div>
    <section className="mx-auto grid min-h-[70vh] max-w-[720px] place-items-center text-center">
      <div className="fp-enter">
        <span className="mx-auto grid size-12 place-items-center rounded-[14px] bg-[var(--fp-red-soft)] text-[var(--fp-red)]"><AlertTriangle size={20}/></span>
        <h1 className="mt-5 text-[30px] font-semibold tracking-[-.04em]">Не удалось открыть экран</h1>
        <p className="mx-auto mt-3 max-w-[460px] text-[12px] leading-6 text-[var(--fp-muted)]">Данные не были изменены. Попробуйте загрузить экран ещё раз.</p>
        <Button className="mt-6" onClick={reset}><RefreshCw size={14}/>Повторить</Button>
      </div>
    </section>
  </main>
}
