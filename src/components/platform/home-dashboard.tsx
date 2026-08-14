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

function getTableName(table: TableRow) {
  return table.name || 'Unknown table'
}

function getOrderLabel(order: OrderRow) {
  return order.order_number != null ? String(order.order_number) : order.id.slice(0, 8)
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

const STATUS_ORDER = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED']
const OPEN_STATUSES = ['NEW', 'ACCEPTED', 'PREPARING', 'READY']

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
  const [todayStats, setTodayStats] = useState<{ orders: number; revenue: number }>({ orders: 0, revenue: 0 })
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null)
  const [tableOrdersExpanded, setTableOrdersExpanded] = useState<Record<string, boolean>>({})
  const [expandedTableOrderId, setExpandedTableOrderId] = useState<string | null>(null)
  const [newOrderNotice, setNewOrderNotice] = useState<{
    orderId: string
    orderNumber: number | null
    tableName: string
    total: number
    currency: string
    items: OrderItemRow[]
  } | null>(null)
  const [noticeSummaryOpen, setNoticeSummaryOpen] = useState(false)
  const [currentUserRole, setCurrentUserRole] = useState<'OWNER' | 'MANAGER' | 'STAFF' | null>(null)
  const [restaurantCurrency, setRestaurantCurrency] = useState('EUR')

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

    const [tableResult, orderResult, teamResult, todayResult] = await Promise.all([
      supabase
        .from('restaurant_tables')
        .select('id, name, active, assigned_staff_id, dining_sessions(id, status)')
        .eq('restaurant_id', selected.id)
        .order('name'),
      supabase
        .from('orders')
        .select(
          'id, order_number, table_id, status, total, currency, customer_note, created_at, restaurant_tables(name), order_items(id, item_name, quantity, unit_price, notes, modifiers)'
        )
        .eq('restaurant_id', selected.id)
        .order('created_at', { ascending: false })
        .limit(100),
      listTeamMembers(selected.id).catch(() => ({ error: undefined, members: undefined })),
      supabase
        .from('orders')
        .select('total')
        .eq('restaurant_id', selected.id)
        .gte('created_at', startOfToday.toISOString()),
    ])

    if (tableResult.error || orderResult.error) {
      setError(tableResult.error?.message || orderResult.error?.message || t('home.error.load'))
    } else {
      setTables((tableResult.data as TableRow[]) || [])
      setOrders((orderResult.data as OrderRow[]) || [])
    }

    const todayRows = (todayResult.data as Array<{ total: number }> | null) || []
    setTodayStats({
      orders: todayRows.length,
      revenue: todayRows.reduce((sum, row) => sum + Number(row.total), 0),
    })

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
      .select(
        'id, order_number, table_id, status, total, currency, customer_note, created_at, restaurant_tables(name), order_items(id, item_name, quantity, unit_price, notes, modifiers)'
      )
      .eq('restaurant_id', activeRestaurantIdRef.current)
      .order('created_at', { ascending: false })
      .limit(100)
    if (data) {
      setOrders(data as OrderRow[])
    }
  }

  useSupabaseSubscription(
    `home_orders_${activeRestaurantIdRef.current || 'init'}`,
    'orders',
    ['INSERT', 'UPDATE'],
    async (payload) => {
      // New-order notification for the restaurant owner and the staff member
      // who claimed the table. Other staff still see the order refresh but get
      // no banner.
      if (payload?.eventType === 'INSERT') {
        const inserted = payload.new as
          | { id?: string; order_number?: number | null; restaurant_id?: string; table_id?: string; total?: number }
          | undefined
        if (
          inserted &&
          inserted.restaurant_id === activeRestaurantIdRef.current &&
          inserted.table_id
        ) {
          const table = tables.find((entry) => entry.id === inserted.table_id)
          const claimedByCurrentUser = Boolean(
            currentUserId && table && table.assigned_staff_id === currentUserId
          )
          const isOwnerOrPlatformAdmin = isPlatformAdmin || currentUserRole === 'OWNER'
          if (claimedByCurrentUser || isOwnerOrPlatformAdmin) {
            // The realtime payload truncates the CHAR(3) currency column, so use
            // the restaurant currency resolved on load instead.
            const { data: orderItems } = await supabase
              .from('order_items')
              .select('id, item_name, quantity, unit_price, notes, modifiers')
              .eq('order_id', inserted.id || '')
            setNewOrderNotice({
              orderId: inserted.id || '',
              orderNumber: inserted.order_number ?? null,
              tableName: table?.name ?? 'Unknown table',
              total: Number(inserted.total) || 0,
              currency: restaurantCurrency,
              items: (orderItems as OrderItemRow[]) || [],
            })
            setNoticeSummaryOpen(false)
          }
        }
      }
      void refreshOrders()
    },
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

  // "Accept" on the new-order notification: moves the order to ACCEPTED and
  // records the status history entry, matching the Orders workspace flow.
  async function handleAcceptNewOrder(orderId: string) {
    const order = orders.find((entry) => entry.id === orderId)
    if (!order) {
      setNewOrderNotice(null)
      return
    }

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
        old_status: order.status,
        new_status: 'ACCEPTED',
        changed_by: currentUserId,
      })
      if (!historyError) {
        setNotice(t('orders.notice.statusChanged', { id: orderId.slice(0, 8), status: 'ACCEPTED' }))
      }
      setNewOrderNotice(null)
      void refreshOrders()
    } else {
      setError(updateError.message)
    }

    setSaving(false)
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
  const liveOrders = orders.filter((order) => STATUS_ORDER.includes(order.status))
  const occupiedTablesCount = activeTables.filter((table) =>
    (table.dining_sessions || []).some((session) => session.status === 'ACTIVE')
  ).length
  const openOrdersCount = orders.filter((order) => OPEN_STATUSES.includes(order.status)).length

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

          {newOrderNotice ? (
            <div
              className="message"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <strong>
                {t('home.newOrderBanner', {
                  number: newOrderNotice.orderNumber != null ? String(newOrderNotice.orderNumber) : newOrderNotice.orderId.slice(0, 8),
                  table: newOrderNotice.tableName,
                  total: formatCurrency(newOrderNotice.total, newOrderNotice.currency),
                })}
              </strong>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button
                  className="button-secondary"
                  type="button"
                  onClick={() => setNoticeSummaryOpen((current) => !current)}
                >
                  {noticeSummaryOpen ? t('home.hideSummary') : t('home.viewSummary')}
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={saving}
                  onClick={() => void handleAcceptNewOrder(newOrderNotice.orderId)}
                >
                  {t('home.acceptOrder')}
                </button>
                <button
                  className="button-secondary"
                  type="button"
                  disabled={saving}
                  onClick={() => setNewOrderNotice(null)}
                >
                  {t('orders.dismiss')}
                </button>
              </div>
            </div>
          ) : null}
          {newOrderNotice && noticeSummaryOpen ? (
            <div className="panel stack" style={{ marginTop: '12px' }}>
              <OrderSummary
                t={t}
                order={{
                  id: newOrderNotice.orderId,
                  order_number: newOrderNotice.orderNumber,
                  table_id: '',
                  status: 'NEW',
                  total: newOrderNotice.total,
                  currency: newOrderNotice.currency,
                  customer_note: null,
                  created_at: '',
                  restaurant_tables: null,
                  order_items: newOrderNotice.items,
                }}
              />
            </div>
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
              const hasActiveSession = (table.dining_sessions || []).some((session) => session.status === 'ACTIVE')
              const assignedName = table.assigned_staff_id
                ? table.assigned_staff_id === currentUserId
                  ? t('home.handledByYou')
                  : `${t('home.handledBy')} ${staffEmailMap[table.assigned_staff_id] ?? t('home.staffMember')}`
                : t('home.unassigned')
              const tableOrders = orders.filter((order) => order.table_id === table.id)
              const ordersOpen = Boolean(tableOrdersExpanded[table.id])

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
                  {tableOrders.length === 0 ? (
                    <p className="muted" style={{ marginTop: '10px' }}>
                      {t('home.noOrdersForTable')}
                    </p>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() =>
                          setTableOrdersExpanded((current) => ({ ...current, [table.id]: !current[table.id] }))
                        }
                      >
                        {ordersOpen ? t('home.hideOrders') : t('home.showOrders')}
                      </button>
                    </div>
                  )}
                  {ordersOpen && tableOrders.length > 0 ? (
                    <div style={{ marginTop: '10px' }}>
                      <ul className="list">
                        {tableOrders.map((order) => {
                          const isSummaryOpen = expandedTableOrderId === order.id
                          return (
                            <li key={order.id}>
                              <button
                                className="button-secondary"
                                type="button"
                                style={{
                                  width: '100%',
                                  minHeight: '34px',
                                  justifyContent: 'space-between',
                                  flexWrap: 'wrap',
                                }}
                                onClick={() => setExpandedTableOrderId(isSummaryOpen ? null : order.id)}
                              >
                                <span>
                                  <strong>{t(`status.${order.status}`)}</strong>
                                  <span className="muted">
                                    {' '}· {t('home.itemsCount', { count: (order.order_items || []).length })} ·{' '}
                                    {formatCurrency(order.total, order.currency)}
                                  </span>
                                </span>
                                <span className="badge">{formatDateTime(order.created_at)}</span>
                              </button>
                              {isSummaryOpen ? (
                                <OrderSummary order={order} t={t} onDismiss={() => void handleDismissOrder(order.id)} />
                              ) : null}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  ) : null}
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
            {liveOrders.map((order) => {
              const isExpanded = expandedOrderId === order.id
              return (
                <li key={order.id}>
                  <div className="cart-line-header">
                    <div>
                      <strong>
                        {t('home.table')} {getOrderTableName(order)}
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
                    <button
                      className="button-secondary"
                      type="button"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                    >
                      {isExpanded ? t('home.hideSummary') : t('home.viewSummary')}
                    </button>
                  </div>
                  {isExpanded ? (
                    <OrderSummary order={order} t={t} onDismiss={() => void handleDismissOrder(order.id)} />
                  ) : null}
                </li>
              )
            })}
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
          <span className="eyebrow">{t('home.addAnotherEyebrow')}</span>
          <p className="helper-text">{t('home.addAnotherHelper')}</p>
          <AddRestaurantForm />
        </section>
      </div>
    </main>
  )
}

