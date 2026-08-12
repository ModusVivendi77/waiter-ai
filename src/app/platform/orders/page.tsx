'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import type { RestaurantMembership } from '@/lib/auth/types'

export default function OrdersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [membership, setMembership] = useState<RestaurantMembership | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const context = await getClientUserContext()

      if (cancelled) {
        return
      }

      if (!context.user) {
        router.replace('/login?next=/platform/orders')
        return
      }

      const nextMembership = context.memberships.find((item) => ['OWNER', 'MANAGER', 'STAFF'].includes(item.role)) ?? null

      if (!nextMembership) {
        router.replace('/platform?error=insufficient-role')
        return
      }

      setMembership(nextMembership)
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [router])

  if (loading || !membership) {
    return (
      <main className="page-shell">
        <div className="page-grid">
          <section className="panel stack">
            <span className="eyebrow">Orders Dashboard</span>
            <h1 className="section-title">Loading operational access...</h1>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel stack">
          <span className="eyebrow">Orders Dashboard</span>
          <h1 className="section-title">Live operational surface for {membership.restaurantName}.</h1>
          <p className="lead">
            The route is protected for any staff role. The realtime order feed lands in the next phase.
          </p>
        </section>

        <section className="panel">
          <ul className="list">
            <li>Role granted: {membership.role}</li>
            <li>Restaurant: {membership.restaurantName}</li>
            <li>Next implementation target: realtime order subscriptions and status transitions.</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
