'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'

import { getClientUserContext } from '@/lib/auth/client'
import { listTeamMembers, type TeamMember } from '@/lib/auth/team-actions'
import { createClient } from '@/lib/supabase/client'
import { useLiveOrders } from '@/lib/hooks/use-live-orders'
import { LoadingBar } from '@/components/app/loading-bar'
import { useLanguage } from '@/components/app/language-provider'
import {
  acknowledgeNewOrder,
  clearPendingNewOrders,
  getPendingNewOrders,
  isNewOrderSoundEnabled,
  playNewOrderSound,
  setNewOrderSoundEnabled,
  subscribeNewOrders,
  type PendingNewOrder,
} from '@/lib/notifications/new-order-alert'
import { HISTORY_STATUSES, OPEN_STATUSES } from '@/lib/orders/status'

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

type OrderItemRow = {
  id: string
  item_name: string
  quantity: number
  unit_price: number
  notes: string | null
  modifiers: string[]
}

type OrderRow = {
  id: string
  order_number: number | null
  table_id: string
  status: string
  total: number
  currency: string
  customer_note: string | null
  created_at: string
  public_tracking_token: string | null
  restaurant_tables:
    | {
        name: string
      }
    | Array<{
        name: string
      }>
    | null
  order_items: OrderItemRow[] | null
}

type RestaurantOption = {
  id: string
  name: string
}

function getTableName(table: TableRow, fallback = 'Unknown table') {
  return table.name || fallback
}

function getOrderLabel(order: OrderRow) {
  return order.order_number != null ? String(order.order_number) : order.id.slice(0, 8)
}

