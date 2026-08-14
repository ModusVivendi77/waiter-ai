'use client'

import { FormEvent, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/app/language-provider'

export function ForgotPasswordForm() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setSuccess(null)

    try {
      const supabase = createClient()
      const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      })

      if (resetError) {
        setError(resetError.message)
        return
      }

      setSuccess(t('auth.resetSent'))
    } catch (clientError) {
      setError(clientError instanceof Error ? clientError.message : t('auth.sendFailed'))
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

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success">{success}</div> : null}

      <button className="button" type="submit" disabled={pending}>
        {pending ? t('auth.sending') : t('auth.sendResetLink')}
      </button>
    </form>
  )
}
