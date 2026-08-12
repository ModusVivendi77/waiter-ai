import Link from 'next/link'

import { RegisterForm } from '@/components/auth/register-form'

export default function SignupPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">Owner Registration</span>
        <h1 className="section-title">Create the first restaurant account.</h1>
        <p className="helper-text">
          This flow provisions the auth user, the restaurant record, and the OWNER membership in one step.
        </p>
        <RegisterForm />
        <Link href="/login">Already have an account? Sign in.</Link>
      </section>
    </main>
  )
}
