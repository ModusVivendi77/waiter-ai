import { Suspense } from 'react'
import Link from 'next/link'

import { VerifyEmailForm } from '@/components/auth/verify-email-form'

export default function VerifyEmailPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">Email Verification</span>
        <h1 className="section-title">Check your inbox to confirm your email.</h1>
        <p className="helper-text">
          Open the confirmation link we emailed you to activate your account. Your account stays locked until you confirm.
        </p>
        <Suspense fallback={<p className="muted">Loading verification form...</p>}>
          <VerifyEmailForm />
        </Suspense>
        <Link href="/platform/signup">Need to register? Create an account.</Link>
      </section>
    </main>
  )
}