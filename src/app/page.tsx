import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="hero-card">
          <span className="eyebrow">Waiter AI</span>
          <h1 className="hero-title">Restaurant operations and QR ordering, built around one login.</h1>
          <p className="lead">
            Phase 3 now provides the restaurant-side authentication surface: staff sign-in,
            owner registration, password recovery, and protected platform routes with role-aware access.
          </p>
          <div className="cta-row">
            <Link className="button" href="/login">
              Restaurant Login
            </Link>
            <Link className="button-secondary" href="/platform/signup">
              Register Restaurant
            </Link>
          </div>
        </section>

        <section className="panel-grid">
          <article className="metric">
            <span className="eyebrow">Access</span>
            <strong>Email and password</strong>
            <p className="muted">Supabase-backed sessions for restaurant staff.</p>
          </article>
          <article className="metric">
            <span className="eyebrow">Roles</span>
            <strong>Owner, manager, staff</strong>
            <p className="muted">Protected platform pages enforce the minimum role required.</p>
          </article>
          <article className="metric">
            <span className="eyebrow">Recovery</span>
            <strong>Reset flow ready</strong>
            <p className="muted">Forgot-password and reset-password pages are wired for Supabase Auth.</p>
          </article>
        </section>
      </div>
    </main>
  )
}