function getOrderTableName(order: OrderRow, fallback = 'Unknown table') {
  const table = Array.isArray(order.restaurant_tables) ? order.restaurant_tables[0] : order.restaurant_tables
  return table?.name || fallback
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

type TranslateFn = (key: string, params?: Record<string, string | number>) => string

// Shared compact order summary, mirroring what the customer sees on the
// tracking page (line items, modifiers, customer note, total).
function OrderSummary({
  order,
  t,
  onDismiss,
}: {
  order: OrderRow
  t: TranslateFn
  onDismiss?: (orderId: string) => void
}) {
  const lineItems = order.order_items || []
  return (
    <div className="stack" style={{ marginTop: '12px' }}>
      <ul className="list">
        {lineItems.map((line) => (
          <li key={line.id}>
            <div className="cart-line-header">
              <div>
                <strong>{line.item_name}</strong>
                <p className="muted">
                  {t('home.quantity')}: {line.quantity} · {formatCurrency(line.unit_price, order.currency)}
                </p>
                {line.modifiers && line.modifiers.length > 0 ? (
                  <p className="muted">{line.modifiers.join(' · ')}</p>
                ) : null}
              </div>
              <span>{formatCurrency(line.unit_price * line.quantity, order.currency)}</span>
            </div>
          </li>
        ))}
      </ul>
      {order.customer_note ? (
        <p className="muted">{t('home.customerNoteLine', { note: order.customer_note })}</p>
      ) : null}
      <div className="cart-line-header">
        <strong>{t('common.total')}</strong>
        <strong>{formatCurrency(order.total, order.currency)}</strong>
      </div>
      {onDismiss ? (
        <div>
          <button className="button-danger" type="button" onClick={() => onDismiss(order.id)}>
            {t('home.dismissOrder')}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function formatDateTime(value: string) {
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

// Shared list-item rendering for the Live orders and Order history panels,
// keeping both views identical (table, status, time, total, expandable summary).
function OrderListItem({
  order,
  t,
  expanded,
  onToggle,
  onDismiss,
  manageHref,
}: {
  order: OrderRow
  t: TranslateFn
  expanded: boolean
  onToggle: () => void
  onDismiss?: () => void
  manageHref?: string
}) {
  const unknownTable = t('home.unknownTable')
  return (
    <li>
      <div className="cart-line-header">
        <div>
          <strong>
            {t('home.table')} {getOrderTableName(order, unknownTable)}
          </strong>
          <p className="muted">
            {t('common.status')}: {t(`status.${order.status}`)} ·{' '}
            {t('orders.submitted', { datetime: formatDateTime(order.created_at) })}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span className="badge">{t(`status.${order.status}`)}</span>
          <strong>{formatCurrency(order.total, order.currency)}</strong>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' }}>
        <button className="button-secondary" type="button" onClick={onToggle}>
          {expanded ? t('home.hideSummary') : t('home.viewSummary')}
        </button>
        {manageHref ? (
          <Link className="button-secondary" href={manageHref}>
            {t('home.manageInOrders')}
          </Link>
        ) : null}
      </div>
      {expanded ? <OrderSummary order={order} t={t} onDismiss={onDismiss} /> : null}
    </li>
  )
}

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
  const [staff, setStaff] = useState<TeamMember[]>([])
  const [staffEmailMap, setStaffEmailMap] = useState<Record<string, string>>({})
  const [staffNameMap, setStaffNameMap] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [todayStats, setTodayStats] = useState<{ orders: number; revenue: number }>({ orders: 0, revenue: 0 })
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [expandedHistoryOrderId, setExpandedHistoryOrderId] = useState<string | null>(null)
  const [liveOrdersOpen, setLiveOrdersOpen] = useState(true)
  const [orderHistoryOpen, setOrderHistoryOpen] = useState(true)
  const [newOrderSoundEnabled, setNewOrderSoundEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return isNewOrderSoundEnabled()
  })
  const [liveGroup, setLiveGroup] = useState<'list' | 'status' | 'table'>(() => {
    if (typeof window === 'undefined') return 'list'
    return (localStorage.getItem('staffHomeLiveGroup') as 'list' | 'status' | 'table' | null) || 'list'
  })
  const [tableOrdersExpanded, setTableOrdersExpanded] = useState<Record<string, boolean>>({})
  const [expandedTableOrderId, setExpandedTableOrderId] = useState<string | null>(null)
  const [assignDrafts, setAssignDrafts] = useState<Record<string, string>>({})
  const [closingTableId, setClosingTableId] = useState<string | null>(null)
  const [pendingOrders, setPendingOrders] = useState<PendingNewOrder[]>([])
  const [expandedNoticeOrderId, setExpandedNoticeOrderId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'MANAGER' | 'STAFF' | null>(null)
  const [restaurantCurrency, setRestaurantCurrency] = useState('EUR')

  // Shared live-orders data layer (fetch + realtime refresh) — the same
  // implementation the Orders workspace uses. New orders are reported to the
  // shared notification store (nav badge, tab title, chime, this list).
  const { orders, refreshOrders, initialLoading } = useLiveOrders(selectedRestaurantId, {
    alertLabel: t('notify.tabTitle'),
  })

  // Every new order in the restaurant surfaces here as an expandable line with
  // Accept / Dismiss, regardless of who claimed the table.
  useEffect(() => {
    setPendingOrders(getPendingNewOrders())
    return subscribeNewOrders((pending) => setPendingOrders(pending))
  }, [])

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
        setError(restaurantsError?.message || t('home.error.noRestaurants'))
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
      setError(t('home.error.noAccount'))
      setLoading(false)
      return
    }

    const savedRestaurantId = typeof window !== 'undefined' ? localStorage.getItem('staffHomeRestaurantId') || '' : ''
    const candidateId = restaurantOverrideId || selectedRestaurantId || savedRestaurantId
    const selected = options.find((option) => option.id === candidateId) ?? options[0]

    // Always publish the resolved restaurant id — it drives the shared
    // live-orders data layer (useLiveOrders). Staff with a single membership
    // used to keep it empty and never fetched any orders.
    setSelectedRestaurantId(selected.id)

    if (options.length > 1) {
      setRestaurantOptions(options)
      if (typeof window !== 'undefined') {
        localStorage.setItem('staffHomeRestaurantId', selected.id)
      }
    } else {
      setRestaurantOptions([])
    }

    activeRestaurantIdRef.current = selected.id
    setRestaurantName(selected.name)

    const membershipForRestaurant = context.memberships.find((membership) => membership.restaurantId === selected.id)
    setCurrentUserRole(membershipForRestaurant?.role ?? null)

    const { data: currencyRow } = await supabase
      .from('restaurants')
      .select('currency')
      .eq('id', selected.id)
      .maybeSingle()
    setRestaurantCurrency((currencyRow?.currency as string | undefined) || 'EUR')

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const [tableResult, teamResult, todayResult] = await Promise.all([
      supabase
        .from('restaurant_tables')
        .select('id, name, active, assigned_staff_id, dining_sessions(id, status)')
        .eq('restaurant_id', selected.id)
        .order('name'),
      listTeamMembers(selected.id).catch(() => ({ error: undefined, members: undefined })),
      supabase
        .from('orders')
        .select('total')
        .eq('restaurant_id', selected.id)
        .gte('created_at', startOfToday.toISOString()),
    ])

    if (tableResult.error) {
      setError(tableResult.error.message || t('home.error.load'))
    } else {
      setTables((tableResult.data as TableRow[]) || [])
    }

    const todayRows = (todayResult.data as Array<{ total: number }> | null) || []
    setTodayStats({
      orders: todayRows.length,
      revenue: todayRows.reduce((sum, row) => sum + Number(row.total), 0),
    })

    const members = (teamResult && teamResult.members) || []
    setStaff(members)
    setStaffEmailMap(Object.fromEntries(members.map((member) => [member.userId, member.email])))
    setStaffNameMap(Object.fromEntries(members.map((member) => [member.userId, member.name || member.email])))
    setLoading(false)
  }

  useEffect(() => {
    void loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRestaurantSelection(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    setLoading(true)
    await loadDashboard(nextRestaurantId)
  }

  async function handleAssignTable(tableId: string, staffUserId: string) {
    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('restaurant_tables')
      .update({ assigned_staff_id: staffUserId || null })
      .eq('id', tableId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(t('home.claimNotice'))
    setAssignDrafts((current) => ({ ...current, [tableId]: '' }))
    await loadDashboard(activeRestaurantIdRef.current || undefined)
  }

  // Closing a table ends its session AND completes its still-open orders:
  // they are marked SERVED (leave live orders/history) and the next order on
  // the table starts a brand-new dining session (a new customer).
  async function handleCloseTable(tableId: string) {
    const table = tables.find((entry) => entry.id === tableId)
    if (!table) return
    if (!window.confirm(t('home.confirmCloseTable', { table: table.name }))) return

    setClosingTableId(tableId)
    setSaving(true)
    setError(null)
    setNotice(null)

    const activeSession = (table.dining_sessions || []).find((session) => session.status === 'ACTIVE')
    if (activeSession) {
      await supabase
        .from('dining_sessions')
        .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
        .eq('id', activeSession.id)
    }

    const openOrders = orders.filter(
      (order) => order.table_id === tableId && OPEN_STATUSES.includes(order.status)
    )
    if (openOrders.length > 0) {
      const { error: completeError } = await supabase
        .from('orders')
        .update({ status: 'SERVED' })
        .eq('table_id', tableId)
        .in('status', OPEN_STATUSES)

      if (!completeError) {
        await supabase.from('order_status_history').insert(
          openOrders.map((order) => ({
            order_id: order.id,
            old_status: order.status,
            new_status: 'SERVED',
          }))
        )
      }
    }

    setClosingTableId(null)
    setSaving(false)
    setNotice(t('home.tableClosed', { table: table.name }))
    await loadDashboard(activeRestaurantIdRef.current || undefined)
  }

  // "Accept" on the new-order notification: moves the order to ACCEPTED and
  // records the status history entry, matching the Orders workspace flow.
  async function handleAcceptNewOrder(orderId: string) {
    const existing = orders.find((entry) => entry.id === orderId)
    const oldStatus = existing?.status ?? 'NEW'
    const label = existing ? getOrderLabel(existing) : orderId.slice(0, 8)

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'ACCEPTED' })
      .eq('id', orderId)

    if (!updateError) {
      const { error: historyError } = await supabase.from('order_status_history').insert({
        order_id: orderId,
        old_status: oldStatus,
        new_status: 'ACCEPTED',
        changed_by: currentUserId,
      })
      if (!historyError) {
        setNotice(t('orders.notice.statusChanged', { id: label, status: 'ACCEPTED' }))
      }
      acknowledgeNewOrder(orderId)
      setExpandedNoticeOrderId(null)
      void refreshOrders()
    } else {
      setError(updateError.message)
    }

    setSaving(false)
  }

  // "Dismiss" on a new-order notification: acknowledge it without changing the
  // order status (the kitchen may still accept it later).
  function handleDismissNotification(orderId: string) {
    acknowledgeNewOrder(orderId)
    setExpandedNoticeOrderId((current) => (current === orderId ? null : current))
  }

  // Reject an order directly from the home dashboard live views.
  async function handleDismissOrder(orderId: string) {
    const order = orders.find((entry) => entry.id === orderId)
    if (!order) return
    if (!window.confirm(t('home.confirmDismissOrder', { id: getOrderLabel(order) }))) return

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'REJECTED' })
      .eq('id', orderId)

    if (!updateError) {
      const { error: historyError } = await supabase.from('order_status_history').insert({
        order_id: orderId,
        old_status: order.status,
        new_status: 'REJECTED',
        changed_by: currentUserId,
      })
      if (!historyError) {
        setNotice(t('orders.notice.statusChanged', { id: getOrderLabel(order), status: 'REJECTED' }))
      }
      void refreshOrders()
    } else {
      setError(updateError.message)
    }

    setSaving(false)
  }

  const activeTables = tables.filter((table) => table.active)
  // Owners, managers and platform admins can close tables; the assign picker
  // is available to everyone (the owner appears in it as well).
  const canAssignTable = currentUserRole === 'OWNER' || currentUserRole === 'MANAGER' || isPlatformAdmin

  // Assignee picker options: the signed-in user first ("Me"), then every team
  // member (deduplicated by user id) so owners can assign to themselves.
  const assigneeOptions = useMemo(() => {
    const options: Array<{ id: string; label: string }> = []
    const seen = new Set<string>()
    const add = (id: string, label: string) => {
      if (!id || seen.has(id)) return
      seen.add(id)
      options.push({ id, label })
    }
    if (currentUserId) {
      add(currentUserId, t('home.assigneeMe'))
    }
    for (const member of staff) {
      add(member.userId, staffNameMap[member.userId] ?? member.email)
    }
    return options
  }, [currentUserId, staff, staffNameMap, t])
  const liveOrders = orders.filter((order) => OPEN_STATUSES.includes(order.status))
  const historyOrders = orders.filter((order) => HISTORY_STATUSES.includes(order.status))

  // Groupings for the Live orders view: by workflow status or by table.
  const liveStatusGroups = OPEN_STATUSES.map((status) => ({
    status,
    orders: liveOrders.filter((order) => order.status === status),
  })).filter((group) => group.orders.length > 0)

  const liveTableGroups = Array.from(
    liveOrders.reduce((map, order) => {
      const name = getOrderTableName(order, t('home.unknownTable'))
      const list = map.get(name) || []
      list.push(order)
      map.set(name, list)
      return map
    }, new Map<string, OrderRow[]>())
  ).map(([name, orders]) => ({ name, orders }))
  const occupiedTablesCount = activeTables.filter((table) =>
    (table.dining_sessions || []).some((session) => session.status === 'ACTIVE')
  ).length
  const openOrdersCount = orders.filter((order) => OPEN_STATUSES.includes(order.status)).length

  if (loading || initialLoading) {
    return (
      <main className="page-shell">
        <div className="page-grid">
          <section className="panel stack">
            <LoadingBar />
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

          {pendingOrders.length > 0 ? (
            <section className="panel stack" style={{ marginTop: '12px' }}>
              <span className="eyebrow">{t('home.newOrdersEyebrow')}</span>
              <ul className="list">
                {pendingOrders.map((entry) => {
                  const order = orders.find((candidate) => candidate.id === entry.orderId)
                  const expanded = expandedNoticeOrderId === entry.orderId
                  const label = entry.orderNumber != null ? String(entry.orderNumber) : entry.orderId.slice(0, 8)
                  return (
                    <li key={entry.orderId} className="notice-line">
                      <div className="notice-line-top">
                        <strong>
                          {t('home.newOrderLine', {
                            number: label,
                            table: entry.tableName,
                            total: formatCurrency(entry.total, entry.currency),
                          })}
                        </strong>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <button
                            className="button-secondary button-sm"
                            type="button"
                            onClick={() => setExpandedNoticeOrderId(expanded ? null : entry.orderId)}
                          >
                            {expanded ? t('home.hideSummary') : t('home.viewSummary')}
                          </button>
                          <button
                            className="button button-sm"
                            type="button"
                            disabled={saving}
                            onClick={() => void handleAcceptNewOrder(entry.orderId)}
                          >
                            {t('home.acceptOrder')}
                          </button>
                          <button
                            className="button-secondary button-sm"
                            type="button"
                            disabled={saving}
                            onClick={() => handleDismissNotification(entry.orderId)}
                          >
                            {t('home.dismissOrder')}
                          </button>
                        </div>
                      </div>
                      {expanded && order ? (
                        <OrderSummary order={order} t={t} />
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            </section>
          ) : null}

          <div className="pill-row">
            <span className="badge">{isPlatformAdmin ? 'SUPER_ADMIN' : t('common.role')}</span>
            <Link className="button-secondary" href="/platform/orders">
              {t('home.openOrders')}
            </Link>
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('home.metrics')}</span>
          <div className="panel-grid">
            <article className="metric">
              <span className="eyebrow">{t('home.todaysOrders')}</span>
              <strong>{todayStats.orders}</strong>
              {todayStats.orders === 0 ? <p className="muted">{t('home.todayEmpty')}</p> : null}
            </article>
            <article className="metric">
              <span className="eyebrow">{t('home.openOrdersCount')}</span>
              <strong>{openOrdersCount}</strong>
            </article>
            <article className="metric">
              <span className="eyebrow">{t('home.revenueToday')}</span>
              <strong>{formatCurrency(todayStats.revenue, restaurantCurrency)}</strong>
            </article>
            <article className="metric">
              <span className="eyebrow">{t('home.occupiedTables')}</span>
              <strong>
                {occupiedTablesCount}/{activeTables.length}
              </strong>
            </article>
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('home.quickActions')}</span>
          <div className="pill-row">
            <Link className="button-secondary" href="/platform/orders">
              {t('home.viewAllOrders')}
            </Link>
            <Link className="button-secondary" href="/platform/analytics">
              {t('nav.analytics')}
            </Link>
            <Link className="button-secondary" href="/platform/setup">
              {t('home.manageMenu')}
            </Link>
            <Link className="button-secondary" href="/platform/team">
              {t('home.manageTeam')}
            </Link>
            {isPlatformAdmin ? (
              <Link className="button-secondary" href="/admin">
                {t('home.adminConsole')}
              </Link>
            ) : null}
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('home.liveTables')}</span>
          <p className="helper-text">{t('home.tableAssignmentHelper')}</p>
          {activeTables.length === 0 ? <p className="muted">{t('home.noActiveTables')}</p> : null}
          <div className="panel-grid">
            {activeTables.map((table) => {
              const activeSession = (table.dining_sessions || []).find((session) => session.status === 'ACTIVE')
              const hasActiveSession = Boolean(activeSession)
              const assignedName = table.assigned_staff_id
                ? table.assigned_staff_id === currentUserId
                  ? t('home.handledByYou')
                  : `${t('home.handledBy')} ${staffNameMap[table.assigned_staff_id] ?? t('home.staffMember')}`
                : t('home.unassigned')
              // Orders belong to a visit (dining session). A free/closed table
              // starts a new visit, so it shows no orders at all; a table stays
              // occupied while its session is open even if every order is already
              // served, because the guests are still seated.
              const tableOrders = activeSession
                ? orders.filter((order) => order.table_id === table.id && order.session_id === activeSession.id)
                : []
              const ordersOpen = Boolean(tableOrdersExpanded[table.id])

              return (
                <article
                  key={table.id}
                  className={`metric table-card ${hasActiveSession ? 'table-card-occupied' : 'table-card-free'}`}
                >
                  <div className="table-card-head">
                    <strong>{getTableName(table, t('home.unknownTable'))}</strong>
                    <span className="table-card-status">
                      {hasActiveSession ? t('home.occupied') : t('home.free')}
                    </span>
                  </div>

                  <span className="table-card-assigned">{assignedName}</span>

                  {tableOrders.length === 0 ? (
                    <p className="table-card-empty">{t('home.noOrdersForTable')}</p>
                  ) : (
                    <div className="table-card-orders">
                      <button
                        className="table-card-orders-toggle"
                        type="button"
                        onClick={() =>
                          setTableOrdersExpanded((current) => ({ ...current, [table.id]: !current[table.id] }))
                        }
                      >
                        <span>
                          {t('home.itemsCount', { count: tableOrders.length })} ·{' '}
                          {formatCurrency(
                            tableOrders.reduce((sum, order) => sum + order.total, 0),
                            tableOrders[0]?.currency ?? restaurantCurrency
                          )}
                        </span>
                        <span aria-hidden="true">{ordersOpen ? '▴' : '▾'}</span>
                      </button>
                      {ordersOpen ? (
                        <div className="table-card-order-list">
                          {tableOrders.map((order) => {
                            const isSummaryOpen = expandedTableOrderId === order.id
                            return (
                              <button
                                key={order.id}
                                type="button"
                                onClick={() => setExpandedTableOrderId(isSummaryOpen ? null : order.id)}
                              >
                                <span>
                                  <strong>{t(`status.${order.status}`)}</strong> ·{' '}
                                  {t('home.itemsCount', { count: (order.order_items || []).length })} ·{' '}
                                  {formatCurrency(order.total, order.currency)}
                                </span>
                                <span>{formatDateTime(order.created_at)}</span>
                              </button>
                            )
                          })}
                          {expandedTableOrderId &&
                          tableOrders.some((order) => order.id === expandedTableOrderId) ? (
                            <OrderSummary
                              order={tableOrders.find((order) => order.id === expandedTableOrderId)!}
                              t={t}
                              onDismiss={() => void handleDismissOrder(expandedTableOrderId)}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )}

                  <div className="table-card-actions">
                    <select
                      className="input-sm"
                      aria-label={t('home.assignLabel')}
                      value={assignDrafts[table.id] ?? table.assigned_staff_id ?? ''}
                      onChange={(event) =>
                        setAssignDrafts((current) => ({ ...current, [table.id]: event.target.value }))
                      }
                    >
                      <option value="">{t('home.unassigned')}</option>
                      {assigneeOptions.map((assignee) => (
                        <option key={assignee.id} value={assignee.id}>
                          {assignee.label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="button-secondary button-sm"
                      type="button"
                      disabled={saving}
                      onClick={() => void handleAssignTable(table.id, assignDrafts[table.id] ?? '')}
                    >
                      {t('home.assign')}
                    </button>
                    {canAssignTable && hasActiveSession ? (
                      <button
                        className="button-danger button-sm"
                        type="button"
                        disabled={saving || closingTableId === table.id}
                        onClick={() => void handleCloseTable(table.id)}
                      >
                        {closingTableId === table.id ? t('home.closingTable') : t('home.closeTable')}
                      </button>
                    ) : null}
                  </div>
                </article>
              )
            })}
          </div>
        </section>

        <section className="panel stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ marginBottom: 0 }}>{t('home.liveOrders')}</span>
            <div className="pill-row" role="group" aria-label={t('home.groupOrders')}>
              <button
                type="button"
                className={liveGroup === 'list' ? 'button-secondary' : 'button-tertiary'}
                onClick={() => {
                  setLiveGroup('list')
                  localStorage.setItem('staffHomeLiveGroup', 'list')
                }}
              >
                {t('home.groupList')}
              </button>
              <button
                type="button"
                className={liveGroup === 'status' ? 'button-secondary' : 'button-tertiary'}
                onClick={() => {
                  setLiveGroup('status')
                  localStorage.setItem('staffHomeLiveGroup', 'status')
                }}
              >
                {t('home.groupByStatus')}
              </button>
              <button
                type="button"
                className={liveGroup === 'table' ? 'button-secondary' : 'button-tertiary'}
                onClick={() => {
                  setLiveGroup('table')
                  localStorage.setItem('staffHomeLiveGroup', 'table')
                }}
              >
                {t('home.groupByTable')}
              </button>
            </div>
            <button
              type="button"
              className="button-tertiary"
              aria-label={t('notify.testSound')}
              title={t('notify.testSound')}
              onClick={() => playNewOrderSound()}
            >
              🔊
            </button>
            <button
              type="button"
              className="button-tertiary"
              aria-pressed={newOrderSoundEnabled}
              aria-label={t('notify.soundToggle', { state: newOrderSoundEnabled ? t('notify.soundOn') : t('notify.soundOff') })}
              title={t('notify.soundToggle', { state: newOrderSoundEnabled ? t('notify.soundOn') : t('notify.soundOff') })}
              onClick={() => {
                const next = !newOrderSoundEnabled
                setNewOrderSoundEnabledState(next)
                setNewOrderSoundEnabled(next)
              }}
            >
              {newOrderSoundEnabled ? '🔔' : '🔕'}
            </button>
            <button
              type="button"
              className="button-tertiary"
              aria-label={liveOrdersOpen ? t('home.collapse') : t('home.expand')}
              onClick={() => setLiveOrdersOpen((current) => !current)}
            >
              {liveOrdersOpen ? t('home.collapse') : t('home.expand')}
            </button>
          </div>

          {liveOrdersOpen ? (
            <>
          {liveOrders.length === 0 ? <p className="muted">{t('home.noLiveOrders')}</p> : null}

          {liveGroup === 'list'
            ? (
                <ul className="list">
                  {liveOrders.map((order) => (
                    <OrderListItem
                      key={order.id}
                      order={order}
                      t={t}
                      expanded={expandedOrderId === order.id}
                      onToggle={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                      onDismiss={() => void handleDismissOrder(order.id)}
                      manageHref={`/platform/orders?restaurantId=${activeRestaurantIdRef.current || ''}&focus=${order.public_tracking_token || order.id}`}
                    />
                  ))}
                </ul>
              )
            : null}

          {liveGroup === 'status'
            ? liveStatusGroups.map((group) => (
                <div className="stack" key={group.status}>
                  <div className="cart-line-header">
                    <strong>{t(`statusLabel.${group.status}`)}</strong>
                    <span className="badge">{t('home.itemsCount', { count: group.orders.length })}</span>
                  </div>
                  <ul className="list">
                    {group.orders.map((order) => (
                      <OrderListItem
                        key={order.id}
                        order={order}
                        t={t}
                        expanded={expandedOrderId === order.id}
                        onToggle={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        onDismiss={() => void handleDismissOrder(order.id)}
                        manageHref={`/platform/orders?restaurantId=${activeRestaurantIdRef.current || ''}&focus=${order.public_tracking_token || order.id}`}
                      />
                    ))}
                  </ul>
                </div>
              ))
            : null}

          {liveGroup === 'table'
            ? liveTableGroups.map((group) => (
                <div className="stack" key={group.name}>
                  <div className="cart-line-header">
                    <strong>{group.name}</strong>
                    <span className="badge">{t('home.itemsCount', { count: group.orders.length })}</span>
                  </div>
                  <ul className="list">
                    {group.orders.map((order) => (
                      <OrderListItem
                        key={order.id}
                        order={order}
                        t={t}
                        expanded={expandedOrderId === order.id}
                        onToggle={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                        onDismiss={() => void handleDismissOrder(order.id)}
                        manageHref={`/platform/orders?restaurantId=${activeRestaurantIdRef.current || ''}&focus=${order.public_tracking_token || order.id}`}
                      />
                    ))}
                  </ul>
                </div>
              ))
            : null}
            </>
          ) : null}
        </section>


        <section className="panel stack">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span className="eyebrow" style={{ marginBottom: 0 }}>{t('home.orderHistory')}</span>
            <button
              type="button"
              className="button-tertiary"
              aria-label={orderHistoryOpen ? t('home.collapse') : t('home.expand')}
              onClick={() => setOrderHistoryOpen((current) => !current)}
            >
              {orderHistoryOpen ? t('home.collapse') : t('home.expand')}
            </button>
          </div>
          {orderHistoryOpen ? (
            <>
              {historyOrders.length === 0 ? <p className="muted">{t('home.noHistoryOrders')}</p> : null}
              <ul className="list">
                {historyOrders.map((order) => (
                  <OrderListItem
                    key={order.id}
                    order={order}
                    t={t}
                    expanded={expandedHistoryOrderId === order.id}
                    onToggle={() =>
                      setExpandedHistoryOrderId(expandedHistoryOrderId === order.id ? null : order.id)
                    }
                  />
                ))}
              </ul>
            </>
          ) : null}
        </section>



        <section className="panel stack">
          <span className="eyebrow">{t('home.team')}</span>
          {staff.length === 0 ? <p className="muted">{t('home.teamRosterHidden')}</p> : null}
          <ul className="list">
            {staff.map((member) => (
              <li key={member.userId}>
                <div className="cart-line-header">
                  <div>
                    <strong>{member.name || member.email}</strong>
                    <p className="muted">
                      {member.name ? member.email : ''}{member.name ? ' · ' : ''}
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
      </div>
    </main>
  )
}

