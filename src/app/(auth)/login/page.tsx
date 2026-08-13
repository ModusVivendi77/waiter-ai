'use client'

import { Suspense } from 'react'

import { LoginForm } from '@/components/auth/login-form'
import { useLanguage } from '@/components/app/language-provider'

export default function LoginPage() {
  const { t } = useLanguage()
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">{t('common.role')}</span>
        <h1 className="section-title">{t('login.title')}</h1>
        <p className="helper-text">{t('login.helper')}</p>
        <Suspense fallback={<div className="helper-text">{t('common.loading')}</div>}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  )
}
