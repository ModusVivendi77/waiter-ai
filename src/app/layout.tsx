import type { Metadata } from 'next'

import { AppShell } from '@/components/app/app-shell'

import './globals.css'

export const metadata: Metadata = {
  title: 'Waiter AI',
  description: 'Restaurant ordering and operations platform.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
