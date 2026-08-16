'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { Language } from '@/lib/types'

const languages: Language[] = ['ru', 'en', 'fr', 'de', 'es']

const LanguageContext = createContext<{
  lang: Language
  setLang: (lang: Language) => void
} | null>(null)

function browserLanguage(): Language {
  if (typeof navigator === 'undefined') return 'ru'
  const short = navigator.language.toLowerCase().slice(0, 2) as Language
  return languages.includes(short) ? short : 'en'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('ru')

  useEffect(() => {
    const saved = window.localStorage.getItem('flowpay_lang') as Language | null
    const initial = saved && languages.includes(saved) ? saved : browserLanguage()
    setLangState(initial)
    document.documentElement.lang = initial
  }, [])

  const setLang = (next: Language) => {
    setLangState(next)
    window.localStorage.setItem('flowpay_lang', next)
    document.documentElement.lang = next
  }

  return <LanguageContext.Provider value={{ lang, setLang }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used inside LanguageProvider')
  return context
}
