'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { FormEvent, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/app/language-provider'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      // Read straight from the form: browser autofill often fills the fields
      // without firing React's onChange, so controlled state can lag behind.
      const formData = new FormData(event.currentTarget)
      const email = String(formData.get('email') || '').trim()
      const password = String(formData.get('password') || '')

      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      const rawNext = searchParams.get('next') || ''
      const nextPath = rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/platform'

      // Refresh BEFORE navigating: the client router otherwise races the fresh
      // session cookie against a cached RSC payload, which can drop the first
      // navigation (the classic "must click Sign in twice" symptom).
      router.refresh()
      router.replace(nextPath)

      // Hard fallback: if the client-side navigation is ever lost, force a
      // full page load so the middleware re-reads the session cookie.
      window.setTimeout(() => {
        if (window.location.pathname.startsWith('/login')) {
          window.location.assign(nextPath)
        }
      }, 1500)
    } catch (clientError) {
      setError(clientError instanceof Error ? clientError.message : 'Unable to sign in.')
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="email">{t('login.email')}</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>

      <div className="field">
        <label htmlFor="password">{t('login.password')}</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>

      {error ? <div className="error-box">{error}</div> : null}

      <button className="button" type="submit" disabled={pending}>
        {pending ? t('login.signingIn') : t('login.signIn')}
      </button>

      <div className="link-row">
        <Link href="/forgot-password">{t('login.forgot')}</Link>
        <Link href="/platform/signup">{t('login.createAccount')}</Link>
      </div>
    </form>
  )
}
