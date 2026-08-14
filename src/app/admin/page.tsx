'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

import { deleteOrders, deleteRestaurant, deleteSessions } from '@/lib/admin/data-actions'
import { getClientUserContext } from '@/lib/auth/client'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/app/language-provider'

type PlatformAdminEntry = {
  user_id: string
  email: string
  created_at: string
}

type RestaurantOption = {
  id: string
  name: string
}

export default function AdminPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { t } = useLanguage()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentEmail, setCurrentEmail] = useState<string | null>(null)
  const [admins, setAdmins] = useState<PlatformAdminEntry[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restaurants, setRestaurants] = useState<RestaurantOption[]>([])
  const [selectedDataRestaurantId, setSelectedDataRestaurantId] = useState('')
  const [olderThanDays, setOlderThanDays] = useState('7')
  const [dataBusy, setDataBusy] = useState<string | null>(null)
  const [dataNotice, setDataNotice] = useState<string | null>(null)
  const [dataError, setDataError] = useState<string | null>(null)

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

      const { data: restaurantRows, error: restaurantError } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('name')
      if (!restaurantError) {
        setRestaurants((restaurantRows as RestaurantOption[]) || [])
      }

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
    setNotice(t('admin.notice.granted'))
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

    setNotice(t('admin.notice.revoked', { email }))
    await loadAdmins()
  }

  function getDataScopeLabel() {
    const restaurant = restaurants.find((entry) => entry.id === selectedDataRestaurantId)
    return restaurant ? `"${restaurant.name}"` : 'ALL restaurants'
  }

  async function handleDeleteOrders() {
    if (!window.confirm(t('admin.confirm.deleteOrders', { scope: getDataScopeLabel() }))) return

    setDataBusy('orders')
    setDataNotice(null)
    setDataError(null)

    const result = await deleteOrders(selectedDataRestaurantId)

    setDataBusy(null)
    if (result.error) {
      setDataError(result.error)
      return
    }
    setDataNotice(t('admin.notice.orders', { count: result.deletedCount ?? 0 }))
  }

  async function handleDeleteOldOrders() {
    const days = Math.max(1, Math.floor(Number(olderThanDays) || 7))
    if (!window.confirm(t('admin.confirm.deleteOldOrders', { days, scope: getDataScopeLabel() }))) return

    setDataBusy('old-orders')
    setDataNotice(null)
    setDataError(null)

    const result = await deleteOrders(selectedDataRestaurantId, days)

    setDataBusy(null)
    if (result.error) {
      setDataError(result.error)
      return
    }
    setDataNotice(t('admin.notice.orders', { count: result.deletedCount ?? 0 }))
  }

  async function handleDeleteSessions() {
    if (!window.confirm(t('admin.confirm.deleteSessions', { scope: getDataScopeLabel() }))) return

    setDataBusy('sessions')
    setDataNotice(null)
    setDataError(null)

    const result = await deleteSessions(selectedDataRestaurantId)

    setDataBusy(null)
    if (result.error) {
      setDataError(result.error)
      return
    }
    setDataNotice(t('admin.notice.sessions', { count: result.deletedCount ?? 0 }))
  }

  async function handleDeleteRestaurant() {
    const restaurant = restaurants.find((entry) => entry.id === selectedDataRestaurantId)
    if (!restaurant) {
      setDataError(t('admin.error.selectRestaurant'))
      return
    }

    if (!window.confirm(t('admin.confirm.deleteRestaurant', { name: restaurant.name }))) return

    setDataBusy('restaurant')
    setDataNotice(null)
    setDataError(null)

    const result = await deleteRestaurant(restaurant.id)

    setDataBusy(null)
    if (result.error) {
      setDataError(result.error)
      return
    }

    const { data: restaurantRows } = await supabase.from('restaurants').select('id, name').order('name')
    setRestaurants((restaurantRows as RestaurantOption[]) || [])
    setSelectedDataRestaurantId('')
    setDataNotice(t('admin.notice.restaurant', { name: restaurant.name }))
  }

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-grid">
          <section className="panel stack">
            <span className="eyebrow">{t('admin.eyebrow')}</span>
            <h1 className="section-title">{t('admin.loading')}</h1>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel stack">
          <span className="eyebrow">{t('admin.eyebrow')}</span>
          <h1 className="section-title">{t('admin.title')}</h1>
          <p className="lead">{t('admin.lead')}</p>
          {notice ? <div className="success">{notice}</div> : null}
          {error ? <div className="error-box">{error}</div> : null}
          <ul className="list">
            <li>{t('admin.authenticatedUser', { email: currentEmail ?? 'Unknown user' })}</li>
            <li>{t('admin.role')}</li>
            <li>{t('admin.totalAdmins', { count: admins.length })}</li>
          </ul>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('admin.accessEyebrow')}</span>
          <form className="stack" onSubmit={handleGrantAdmin}>
            <div className="field">
              <label htmlFor="newAdminEmail">{t('admin.grantLabel')}</label>
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
              {saving ? t('admin.saving') : t('admin.grantButton')}
            </button>
          </form>

          <ul className="list">
            {admins.map((admin) => (
              <li key={admin.user_id}>
                <strong>{admin.email}</strong>
                <p className="muted">{t('admin.assigned', { date: new Date(admin.created_at).toLocaleString() })}</p>
                <button
                  className="button"
                  type="button"
                  disabled={saving || admins.length <= 1 || admin.email === currentEmail}
                  onClick={() => void handleRevokeAdmin(admin.user_id, admin.email)}
                >
                  {t('admin.revokeButton')}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('admin.dataEyebrow')}</span>
          <h2 className="section-title">{t('admin.dataTitle')}</h2>
          <p className="lead">{t('admin.dataLead')}</p>

          {dataNotice ? <div className="success">{dataNotice}</div> : null}
          {dataError ? <div className="error-box">{dataError}</div> : null}

          <div className="field">
            <label htmlFor="dataRestaurantSelector">{t('admin.dataScopeLabel')}</label>
            <select
              id="dataRestaurantSelector"
              value={selectedDataRestaurantId}
              onChange={(event) => setSelectedDataRestaurantId(event.target.value)}
              disabled={Boolean(dataBusy)}
            >
              <option value="">{t('admin.dataAllRestaurants')}</option>
              {restaurants.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="olderThanDays">{t('admin.dataOlderThan')}</label>
            <input
              id="olderThanDays"
              type="number"
              min="1"
              step="1"
              value={olderThanDays}
              onChange={(event) => setOlderThanDays(event.target.value)}
              disabled={Boolean(dataBusy)}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              className="button-danger"
              type="button"
              disabled={Boolean(dataBusy)}
              onClick={() => void handleDeleteOrders()}
            >
              {dataBusy === 'orders' ? t('admin.deleting') : t('admin.dataDeleteOrders')}
            </button>
            <button
              className="button-danger"
              type="button"
              disabled={Boolean(dataBusy)}
              onClick={() => void handleDeleteOldOrders()}
            >
              {dataBusy === 'old-orders' ? t('admin.deleting') : t('admin.dataDeleteOldOrders')}
            </button>
            <button
              className="button-danger"
              type="button"
              disabled={Boolean(dataBusy)}
              onClick={() => void handleDeleteSessions()}
            >
              {dataBusy === 'sessions' ? t('admin.deleting') : t('admin.dataDeleteSessions')}
            </button>
            <button
              className="button-danger"
              type="button"
              disabled={Boolean(dataBusy) || !selectedDataRestaurantId}
              onClick={() => void handleDeleteRestaurant()}
            >
              {dataBusy === 'restaurant' ? t('admin.deleting') : t('admin.dataDeleteRestaurant')}
            </button>
          </div>
          <p className="helper-text">{t('admin.dataHelper')}</p>
        </section>
      </div>
    </main>
  )
}
