'use client'

import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { resendVerificationCode, verifyEmailCode, type VerifyEmailState } from '@/lib/auth/actions'

const initialState: VerifyEmailState = {}

export function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email') || ''

  const [email, setEmail] = useState(initialEmail)
  const [state, formAction, pending] = useActionState(verifyEmailCode, initialState)
  const [resendState, resendAction, resendPending] = useActionState(resendVerificationCode, initialState)

  return (
    <div className="stack">
      {state.success ? (
        <div className="stack">
          <div className="success">{state.success}</div>
          <Link href="/login">Go to login</Link>
        </div>
      ) : (
        <>
          <form action={formAction} className="stack">
            <div className="field">
              <label htmlFor="verificationEmail">Email</label>
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

            <div className="field">
              <label htmlFor="verificationCode">6-digit verification code</label>
              <input
                id="verificationCode"
                name="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                required
              />
            </div>

            {state.error ? <div className="error-box">{state.error}</div> : null}

            <button className="button" type="submit" disabled={pending}>
              {pending ? 'Verifying...' : 'Verify email'}
            </button>
          </form>

          <form action={resendAction}>
            <input type="hidden" name="email" value={email} />
            <button className="button-secondary" type="submit" disabled={resendPending}>
              {resendPending ? 'Sending...' : 'Resend verification code'}
            </button>
            {resendState.error ? <div className="error-box">{resendState.error}</div> : null}
            {resendState.success ? <div className="success">{resendState.success}</div> : null}
          </form>

          <Link href="/login">Already verified? Sign in.</Link>
        </>
      )}
    </div>
  )
}