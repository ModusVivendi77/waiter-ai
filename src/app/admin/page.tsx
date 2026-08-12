import { requirePlatformAdmin } from '@/lib/auth/guards'

export default async function AdminPage() {
  const context = await requirePlatformAdmin()

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel stack">
          <span className="eyebrow">Admin Console</span>
          <h1 className="section-title">Platform administration access confirmed.</h1>
          <p className="lead">
            This space is reserved for SUPER_ADMIN accounts and will host service-level analytics, tenant controls,
            and platform operations in later phases.
          </p>
          <ul className="list">
            <li>Authenticated user: {context.user.email ?? context.user.id}</li>
            <li>Role: SUPER_ADMIN</li>
            <li>Current phase focus: Restaurant setup hardening (Phase 4).</li>
          </ul>
        </section>
      </div>
    </main>
  )
}
