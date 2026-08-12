'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import type { RestaurantMembership } from '@/lib/auth/types'

export default function SettingsPage() {
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
        router.replace('/login?next=/platform/settings')
        return
      }

      const nextMembership = context.memberships.find((item) => ['OWNER', 'MANAGER'].includes(item.role)) ?? null

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
            <span className="eyebrow">Settings</span>
            <h1 className="section-title">Loading configuration access...</h1>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel stack">
          <span className="eyebrow">Settings</span>
          <h1 className="section-title">Configuration access for {membership.restaurantName}.</h1>
          <p className="lead">
            Managers and owners can access restaurant configuration surfaces. Staff are intentionally blocked here.
          </p>
        </section>
      </div>
    </main>
  )
}
