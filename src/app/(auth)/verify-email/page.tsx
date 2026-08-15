'use client'

import { Suspense } from 'react'
import Link from 'next/link'

import { VerifyEmailForm } from '@/components/auth/verify-email-form'
import { useLanguage } from '@/components/app/language-provider'

export default function VerifyEmailPage() {
  const { t } = useLanguage()
  return (
    <main className="auth-layout">
      <section className="auth-card stack">
        <span className="eyebrow">{t('verify.eyebrow')}</span>
        <h1 className="section-title">{t('verify.title')}</h1>
        <p className="helper-text">{t('verify.helper')}</p>
        <Suspense fallback={<p className="muted">{t('common.loading')}</p>}>
          <VerifyEmailForm />
        </Suspense>
        <Link href="/platform/signup">{t('verify.createAccount')}</Link>
      </section>
    </main>
  )
}