'use client'

import Link from 'next/link'

import { useLanguage } from '@/components/app/language-provider'

const navLinks = [
  { href: '/platform', labelKey: 'nav.home' },
  { href: '/platform/orders', labelKey: 'nav.orders' },
  { href: '/platform/analytics', labelKey: 'nav.analytics' },
  { href: '/platform/setup', labelKey: 'nav.setup' },
  { href: '/admin', labelKey: 'nav.admin' },
]

export function TopNav() {
  const { lang, setLang, t } = useLanguage()

  return (
    <header className="global-nav-shell">
      <nav className="global-nav" aria-label="Primary">
        <Link className="global-nav-brand" href="/platform">
          Waiter AI
        </Link>
        <div className="global-nav-links">
          {navLinks.map((link) => (
            <Link key={link.href} className="global-nav-link" href={link.href}>
              {t(link.labelKey)}
            </Link>
          ))}

          <span className="global-nav-divider" aria-hidden="true" />

          <button
            className="global-nav-lang"
            type="button"
            onClick={() => setLang(lang === 'en' ? 'el' : 'en')}
            aria-label={lang === 'en' ? 'Ελληνικά' : 'English'}
            title={lang === 'en' ? 'Ελληνικά' : 'English'}
          >
            {lang === 'en' ? 'EL' : 'EN'}
          </button>

          <Link className="global-nav-login" href="/login">
            {t('nav.login')}
          </Link>
        </div>
      </nav>
    </header>
  )
}