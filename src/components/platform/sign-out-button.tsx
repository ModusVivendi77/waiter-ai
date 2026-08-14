'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/app/language-provider'

export function SignOutButton() {
  const router = useRouter()
  const { t } = useLanguage()
  const [pending, setPending] = useState(false)

  async function handleSignOut() {
    setPending(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
    router.refresh()
  }

  return (
    <button className="button-danger" type="button" onClick={handleSignOut} disabled={pending}>
      {pending ? t('auth.signingOut') : t('auth.signOut')}
    </button>
  )
}
