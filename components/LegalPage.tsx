'use client'

import Link from 'next/link'
import { ArrowLeft, Download, Printer } from 'lucide-react'
import { FlowPayLogo } from '@/components/brand/FlowPayLogo'
import { useLanguage } from '@/components/LanguageContext'
import { legalDocument, type LegalDocument } from '@/lib/legal'
import { Button } from '@/components/ui/button'

type LegacySection = { title: string; body: string[] }
type LegalPageProps =
  | { kind: 'privacy' | 'terms' }
  | {
      title: Record<string, string>
      updated: Record<string, string>
      sections: Record<string, LegacySection[]>
    }

function normalizeDocument(props: LegalPageProps, lang: string): { doc: LegalDocument; kind: 'privacy' | 'terms' | null } {
  if ('kind' in props) {
    return { doc: legalDocument(props.kind, lang), kind: props.kind }
  }

  const rows = props.sections[lang] ?? props.sections.en ?? []
  const localizedTitle = props.title[lang] ?? props.title.en ?? 'FlowPay'
  return {
    kind: null,
    doc: {
      title: localizedTitle,
      shortTitle: localizedTitle,
      updated: props.updated[lang] ?? props.updated.en ?? '',
      intro: '',
      sections: rows.map((section, index) => ({
        id: `section-${index + 1}`,
        title: section.title,
        paragraphs: section.body,
      })),
    },
  }
}

export function LegalPage(props: LegalPageProps) {
  const { lang } = useLanguage()
  const { doc, kind } = normalizeDocument(props, lang)
  const other = kind === 'privacy' ? '/terms' : '/privacy'
  const otherLabel = kind === 'privacy'
    ? (lang === 'ru' ? 'Условия использования' : 'Terms of Service')
    : (lang === 'ru' ? 'Политика конфиденциальности' : 'Privacy Policy')
  const showCommercialNotice = kind === 'privacy' || kind === 'terms'

  return <div className="min-h-screen bg-[#f7f8f5] text-[var(--fp-text)]">
    <header className="sticky top-0 z-30 border-b border-[var(--fp-border)] bg-white/95 backdrop-blur-sm print:hidden">
      <div className="mx-auto flex h-[68px] max-w-[1180px] items-center gap-3 px-5 sm:px-7">
        <Link href="/" aria-label="FlowPay home"><FlowPayLogo /></Link>
        <nav className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer size={14} />{lang === 'ru' ? 'Печать / PDF' : 'Print / PDF'}</Button>
          {kind && <Link href={other} className="hidden rounded-[9px] px-3 py-2 text-[13px] font-medium text-[var(--fp-muted)] hover:bg-[var(--fp-surface-muted)] sm:block">{otherLabel}</Link>}
          <Link href="/" className="inline-flex items-center gap-2 rounded-[9px] px-3 py-2 text-[13px] font-medium text-[var(--fp-muted)] hover:bg-[var(--fp-surface-muted)]"><ArrowLeft size={14} />{lang === 'ru' ? 'На главную' : 'Home'}</Link>
        </nav>
      </div>
    </header>

    <main className="mx-auto grid max-w-[1180px] gap-8 px-5 py-10 sm:px-7 sm:py-14 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="hidden lg:block print:hidden">
        <div className="sticky top-[96px] rounded-[16px] border border-[var(--fp-border)] bg-white p-4 shadow-[var(--fp-shadow)]">
          <p className="text-[11px] font-semibold uppercase tracking-[.12em] text-[var(--fp-green)]">{lang === 'ru' ? 'Содержание' : 'Contents'}</p>
          <nav className="mt-3 space-y-1">
            {doc.sections.map(section => <a key={section.id} href={`#${section.id}`} className="block rounded-[8px] px-2.5 py-2 text-[12px] leading-4 text-[var(--fp-muted)] hover:bg-[#f4f6f2] hover:text-[var(--fp-text)]">{section.title}</a>)}
          </nav>
        </div>
      </aside>

      <article className="min-w-0">
        <header className="rounded-[22px] border border-[var(--fp-border)] bg-white p-7 shadow-[0_18px_60px_rgba(31,52,38,.06)] sm:p-10">
          <span className="text-[12px] font-semibold uppercase tracking-[.13em] text-[var(--fp-green)]">FlowPay Legal</span>
          <h1 className="mt-3 max-w-[760px] text-[38px] font-semibold leading-[1.04] tracking-[-.055em] sm:text-[52px]">{doc.title}</h1>
          <p className="mt-4 text-[13px] font-medium text-[var(--fp-muted)]">{doc.updated}</p>
          {doc.intro && <p className="mt-6 max-w-[780px] text-[15px] leading-7 text-[var(--fp-muted)]">{doc.intro}</p>}
          {showCommercialNotice && <div className="mt-6 rounded-[12px] border border-[#e4d9b9] bg-[#fffaf0] px-4 py-3 text-[12px] leading-5 text-[#765c1c]">
            {lang === 'ru'
              ? 'Перед платным коммерческим запуском оператору FlowPay необходимо заполнить юридическое наименование, адрес, контакт по приватности и применимое право в соответствующих разделах документа.'
              : 'Before paid commercial launch, the FlowPay operator must fill in its legal name, address, privacy contact and governing law in the relevant sections.'}
          </div>}
        </header>

        <div className="mt-5 space-y-4">
          {doc.sections.map(section => <section id={section.id} key={section.id} className="scroll-mt-24 rounded-[18px] border border-[var(--fp-border)] bg-white p-6 sm:p-8">
            <h2 className="text-[20px] font-semibold tracking-[-.03em] sm:text-[22px]">{section.title}</h2>
            <div className="mt-4 space-y-3 text-[14px] leading-7 text-[var(--fp-muted)] sm:text-[15px]">
              {section.paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
              {section.bullets && <ul className="space-y-2 pl-5">{section.bullets.map(item => <li key={item} className="list-disc pl-1">{item}</li>)}</ul>}
            </div>
          </section>)}
        </div>

        <footer className="mt-6 flex flex-col gap-3 rounded-[16px] border border-[var(--fp-border)] bg-[#eef4ef] p-5 sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div><strong className="text-[14px]">{lang === 'ru' ? 'Нужна копия документа?' : 'Need a copy?'}</strong><p className="mt-1 text-[12px] text-[var(--fp-muted)]">{lang === 'ru' ? 'Используйте печать браузера, чтобы сохранить текущую версию в PDF.' : 'Use browser print to save this version as a PDF.'}</p></div>
          <Button variant="secondary" onClick={() => window.print()}><Download size={14} />{lang === 'ru' ? 'Сохранить как PDF' : 'Save as PDF'}</Button>
        </footer>
      </article>
    </main>
  </div>
}
