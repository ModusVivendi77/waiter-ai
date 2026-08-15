'use client'

import { ResetPasswordForm } from '@/components/auth/reset-password-form'
import { useLanguage } from '@/components/app/language-provider'

export default function ResetPasswordPage() {
  const { t } = useLanguage()
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">{t('reset.eyebrow')}</span>
        <h1 className="section-title">{t('reset.title')}</h1>
        <p className="helper-text">{t('reset.helper')}</p>
        <ResetPasswordForm />
      </section>
    </main>
  )
}
