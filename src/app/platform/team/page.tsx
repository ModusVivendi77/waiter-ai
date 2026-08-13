'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import {
  addTeamMember,
  listTeamMembers,
  removeTeamMember,
  updateTeamMemberRole,
  type TeamMember,
} from '@/lib/auth/team-actions'
import { getClientUserContext } from '@/lib/auth/client'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/auth/types'

type RestaurantOption = {
  id: string
  name: string
}

export default function TeamPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [restaurantOptions, setRestaurantOptions] = useState<RestaurantOption[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [members, setMembers] = useState<TeamMember[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('STAFF')

  async function loadRestaurants() {
    const context = await getClientUserContext()

    if (!context.user) {
      router.replace('/login?next=/platform/team')
      return
    }

    setIsPlatformAdmin(context.isPlatformAdmin)

    let options = context.memberships
      .filter((membership) => membership.role === 'OWNER')
      .map((membership) => ({ id: membership.restaurantId, name: membership.restaurantName }))

    if (context.isPlatformAdmin) {
      const { data: restaurants, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('name')

      if (!restaurantsError && restaurants && restaurants.length > 0) {
        const all = restaurants as RestaurantOption[]
        options = all.filter((entry) => !options.some((option) => option.id === entry.id))
        options = [...options, ...all]
      }
    }

    if (options.length === 0) {
      setError('You need OWNER access to at least one restaurant to manage a team.')
      setLoading(false)
      return
    }

    setRestaurantOptions(options)
    setSelectedRestaurantId((current) => current || options[0].id)
    setLoading(false)
  }

  async function loadMembers(restaurantId: string) {
    const result = await listTeamMembers(restaurantId)
    if (result.error) {
      setError(result.error)
      setMembers([])
      return
    }
    setMembers(result.members || [])
    setError(null)
  }

  useEffect(() => {
    void loadRestaurants()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedRestaurantId) {
      void loadMembers(selectedRestaurantId)
    }
  }, [selectedRestaurantId])

  async function handleAddMember(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedRestaurantId) return

    setSaving(true)
    setNotice(null)
    setError(null)

    const result = await addTeamMember(selectedRestaurantId, newEmail, newRole)

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setNewEmail('')
    setNotice(`Added ${newRole} member to the team.`)
    await loadMembers(selectedRestaurantId)
  }

  async function handleRoleChange(userId: string, role: UserRole) {
    if (!selectedRestaurantId) return

    setSaving(true)
    setError(null)

    const result = await updateTeamMemberRole(selectedRestaurantId, userId, role)

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setNotice('Team member role updated.')
    await loadMembers(selectedRestaurantId)
  }

  async function handleRemove(userId: string, email: string) {
    if (!selectedRestaurantId) return
    if (!window.confirm(`Remove ${email} from this restaurant?`)) return

    setSaving(true)
    setError(null)

    const result = await removeTeamMember(selectedRestaurantId, userId)

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setNotice(`Removed ${email} from the restaurant.`)
    await loadMembers(selectedRestaurantId)
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-grid">
          <section className="panel stack">
            <span className="eyebrow">Team Access</span>
            <h1 className="section-title">Loading team access...</h1>
          </section>
        </div>
      </main>
    )
  }

  const selectedRestaurantName =
    restaurantOptions.find((option) => option.id === selectedRestaurantId)?.name ?? 'your restaurant'

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel stack">
          <span className="eyebrow">Team Access</span>
          <h1 className="section-title">Manage team for {selectedRestaurantName}</h1>
          <p className="lead">
            Add staff and managers to the restaurant. Owners have full management; managers manage operations; staff
            only see the restaurant they work in.
          </p>

          {restaurantOptions.length > 1 ? (
            <div className="field">
              <label htmlFor="teamRestaurantSelector">Restaurant context</label>
              <select
                id="teamRestaurantSelector"
                value={selectedRestaurantId}
                onChange={(event) => setSelectedRestaurantId(event.target.value)}
                disabled={saving}
              >
                {restaurantOptions.map((restaurant) => (
                  <option key={restaurant.id} value={restaurant.id}>
                    {restaurant.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {notice ? <div className="success">{notice}</div> : null}
          {error ? <div className="error-box">{error}</div> : null}
        </section>

        <section className="panel stack">
          <span className="eyebrow">Add member</span>
          <form className="stack" onSubmit={handleAddMember}>
            <div className="field">
              <label htmlFor="teamMemberEmail">Email</label>
              <input
                id="teamMemberEmail"
                type="email"
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="waiter@example.com"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="teamMemberRole">Role</label>
              <select
                id="teamMemberRole"
                value={newRole}
                onChange={(event) => setNewRole(event.target.value as UserRole)}
              >
                <option value="MANAGER">MANAGER</option>
                <option value="STAFF">STAFF</option>
              </select>
            </div>

            <button className="button" type="submit" disabled={saving || !selectedRestaurantId}>
              {saving ? 'Saving...' : 'Add team member'}
            </button>
          </form>
          <p className="helper-text">
            The invited user must already have an account (register once, then reuse the same account for any
            restaurant).
          </p>
        </section>

        <section className="panel stack">
          <span className="eyebrow">Current team</span>
          {members.length === 0 ? <p className="muted">No team members yet for this restaurant.</p> : null}
          <ul className="list">
            {members.map((member) => (
              <li key={`${member.userId}-${member.role}`}>
                <div className="cart-line-header">
                  <div>
                    <strong>{member.email}</strong>
                    <p className="muted">Added: {new Date(member.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <label className="muted" htmlFor={`role-${member.userId}`}>
                      Role
                    </label>
                    <select
                      id={`role-${member.userId}`}
                      value={member.role}
                      disabled={saving}
                      onChange={(event) => void handleRoleChange(member.userId, event.target.value as UserRole)}
                    >
                      <option value="OWNER">OWNER</option>
                      <option value="MANAGER">MANAGER</option>
                      <option value="STAFF">STAFF</option>
                    </select>
                    <button
                      className="button-danger"
                      type="button"
                      disabled={saving}
                      onClick={() => void handleRemove(member.userId, member.email)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  )
}

