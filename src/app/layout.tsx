import type { Metadata } from 'next'

import { TopNav } from '@/components/app/top-nav'

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
        <TopNav />
        {children}
      </body>
    </html>
  )
}
