'use client'

import { useActionState, useEffect } from 'react'

import { addRestaurant, type AddRestaurantState } from '@/lib/auth/actions'

const initialState: AddRestaurantState = {}

export function AddRestaurantForm() {
  const [state, formAction, pending] = useActionState(addRestaurant, initialState)

  // After a successful creation, reload so the new membership shows up in the
  // memberships panel and the restaurant switchers.
  useEffect(() => {
    if (state.success) {
      const timeout = setTimeout(() => window.location.reload(), 900)
      return () => clearTimeout(timeout)
    }
  }, [state.success])

  return (
    <form action={formAction} className="stack">
      {state.error ? <div className="error-box">{state.error}</div> : null}
      {state.success ? (
        <div className="success">
          Restaurant <strong>{state.success}</strong> created and linked to your account.
        </div>
      ) : null}

      <div className="field">
        <label htmlFor="addRestaurantName">New restaurant name</label>
        <input
          id="addRestaurantName"
          name="restaurantName"
          type="text"
          placeholder="The Green Bar 2"
          minLength={2}
          required
        />
      </div>

      <button className="button-secondary" type="submit" disabled={pending}>
        {pending ? 'Creating...' : 'Add restaurant'}
      </button>
    </form>
  )
}
