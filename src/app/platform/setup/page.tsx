import { Suspense } from 'react'

import { RestaurantSetupConsole } from '@/components/platform/restaurant-setup-console'

export default function PlatformSetupPage() {
  return (
    <main className="page-shell">
      <div className="page-grid">
        <Suspense
          fallback={
            <section className="panel stack">
              <span className="eyebrow">Restaurant Setup</span>
              <h1 className="section-title">Loading setup workspace...</h1>
            </section>
          }
        >
          <RestaurantSetupConsole />
        </Suspense>
      </div>
    </main>
  )
}
