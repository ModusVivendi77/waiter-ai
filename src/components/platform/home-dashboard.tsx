'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

import { getClientUserContext } from '@/lib/auth/client'
import { listTeamMembers, type TeamMember } from '@/lib/auth/team-actions'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseSubscription } from '@/lib/hooks/use-supabase-subscription'
import { useLanguage } from '@/components/app/language-provider'
import { AddRestaurantForm } from '@/components/platform/add-restaurant-form'

type TableRow = {
  id: string
  name: string
  active: boolean
  assigned_staff_id: string | null
  dining_sessions:
    | Array<{
        id: string
        status: string
      }>
    | null
}

type OrderRow = {
  id: string
  status: string
  total: number
  currency: string
  created_at: string
  restaurant_tables:
    | {
        name: string
      }
    | Array<{
        name: string
      }>
    | null
}

type RestaurantOption = {
  id: string
  name: string
}

function getTableName(table: TableRow) {
  return table.name || 'Unknown table'
}

function getOrderTableName(order: OrderRow) {
  const table = Array.isArray(order.restaurant_tables) ? order.restaurant_tables[0] : order.restaurant_tables
  return table?.name || 'Unknown table'
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

const STATUS_ORDER = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED']

export function HomeDashboard() {
  const supabase = useMemo(() => createClient(), [])
  const { t } = useLanguage()
  const activeRestaurantIdRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [restaurantOptions, setRestaurantOptions] = useState<RestaurantOption[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const [tables, setTables] = useState<TableRow[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [staff, setStaff] = useState<TeamMember[]>([])
  const [staffEmailMap, setStaffEmailMap] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadDashboard(restaurantOverrideId?: string) {
    const context = await getClientUserContext()

    if (!context.user) {
      return
    }

    setIsPlatformAdmin(context.isPlatformAdmin)
    setCurrentUserId(context.user.id)

    let options: RestaurantOption[]

    if (context.isPlatformAdmin) {
      const { data: restaurants, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name')
        .order('name')

      if (restaurantsError || !restaurants || restaurants.length === 0) {
        setError(restaurantsError?.message || 'No restaurants found.')
        setLoading(false)
        return
      }
      options = (restaurants as RestaurantOption[]) || []
    } else {
      options = context.memberships.map((membership) => ({
        id: membership.restaurantId,
        name: membership.restaurantName,
      }))
    }

    if (options.length === 0) {
      setError('No restaurant is linked to this account yet.')
      setLoading(false)
      return
    }

    const savedRestaurantId = typeof window !== 'undefined' ? localStorage.getItem('staffHomeRestaurantId') || '' : ''
    const candidateId = restaurantOverrideId || selectedRestaurantId || savedRestaurantId
    const selected = options.find((option) => option.id === candidateId) ?? options[0]

    if (options.length > 1) {
      setRestaurantOptions(options)
      setSelectedRestaurantId(selected.id)
      if (typeof window !== 'undefined') {
        localStorage.setItem('staffHomeRestaurantId', selected.id)
      }
    } else {
      setRestaurantOptions([])
    }

    activeRestaurantIdRef.current = selected.id
    setRestaurantName(selected.name)

    const [tableResult, orderResult, teamResult] = await Promise.all([
      supabase
        .from('restaurant_tables')
        .select('id, name, active, assigned_staff_id, dining_sessions(id, status)')
        .eq('restaurant_id', selected.id)
        .order('name'),
      supabase
        .from('orders')
        .select('id, status, total, currency, created_at, restaurant_tables(name)')
        .eq('restaurant_id', selected.id)
        .order('created_at', { ascending: false })
        .limit(10),
      listTeamMembers(selected.id).catch(() => ({ error: undefined, members: undefined })),
    ])

    if (tableResult.error || orderResult.error) {
      setError(tableResult.error?.message || orderResult.error?.message || 'Failed to load dashboard.')
    } else {
      setTables((tableResult.data as TableRow[]) || [])
      setOrders((orderResult.data as OrderRow[]) || [])
    }

    const members = (teamResult && teamResult.members) || []
    setStaff(members)
    setStaffEmailMap(Object.fromEntries(members.map((member) => [member.userId, member.email])))
    setLoading(false)
  }

  useEffect(() => {
    void loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function refreshOrders() {
    if (!activeRestaurantIdRef.current) return
    const { data } = await supabase
      .from('orders')
      .select('id, status, total, currency, created_at, restaurant_tables(name)')
      .eq('restaurant_id', activeRestaurantIdRef.current)
      .order('created_at', { ascending: false })
      .limit(10)
    if (data) {
      setOrders(data as OrderRow[])
    }
  }

  useSupabaseSubscription(
    `home_orders_${activeRestaurantIdRef.current || 'init'}`,
    'orders',
    ['INSERT', 'UPDATE'],
    () => void refreshOrders(),
    [activeRestaurantIdRef.current]
  )

  async function handleRestaurantSelection(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    setLoading(true)
    await loadDashboard(nextRestaurantId)
  }

  async function handleClaimTable(tableId: string) {
    if (!currentUserId) return

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: rpcError } = await supabase.rpc('claim_table_staff', {
      target_table_id: tableId,
      target_user_id: currentUserId,
    })

    setSaving(false)

    if (rpcError) {
      setError(rpcError.message)
      return
    }

    setNotice(t('home.claimNotice'))
    await loadDashboard(activeRestaurantIdRef.current || undefined)
  }

  const activeTables = tables.filter((table) => table.active)
  const liveOrders = orders.filter((order) => STATUS_ORDER.includes(order.status))

  if (loading) {
    return (
      <main className="page-shell">
        <div className="page-grid">
          <section className="panel stack">
            <span className="eyebrow">{t('home.eyebrow')}</span>
            <h1 className="section-title">{t('home.loadingWorkspace')}</h1>
          </section>
        </div>
      </main>
    )
  }

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="panel stack">
          <span className="eyebrow">{t('home.eyebrow')}</span>
          <h1 className="section-title">{restaurantName ?? t('orders.yourRestaurant')}</h1>
          <p className="lead">{t('home.lead')}</p>

          {restaurantOptions.length > 1 ? (
            <div className="field">
              <label htmlFor="homeRestaurantSelector">{t('home.restaurantContext')}</label>
              <select
                id="homeRestaurantSelector"
                value={selectedRestaurantId}
                onChange={(event) => void handleRestaurantSelection(event.target.value)}
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

          <div className="pill-row">
            <span className="badge">{isPlatformAdmin ? 'SUPER_ADMIN' : t('common.role')}</span>
            <Link className="button-secondary" href="/platform/orders">
              {t('home.openOrders')}
            </Link>
            <Link className="button-secondary" href="/platform/analytics">
              {t('nav.analytics')}
            </Link>
            <Link className="button-secondary" href="/platform/setup">
              {t('home.restaurantSetup')}
            </Link>
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('home.liveTables')}</span>
          <p className="helper-text">{t('home.tableAssignmentHelper')}</p>
          {activeTables.length === 0 ? <p className="muted">{t('home.noActiveTables')}</p> : null}
          <div className="panel-grid">
            {activeTables.map((table) => {
              const hasActiveSession = (table.dining_sessions || []).some((session) => session.status === 'ACTIVE')
              const assignedName = table.assigned_staff_id
                ? table.assigned_staff_id === currentUserId
                  ? t('home.handledByYou')
                  : `${t('home.handledBy')} ${staffEmailMap[table.assigned_staff_id] ?? t('home.staffMember')}`
                : t('home.unassigned')

              return (
                <article className="metric" key={table.id}>
                  <span
                    className={
                      hasActiveSession ? 'status-pill status-pill-occupied' : 'status-pill status-pill-free'
                    }
                  >
                    {hasActiveSession ? t('home.occupied') : t('home.free')}
                  </span>
                  <strong>{getTableName(table)}</strong>
                  <p className="muted">{assignedName}</p>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => void handleClaimTable(table.id)}
                  >
                    {table.assigned_staff_id === currentUserId ? `${t('home.claimed')} ✓` : t('home.claimTable')}
                  </button>
                </article>
              )
            })}
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('home.liveOrders')}</span>
          {liveOrders.length === 0 ? <p className="muted">{t('home.noLiveOrders')}</p> : null}
          <ul className="list">
            {liveOrders.map((order) => (
              <li key={order.id}>
                <div className="cart-line-header">
                  <div>
                    <strong>
                      {t('home.table')} {getOrderTableName(order)}
                    </strong>
                    <p className="muted">
                      {t('common.status')}: {t(`status.${order.status}`)}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span className="badge">{t(`status.${order.status}`)}</span>
                    <strong>{formatCurrency(order.total, order.currency)}</strong>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('home.team')}</span>
          {staff.length === 0 ? <p className="muted">{t('home.teamRosterHidden')}</p> : null}
          <ul className="list">
            {staff.map((member) => (
              <li key={member.userId}>
                <div className="cart-line-header">
                  <div>
                    <strong>{member.email}</strong>
                    <p className="muted">
                      {t('common.role')}: {member.role}
                    </p>
                  </div>
                  <span className="badge">{member.role}</span>
                </div>
              </li>
            ))}
          </ul>
          {isPlatformAdmin || staff.some((member) => member.role === 'OWNER') ? (
            <Link className="button-secondary" href="/platform/team">
              {t('home.manageTeam')}
            </Link>
          ) : null}
        </section>

        <section className="panel stack">
          <span className="eyebrow">Add another restaurant</span>
          <p className="helper-text">
            Register an additional restaurant under this account. It is created instantly and you are linked as its
            owner — no email confirmation needed. Use the restaurant selector on this page and inside Orders / Setup /
            Analytics to switch between them.
          </p>
          <AddRestaurantForm />
        </section>
      </div>
    </main>
  )
}

