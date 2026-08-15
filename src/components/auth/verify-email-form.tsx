'use client'

import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { resendConfirmationEmail, type VerifyEmailState } from '@/lib/auth/actions'
import { localizeAuthError } from '@/lib/i18n/auth-errors'
import { useLanguage } from '@/components/app/language-provider'

const initialState: VerifyEmailState = {}

export function VerifyEmailForm() {
  const { t } = useLanguage()
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email') || ''
  const invalidLink = searchParams.get('error') === 'invalid-link'

  const [email, setEmail] = useState(initialEmail)
  const [state, formAction, pending] = useActionState(resendConfirmationEmail, initialState)

  return (
    <div className="stack">
      {invalidLink ? <div className="error-box">{t('auth.verifyInvalidLink')}</div> : null}

      <div className="message">{t('auth.verifyMessage', { email: email || 'your inbox' })}</div>

      <p className="helper-text">{t('auth.verifyHelper')}</p>

      <form action={formAction} className="stack">
        <div className="field">
          <label htmlFor="verificationEmail">{t('login.email')}</label>
          <input
            id="verificationEmail"
            name="email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="owner@example.com"
            required
          />
        </div>

        {state.error ? <div className="error-box">{localizeAuthError(state.error, t)}</div> : null}
        {state.success ? <div className="success">{state.success}</div> : null}

        <button className="button" type="submit" disabled={pending}>
          {pending ? t('auth.sending') : t('register.resend')}
        </button>
      </form>

      <Link href="/login">{t('auth.verifyLogin')}</Link>
    </div>
  )
}