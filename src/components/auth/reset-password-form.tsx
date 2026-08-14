'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

import { passwordResetSchema } from '@/lib/auth/schemas'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/app/language-provider'

export function ResetPasswordForm() {
  const router = useRouter()
  const { t } = useLanguage()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError(null)
    setSuccess(null)

    const parsed = passwordResetSchema.safeParse({
      password,
      confirmPassword,
    })

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Invalid password.')
      setPending(false)
      return
    }

    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) {
        setError(updateError.message)
        return
      }

      setSuccess(t('auth.passwordUpdated'))
      router.replace('/login')
      router.refresh()
    } catch (clientError) {
      setError(clientError instanceof Error ? clientError.message : t('auth.updateFailed'))
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="field">
        <label htmlFor="password">{t('auth.newPassword')}</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </div>

      <div className="field">
        <label htmlFor="confirmPassword">{t('auth.confirmNewPassword')}</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          required
        />
      </div>

      {error ? <div className="error-box">{error}</div> : null}
      {success ? <div className="success">{success}</div> : null}

      <button className="button" type="submit" disabled={pending}>
        {pending ? t('auth.updating') : t('auth.updatePassword')}
      </button>
    </form>
  )
}
