'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import { registerRestaurant, type RegisterState } from '@/lib/auth/actions'
import { localizeAuthError } from '@/lib/i18n/auth-errors'
import { useLanguage } from '@/components/app/language-provider'

const initialState: RegisterState = {}

export function RegisterForm() {
  const { t } = useLanguage()
  const [state, formAction, pending] = useActionState(registerRestaurant, initialState)

  return (
    <div className="stack">
      {state.success ? (
        <div className="stack">
          {state.emailPending ? (
            <div className="message">
              {t('register.successPending', {
                email: state.success,
                reason: state.emailNotice?.toLowerCase().replace(/\.$/, '') ?? t('register.emailNoticeUnknown'),
              })}
            </div>
          ) : (
            <div className="success">{t('register.successEmail', { email: state.success })}</div>
          )}
          <Link className="button" href={`/verify-email?email=${encodeURIComponent(state.success)}`}>
            {state.emailPending ? t('register.resend') : t('register.notReceived')}
          </Link>
        </div>
      ) : (
        <form action={formAction}>
          <div className="field">
            <label htmlFor="fullName">{t('register.fullName')}</label>
            <input id="fullName" name="fullName" type="text" placeholder={t('register.fullNamePlaceholder')} required />
          </div>

          <div className="field">
            <label htmlFor="restaurantName">{t('register.restaurantName')}</label>
            <input id="restaurantName" name="restaurantName" type="text" placeholder="The Green Bar" required />
          </div>

          <div className="field">
            <label htmlFor="email">{t('login.email')}</label>
            <input id="email" name="email" type="email" placeholder={t('register.emailPlaceholder')} required />
          </div>

          <div className="field">
            <label htmlFor="password">{t('login.password')}</label>
            <input id="password" name="password" type="password" required />
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">{t('register.confirmPassword')}</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required />
          </div>

          {state.error ? <div className="error-box">{localizeAuthError(state.error, t)}</div> : null}

          <button className="button" type="submit" disabled={pending}>
            {pending ? t('register.creating') : t('register.createButton')}
          </button>
        </form>
      )}
    </div>
  )
}