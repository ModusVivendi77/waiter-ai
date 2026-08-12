'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import type { RestaurantMembership } from '@/lib/auth/types'

export default function TeamPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
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
      setIsPlatformAdmin(context.isPlatformAdmin)

      if (!nextMembership && !context.isPlatformAdmin) {
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

  if (loading) {
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
          <h1 className="section-title">Owner or SUPER_ADMIN access confirmed.</h1>
          <p className="lead">
            This route exists to prove elevated access before team management CRUD is added in a later phase.
          </p>
          <div className="badge">{membership?.restaurantName ?? (isPlatformAdmin ? 'Platform administration context' : 'No restaurant selected')}</div>
        </section>
      </div>
    </main>
  )
}
