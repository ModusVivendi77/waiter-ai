'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

import { translations, type Language } from '@/lib/i18n/translations'

const STORAGE_KEY = 'waiter-ai-language'

type LanguageContextValue = {
  lang: Language
  setLang: (lang: Language) => void
  t: (key: string, params?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en')

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null
    if (saved === 'en' || saved === 'el') {
      setLangState(saved)
    }
  }, [])

  const setLang = useCallback((next: Language) => {
    setLangState(next)
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, next)
    }
    if (typeof document !== 'undefined') {
      document.documentElement.lang = next
    }
  }, [])

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      let text = translations[key]?.[lang] ?? translations[key]?.en ?? key
      if (params) {
        for (const [name, value] of Object.entries(params)) {
          text = text.replaceAll(`{${name}}`, String(value))
        }
      }
      return text
    },
    [lang]
  )

  return <LanguageContext.Provider value={{ lang, setLang, t }}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
