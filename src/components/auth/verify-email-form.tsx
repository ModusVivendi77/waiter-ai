'use client'

import { useActionState, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

import { resendConfirmationEmail, type VerifyEmailState } from '@/lib/auth/actions'

const initialState: VerifyEmailState = {}

export function VerifyEmailForm() {
  const searchParams = useSearchParams()
  const initialEmail = searchParams.get('email') || ''
  const invalidLink = searchParams.get('error') === 'invalid-link'

  const [email, setEmail] = useState(initialEmail)
  const [state, formAction, pending] = useActionState(resendConfirmationEmail, initialState)

  return (
    <div className="stack">
      {invalidLink ? <div className="error-box">That confirmation link is invalid or has expired.</div> : null}

      <div className="message">
        We sent a confirmation email to <strong>{email || 'your inbox'}</strong>. Open the link inside to activate
        your owner account, then sign in.
      </div>

      <p className="helper-text">
        Didn't receive it? Enter your email below and we'll send the confirmation link again.
      </p>

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

        {state.error ? <div className="error-box">{state.error}</div> : null}
        {state.success ? <div className="success">{state.success}</div> : null}

        <button className="button" type="submit" disabled={pending}>
          {pending ? 'Sending...' : 'Resend confirmation email'}
        </button>
      </form>

      <Link href="/login">Already confirmed? Sign in.</Link>
    </div>
  )
}