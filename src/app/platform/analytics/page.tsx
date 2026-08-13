import { Suspense } from 'react'

import { AnalyticsConsole } from '@/components/platform/analytics-console'

export default function AnalyticsPage() {
  return (
    <main className="page-shell">
      <div className="page-grid">
        <Suspense
          fallback={
            <section className="panel stack">
              <span className="eyebrow">Analytics</span>
              <h1 className="section-title">Loading restaurant analytics...</h1>
            </section>
          }
        >
          <AnalyticsConsole />
        </Suspense>
      </div>
    </main>
  )
}
