import { Suspense } from 'react'

import { OrdersConsole } from '@/components/platform/orders-console'

export default function OrdersPage() {
  return (
    <main className="page-shell">
      <div className="page-grid">
        <Suspense
          fallback={
            <section className="panel stack">
              <span className="eyebrow">Orders Dashboard</span>
              <h1 className="section-title">Loading operational access...</h1>
            </section>
          }
        >
          <OrdersConsole />
        </Suspense>
      </div>
    </main>
  )
}
