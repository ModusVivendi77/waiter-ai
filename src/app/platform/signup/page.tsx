'use client'

import Link from 'next/link'

import { RegisterForm } from '@/components/auth/register-form'
import { useLanguage } from '@/components/app/language-provider'

export default function SignupPage() {
  const { t } = useLanguage()
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">{t('signup.eyebrow')}</span>
        <h1 className="section-title">{t('signup.title')}</h1>
        <p className="helper-text">{t('signup.helper')}</p>
        <RegisterForm />
        <Link href="/login">{t('register.loginPrompt')}</Link>
      </section>
    </main>
  )
}
