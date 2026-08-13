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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        setError(signInError.message)
        return
      }

      const nextPath = searchParams.get('next') || '/platform'
      router.replace(nextPath)
      router.refresh()
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
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="password">{t('login.password')}</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
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
