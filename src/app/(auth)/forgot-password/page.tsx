import Link from 'next/link'

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'

export default function ForgotPasswordPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">Password Recovery</span>
        <h1 className="section-title">Send a reset link.</h1>
        <p className="helper-text">
          The email will take the user back into the authenticated reset flow handled by Supabase.
        </p>
        <ForgotPasswordForm />
        <Link href="/login">Back to login</Link>
      </section>
    </main>
  )
}
