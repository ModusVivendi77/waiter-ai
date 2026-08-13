import { Suspense } from 'react'
import Link from 'next/link'

import { VerifyEmailForm } from '@/components/auth/verify-email-form'

export default function VerifyEmailPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">Email Verification</span>
        <h1 className="section-title">Confirm your email address.</h1>
        <p className="helper-text">
          Enter the 6-digit code we sent to your inbox. Your account stays locked until the code is confirmed.
        </p>
        <Suspense fallback={<p className="muted">Loading verification form...</p>}>
          <VerifyEmailForm />
        </Suspense>
        <Link href="/platform/signup">Need to register? Create an account.</Link>
      </section>
    </main>
  )
}