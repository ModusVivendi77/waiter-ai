import { ResetPasswordForm } from '@/components/auth/reset-password-form'

export default function ResetPasswordPage() {
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">Password Reset</span>
        <h1 className="section-title">Choose a new password.</h1>
        <p className="helper-text">
          Open this page from the Supabase reset email so the temporary recovery session is present.
        </p>
        <ResetPasswordForm />
      </section>
    </main>
  )
}
