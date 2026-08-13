'use client'

import { LanguageProvider } from '@/components/app/language-provider'
import { TopNav } from '@/components/app/top-nav'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <TopNav />
      {children}
    </LanguageProvider>
  )
}
