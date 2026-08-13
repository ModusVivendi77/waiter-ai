'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

import { SignOutButton } from '@/components/platform/sign-out-button'
import { AddRestaurantForm } from '@/components/platform/add-restaurant-form'
import { getClientUserContext } from '@/lib/auth/client'
import type { RestaurantMembership } from '@/lib/auth/types'

export default function PlatformHomePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [memberships, setMemberships] = useState<RestaurantMembership[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      const context = await getClientUserContext()

      if (cancelled) {
        return
      }

      if (!context.user) {
        router.replace('/login?next=/platform')
        return
      }

      setEmail(context.user.email ?? null)
      setIsPlatformAdmin(context.isPlatformAdmin)
      setMemberships(context.memberships)
      setError(context.error)
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
            <span className="eyebrow">Platform</span>
            <h1 className="section-title">Loading your restaurant workspace...</h1>
          </section>
        </div>
      </main>
    )
  }

  const primaryMembership = memberships[0] ?? null

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel">
          <div className="app-nav">
            <div>
              <span className="eyebrow">Platform</span>
              <h1 className="section-title">Welcome back{email ? `, ${email}` : ''}.</h1>
            </div>
            <SignOutButton />
          </div>

          <p className="lead">
            {primaryMembership
              ? `Primary restaurant: ${primaryMembership.restaurantName}.`
              : isPlatformAdmin
                ? 'Platform admin account detected. You can access service-level administration.'
                : 'No restaurant membership is linked to this user yet.'}
          </p>

          {error ? <div className="error-box">{error}</div> : null}

          <div className="pill-row">
            <Link className="button" href="/platform/orders">
              Orders workspace
            </Link>
            <Link className="button-secondary" href="/platform/setup">
              Restaurant setup
            </Link>
            <Link className="button-secondary" href="/platform/settings">
              Settings
            </Link>
            <Link className="button-secondary" href="/platform/team">
              Team access
            </Link>
            {isPlatformAdmin ? (
              <Link className="button-secondary" href="/admin">
                Admin console
              </Link>
            ) : null}
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow">Memberships</span>
          <div className="panel-grid">
            {memberships.length > 0 ? (
              memberships.map((membership) => (
                <article className="metric" key={`${membership.restaurantId}-${membership.role}`}>
                  <span className="badge">{membership.role}</span>
                  <strong>{membership.restaurantName}</strong>
                  <p className="muted">Slug: {membership.restaurantSlug}</p>
                </article>
              ))
            ) : isPlatformAdmin ? (
              <article className="metric">
                <span className="badge">SUPER_ADMIN</span>
                <strong>Platform-level access enabled</strong>
                <p className="muted">Assign restaurant memberships only when you need scoped operational views.</p>
              </article>
            ) : (
              <article className="metric">
                <strong>No memberships found</strong>
                <p className="muted">
                  Use the owner registration flow or attach this user to a restaurant in Supabase.
                </p>
              </article>
            )}
          </div>
        </section>

        <section className="panel">
          <span className="eyebrow">Add another restaurant</span>
          <p className="helper-text">
            Register an additional restaurant under this account. It is created instantly and you are linked as its
            owner — no email confirmation needed. Use the restaurant selector inside Orders and Setup to switch between
            them.
          </p>
          <AddRestaurantForm />
        </section>
      </div>
    </main>
  )
}
