import { Suspense } from 'react'

import { LoginForm } from '@/components/auth/login-form'

export default function LoginPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">Restaurant Access</span>
        <h1 className="section-title">Sign in to the restaurant platform.</h1>
        <p className="helper-text">
          Owners, managers, and staff use the same login. Role checks happen after authentication.
        </p>
        <Suspense fallback={<div className="helper-text">Loading sign-in form...</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  )
}
