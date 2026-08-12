'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { getClientUserContext } from '@/lib/auth/client'
import { createClient } from '@/lib/supabase/client'

type PlatformAdminEntry = {
  user_id: string
  email: string
  created_at: string
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)
  const [admins, setAdmins] = useState<PlatformAdminEntry[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadAdmins() {
    const { data, error: rpcError } = await supabase.rpc('list_platform_admins')

    if (rpcError) {
      setError(rpcError.message)
      setAdmins([])
      return
    }

    setAdmins(((data as PlatformAdminEntry[]) || []).filter((entry) => entry.email))
  }

  useEffect(() => {
    let cancelled = false

    async function load() {
      const context = await getClientUserContext()

      if (cancelled) {
        return
      }

      if (!context.user) {
        router.replace('/login?next=/admin')
        return
      }

      if (!context.isPlatformAdmin) {
        router.replace('/platform?error=insufficient-role')
        return
      }

      setCurrentEmail(context.user.email ?? null)
      await loadAdmins()
      setLoading(false)
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [router])

  async function handleGrantAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newAdminEmail.trim()) {
      return
    }

    setSaving(true)
    setNotice(null)
    setError(null)

    const { error: rpcError } = await supabase.rpc('grant_platform_admin', {
      target_email: newAdminEmail.trim(),
    })

    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setNewAdminEmail('')
    setNotice('Platform admin assignment updated.')
    await loadAdmins()
  }

  async function handleRevokeAdmin(userId: string, email: string) {
    setSaving(true)
    setNotice(null)
    setError(null)

    const { error: rpcError } = await supabase.rpc('revoke_platform_admin', {
      target_user_id: userId,
    })

    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setNotice(`Removed platform admin access for ${email}.`)
    await loadAdmins()
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-grid">
          <section className="panel stack">
            <span className="eyebrow">Admin Console</span>
            <h1 className="section-title">Loading platform administration access...</h1>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel stack">
          <span className="eyebrow">Admin Console</span>
          <h1 className="section-title">SUPER_ADMIN control center</h1>
          <p className="lead">Manage platform administrators and tenant-level operations from one place.</p>
          {notice ? <div className="success">{notice}</div> : null}
          {error ? <div className="error-box">{error}</div> : null}
          <ul className="list">
            <li>Authenticated user: {currentEmail ?? 'Unknown user'}</li>
            <li>Role: SUPER_ADMIN</li>
            <li>Total platform admins: {admins.length}</li>
          </ul>
        </section>

        <section className="panel stack">
          <span className="eyebrow">Admin Access</span>
          <form className="stack" onSubmit={handleGrantAdmin}>
            <div className="field">
              <label htmlFor="newAdminEmail">Grant SUPER_ADMIN by email</label>
              <input
                id="newAdminEmail"
                type="email"
                value={newAdminEmail}
                onChange={(event) => setNewAdminEmail(event.target.value)}
                placeholder="admin@example.com"
                required
              />
            </div>
            <button className="button" type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Grant admin access'}
            </button>
          </form>

          <ul className="list">
            {admins.map((admin) => (
              <li key={admin.user_id}>
                <strong>{admin.email}</strong>
                <p className="muted">Assigned: {new Date(admin.created_at).toLocaleString()}</p>
                <button
                  className="button"
                  type="button"
                  disabled={saving || admins.length <= 1 || admin.email === currentEmail}
                  onClick={() => void handleRevokeAdmin(admin.user_id, admin.email)}
                >
                  Revoke admin access
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}
