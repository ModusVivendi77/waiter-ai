'use client'

import { useLanguage } from '@/components/app/language-provider'

// Compact EN/EL toggle for customer-facing pages (table menu + order tracking),
// where the full platform navigation bar is hidden.
export function LanguageToggle({ style }: { style?: React.CSSProperties }) {
  const { lang, setLang } = useLanguage()

  return (
    <button
      className="global-nav-lang"
      type="button"
      style={style}
      onClick={() => setLang(lang === 'en' ? 'el' : 'en')}
      aria-label={lang === 'en' ? 'Ελληνικά' : 'English'}
      title={lang === 'en' ? 'Ελληνικά' : 'English'}
    >
      {lang === 'en' ? 'EL' : 'EN'}
    </button>
  )
}
