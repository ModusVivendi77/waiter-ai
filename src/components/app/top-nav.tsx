'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/app/language-provider'
import { getPendingNewOrders, subscribeNewOrders } from '@/lib/notifications/new-order-alert'

const navLinks = [
  { href: '/platform', labelKey: 'nav.home' },
  { href: '/platform/orders', labelKey: 'nav.orders' },
  { href: '/platform/analytics', labelKey: 'nav.analytics' },
  { href: '/platform/setup', labelKey: 'nav.setup' },
  { href: '/admin', labelKey: 'nav.admin' },
]

export function TopNav() {
  const { lang, setLang, t } = useLanguage()
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<{ name: string } | null | undefined>(undefined)
  const [signingOut, setSigningOut] = useState(false)
  const [pendingOrderCount, setPendingOrderCount] = useState(0)

  // Live "new orders" badge on the Orders link — like a Facebook notification.
  // Cleared when the Orders workspace mounts (see OrdersConsole).
  useEffect(() => {
    setPendingOrderCount(getPendingNewOrders().length)
    return subscribeNewOrders((pending) => setPendingOrderCount(pending.length))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Resolve the signed-in account so the nav can show the person's name and a
  // sign-out action instead of a "Sign in" link.
  useEffect(() => {
    let cancelled = false
    void getClientUserContext().then((context) => {
      if (cancelled) return
      if (context.user) {
        const metadata = context.user.user_metadata as { full_name?: string } | null
        setUser({ name: metadata?.full_name || context.user.email || '' })
      } else {
        setUser(null)
      }
    })
    return () => {
      cancelled = true
    }
  }, [pathname])

  // Customer-facing surfaces (table menu and order tracking) are intentionally
  // minimal: no platform navigation is shown there.
  if (pathname.startsWith('/t/') || pathname.startsWith('/orders/')) {
    return null
  }

  async function handleSignOut() {
    setSigningOut(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

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
              {link.href === '/platform/orders' && pendingOrderCount > 0 ? (
                <span className="global-nav-badge" aria-label={`${pendingOrderCount} new orders`}>
                  {pendingOrderCount}
                </span>
              ) : null}
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

          {user ? (
            <>
              <span className="global-nav-user" title={user.name}>
                {user.name}
              </span>
              <button
                className="global-nav-link"
                type="button"
                disabled={signingOut}
                onClick={() => void handleSignOut()}
              >
                {signingOut ? t('auth.signingOut') : t('auth.signOut')}
              </button>
            </>
          ) : user === null ? (
            <Link className="global-nav-login" href="/login">
              {t('nav.login')}
            </Link>
          ) : null}
        </div>
      </nav>
    </header>
  )
}