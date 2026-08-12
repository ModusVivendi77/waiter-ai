'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import type { RestaurantMembership } from '@/lib/auth/types'

export default function TeamPage() {
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
        router.replace('/login?next=/platform/team')
        return
      }

      const nextMembership = context.memberships.find((item) => item.role === 'OWNER') ?? null

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
            <span className="eyebrow">Team Access</span>
            <h1 className="section-title">Loading owner access...</h1>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel stack">
          <span className="eyebrow">Team Access</span>
          <h1 className="section-title">Owner-only access confirmed.</h1>
          <p className="lead">
            This route exists to prove the OWNER role gate before team management CRUD is added in a later phase.
          </p>
          <div className="badge">{membership.restaurantName}</div>
        </section>
      </div>
    </main>
  )
}
