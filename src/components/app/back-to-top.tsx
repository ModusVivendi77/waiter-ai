'use client'

import { useEffect, useState } from 'react'

import { useLanguage } from '@/components/app/language-provider'

/**
 * Floating "back to top" button. Appears once the page has been scrolled a
 * little and smooth-scrolls back to the top. Used on the Orders workspace and
 * the Home dashboard.
 */
export function BackToTop() {
  const { t } = useLanguage()
  const [show, setShow] = useState(false)

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 200)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (!show) return null

  return (
    <button
      className="up-float"
      type="button"
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      ↑
    </button>
  )
}
