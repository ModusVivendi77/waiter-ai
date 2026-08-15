'use client'

import Link from 'next/link'

import { ForgotPasswordForm } from '@/components/auth/forgot-password-form'
import { useLanguage } from '@/components/app/language-provider'

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">{t('forgot.eyebrow')}</span>
        <h1 className="section-title">{t('forgot.title')}</h1>
        <p className="helper-text">{t('forgot.helper')}</p>
        <ForgotPasswordForm />
        <Link href="/login">{t('forgot.backToLogin')}</Link>
      </section>
    </main>
  )
}
