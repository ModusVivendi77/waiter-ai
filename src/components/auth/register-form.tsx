'use client'

import { useActionState } from 'react'
import Link from 'next/link'

import { registerRestaurant, type RegisterState } from '@/lib/auth/actions'

const initialState: RegisterState = {}

export function RegisterForm() {
  const [state, formAction, pending] = useActionState(registerRestaurant, initialState)

  return (
    <div className="stack">
      {state.success ? (
        <div className="stack">
          {state.emailPending ? (
            <div className="message">
              Account created for <strong>{state.success}</strong>, but {state.emailNotice?.toLowerCase().replace(/\.$/, '')}.
              Use the button below to resend the confirmation email in a few minutes.
            </div>
          ) : (
            <div className="success">
              Account created. A confirmation email was sent to <strong>{state.success}</strong>. Open the link inside
              to activate your owner access.
            </div>
          )}
          <Link className="button" href={`/verify-email?email=${encodeURIComponent(state.success)}`}>
            {state.emailPending ? 'Resend confirmation email' : 'I did not receive the email'}
          </Link>
        </div>
      ) : (
        <form action={formAction}>
          <div className="field">
            <label htmlFor="fullName">Owner full name</label>
            <input id="fullName" name="fullName" type="text" placeholder="Alex Morgan" required />
          </div>

          <div className="field">
            <label htmlFor="restaurantName">Restaurant name</label>
            <input id="restaurantName" name="restaurantName" type="text" placeholder="The Green Bar" required />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="owner@example.com" required />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>

          <div className="field">
            <label htmlFor="confirmPassword">Confirm password</label>
            <input id="confirmPassword" name="confirmPassword" type="password" required />
          </div>

          {state.error ? <div className="error-box">{state.error}</div> : null}

          <button className="button" type="submit" disabled={pending}>
            {pending ? 'Creating account...' : 'Create owner account'}
          </button>
        </form>
      )}
    </div>
  )
}