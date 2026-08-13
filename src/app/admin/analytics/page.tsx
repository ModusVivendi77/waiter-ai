import { Suspense } from 'react'

import { PlatformAnalyticsConsole } from '@/components/platform/platform-analytics-console'

export default function AdminAnalyticsPage() {
  return (
    <main className="page-shell">
      <div className="page-grid">
        <Suspense
          fallback={
            <section className="panel stack">
              <span className="eyebrow">Platform Analytics</span>
              <h1 className="section-title">Loading platform analytics...</h1>
            </section>
          }
        >
          <PlatformAnalyticsConsole />
        </Suspense>
      </div>
    </main>
  )
}
