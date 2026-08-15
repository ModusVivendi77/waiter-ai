'use client'

import { LanguageProvider } from '@/components/app/language-provider'
import { TopNav } from '@/components/app/top-nav'
import { NewOrdersWatcher } from '@/components/app/new-orders-watcher'
import { BackToTop } from '@/components/app/back-to-top'

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <LanguageProvider>
      <TopNav />
      <NewOrdersWatcher />
      {children}
      <BackToTop />
    </LanguageProvider>
  )
}
