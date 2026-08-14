'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { getClientUserContext } from '@/lib/auth/client'
import { listTeamMembers } from '@/lib/auth/team-actions'
import { deleteOrder } from '@/lib/admin/data-actions'
import { createClient } from '@/lib/supabase/client'
import { useSupabaseSubscription } from '@/lib/hooks/use-supabase-subscription'
import { useLanguage } from '@/components/app/language-provider'

type RestaurantMembership = {
  restaurantId: string
  restaurantName: string
  restaurantSlug: string
  role: 'OWNER' | 'MANAGER' | 'STAFF'
}

type RestaurantOption = {
  id: string
  name: string
}

type MenuOption = {
  id: string
  name: string
  price: number
  menu_categories?:
    | {
        name: string
      }
    | Array<{
        name: string
      }>
    | null
}

type OrderItemRow = {
  id: string
  menu_item_id: string
  item_name: string
  quantity: number
  unit_price: number
  notes: string | null
  modifiers: string[]
}

type OrderRow = {
  id: string
  status: string
  subtotal: number
  total: number
  currency: string
  customer_note: string | null
  public_tracking_token: string
  restaurant_id: string
  created_at: string
  waiter_id: string | null
  session_id: string | null
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

const statusOptions = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'REJECTED', 'CANCELLED'] as const

const STATUS_TABS = ['ALL', 'NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'CLOSED'] as const

const CLOSED_STATUSES = new Set(['REJECTED', 'CANCELLED'])

// Workflow order used for "sort by status".
const STATUS_PRIORITY: Record<string, number> = {
  NEW: 0,
  ACCEPTED: 1,
  PREPARING: 2,
  READY: 3,
  SERVED: 4,
  REJECTED: 5,
  CANCELLED: 5,
}

function orderMatchesTab(order: OrderRow, tab: string) {
  if (tab === 'ALL') return true
  if (tab === 'CLOSED') return CLOSED_STATUSES.has(order.status)
  return order.status === tab
}

type LineDraft = {
  quantity: string
  notes: string
}

type AddItemDraft = {
  menuItemId: string
  quantity: string
}

function getTableName(order: OrderRow) {
  const table = Array.isArray(order.restaurant_tables) ? order.restaurant_tables[0] : order.restaurant_tables
  return table?.name || 'Unknown table'
}

function getCategoryLabel(option: MenuOption) {
  const category = Array.isArray(option.menu_categories) ? option.menu_categories[0] : option.menu_categories
  return category?.name || 'Menu'
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function OrdersConsole() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [restaurantOptions, setRestaurantOptions] = useState<RestaurantOption[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [statusTab, setStatusTab] = useState<string>('ALL')
  const [sortMode, setSortMode] = useState<'created_desc' | 'created_asc' | 'status'>('created_desc')
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([])
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({})
  const [addItemDrafts, setAddItemDrafts] = useState<Record<string, AddItemDraft>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [teamEmailMap, setTeamEmailMap] = useState<Record<string, string>>({})
  const [activeSessionIds, setActiveSessionIds] = useState<Set<string>>(new Set())
  const [newOrderNotice, setNewOrderNotice] = useState<{
    orderId: string
    tableName: string
    total: number
    currency: string
  } | null>(null)
  const activeRestaurantIdRef = useRef<string | null>(null)

  async function loadData(restaurantOverrideId?: string) {
    const context = await getClientUserContext()

    if (!context.user) {
      setLoading(false)
      setError(t('orders.error.auth'))
      return
    }

    setIsPlatformAdmin(context.isPlatformAdmin)

    let activeRestaurantId = ''
    let activeRestaurantName = ''
    let currentRole: string | null = context.memberships[0]?.role ?? null

    if (context.isPlatformAdmin) {
      const { data: restaurants, error: restaurantsError } = await supabase.from('restaurants').select('id, name').order('name')

      if (restaurantsError || !restaurants || restaurants.length === 0) {
        setError(restaurantsError?.message || t('orders.error.noRestaurants'))
        setLoading(false)
        return
      }

      const typedRestaurants = (restaurants as RestaurantOption[]) || []
      setRestaurantOptions(typedRestaurants)

      const savedRestaurantId = typeof window !== 'undefined' ? localStorage.getItem('platformAdminOrdersRestaurantId') || '' : ''
      const requestedRestaurantId = searchParams.get('restaurantId') || ''
      const candidateId =
        restaurantOverrideId || requestedRestaurantId || selectedRestaurantId || savedRestaurantId || context.memberships[0]?.restaurantId || ''
      const selectedRestaurant = typedRestaurants.find((entry) => entry.id === candidateId) ?? typedRestaurants[0]
      activeRestaurantId = selectedRestaurant.id
      activeRestaurantName = selectedRestaurant.name
      currentRole = 'SUPER_ADMIN'
      setSelectedRestaurantId(selectedRestaurant.id)
      if (typeof window !== 'undefined') {
        localStorage.setItem('platformAdminOrdersRestaurantId', selectedRestaurant.id)
      }
    } else {
      const memberships = context.memberships.filter((item) => ['OWNER', 'MANAGER', 'STAFF'].includes(item.role)) as RestaurantMembership[]
      if (memberships.length === 0) {
        setError(t('orders.error.noAccess'))
        setLoading(false)
        return
      }

      const requestedRestaurantId = searchParams.get('restaurantId') || ''
      const savedRestaurantId = typeof window !== 'undefined' ? localStorage.getItem('staffOrdersRestaurantId') || '' : ''
      const candidateId = restaurantOverrideId || requestedRestaurantId || selectedRestaurantId || savedRestaurantId
      const selectedMembership = memberships.find((item) => item.restaurantId === candidateId) ?? memberships[0]

      if (memberships.length > 1) {
        setRestaurantOptions(memberships.map((item) => ({ id: item.restaurantId, name: item.restaurantName })))
        setSelectedRestaurantId(selectedMembership.restaurantId)
        if (typeof window !== 'undefined') {
          localStorage.setItem('staffOrdersRestaurantId', selectedMembership.restaurantId)
        }
      } else {
        setRestaurantOptions([])
        setSelectedRestaurantId('')
      }

      activeRestaurantId = selectedMembership.restaurantId
      activeRestaurantName = selectedMembership.restaurantName
      currentRole = selectedMembership.role
    }

    setRestaurantId(activeRestaurantId)
    setRestaurantName(activeRestaurantName)
    setRole(currentRole)
    setCurrentUserId(context.user.id)

    const [{ data: orderRows, error: orderError }, { data: menuRows, error: menuError }, teamResult, sessionResult] = await Promise.all([
      supabase
        .from('orders')
        .select('id, status, subtotal, total, currency, customer_note, public_tracking_token, restaurant_id, created_at, waiter_id, session_id, restaurant_tables(name), order_items(id, menu_item_id, item_name, quantity, unit_price, notes, modifiers)')
        .eq('restaurant_id', activeRestaurantId)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('menu_items')
        .select('id, name, price, menu_categories(name)')
        .eq('restaurant_id', activeRestaurantId)
        .eq('available', true)
        .order('name'),
      listTeamMembers(activeRestaurantId).catch(() => ({ error: undefined, members: undefined })),
      supabase.from('dining_sessions').select('id').eq('restaurant_id', activeRestaurantId).eq('status', 'ACTIVE'),
    ])

    setActiveSessionIds(new Set(((sessionResult?.data as Array<{ id: string }> | null) || []).map((session) => session.id)))

    setTeamEmailMap(
      Object.fromEntries((teamResult && teamResult.members ? teamResult.members : []).map((member) => [member.userId, member.email]))
    )

    if (orderError || menuError) {
      setError(orderError?.message || menuError?.message || t('orders.error.loadFailed'))
      setLoading(false)
      return
    }

    const typedOrders = (orderRows as OrderRow[]) || []
    setOrders(typedOrders)
    setMenuOptions((menuRows as MenuOption[]) || [])
    setNoteDrafts(Object.fromEntries(typedOrders.map((order) => [order.id, order.customer_note || ''])))
    setLineDrafts(
      Object.fromEntries(
        typedOrders.flatMap((order) =>
          ((order.order_items || []) as OrderItemRow[]).map((item) => [item.id, { quantity: String(item.quantity), notes: item.notes || '' }])
        )
      )
    )
    setAddItemDrafts((current) => {
      const defaults = Object.fromEntries(
        typedOrders.map((order) => [order.id, current[order.id] || { menuItemId: (menuRows as MenuOption[] | null)?.[0]?.id || '', quantity: '1' }])
      )
      return defaults
    })
    activeRestaurantIdRef.current = activeRestaurantId
    setLoading(false)
  }

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: orders.length }
    for (const tab of STATUS_TABS) {
      if (tab === 'ALL') continue
      counts[tab] = orders.filter((order) => orderMatchesTab(order, tab)).length
    }
    return counts
  }, [orders])

  const visibleOrders = useMemo(() => {
    const filtered = orders.filter((order) => orderMatchesTab(order, statusTab))
    const sorted = [...filtered]

    if (sortMode === 'created_asc') {
      sorted.sort((a, b) => a.created_at.localeCompare(b.created_at))
    } else if (sortMode === 'created_desc') {
      sorted.sort((a, b) => b.created_at.localeCompare(a.created_at))
    } else if (sortMode === 'status') {
      sorted.sort(
        (a, b) =>
          STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || b.created_at.localeCompare(a.created_at)
      )
    }

    return sorted
  }, [orders, statusTab, sortMode])

  // Handle real-time order updates (status, customer_note changes)
  const handleOrderUpdate = async (payload: any) => {
    const updatedOrder = payload.new as OrderRow
    if (activeRestaurantIdRef.current !== updatedOrder.restaurant_id) {
      return // Ignore updates for other restaurants
    }

    setOrders((current) =>
      current.map((order) =>
        order.id === updatedOrder.id
          ? {
              ...order,
              status: updatedOrder.status,
              customer_note: updatedOrder.customer_note,
              subtotal: updatedOrder.subtotal,
              total: updatedOrder.total,
            }
          : order
      )
    )
  }

  // Handle real-time new orders: prepend, show an in-app banner, and fire a
  // best-effort browser notification when permission is already granted.
  const handleOrderInsert = async (payload: any) => {
    const inserted = payload.new as { id: string; restaurant_id: string }
    if (activeRestaurantIdRef.current !== inserted.restaurant_id) {
      return // Ignore orders for other restaurants
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, status, subtotal, total, currency, customer_note, public_tracking_token, restaurant_id, created_at, waiter_id, session_id, restaurant_tables(name), order_items(id, menu_item_id, item_name, quantity, unit_price, notes, modifiers)')
      .eq('id', inserted.id)
      .maybeSingle()

    if (orderError || !orderData) {
      return
    }

    const order = orderData as OrderRow
    setOrders((current) => [order, ...current].slice(0, 30))
    setNewOrderNotice({
      orderId: order.id,
      tableName: getTableName(order),
      total: order.total,
      currency: order.currency,
    })

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`New order from ${getTableName(order)}`, {
          body: `${formatCurrency(order.total, order.currency)} — open the orders workspace.`,
        })
      } catch {
        // Browser notifications unavailable; the in-app banner covers it.
      }
    }
  }

  const handleOrderChange = async (payload: any) => {
    if (payload.eventType === 'INSERT') {
      await handleOrderInsert(payload)
    } else {
      await handleOrderUpdate(payload)
    }
  }

  // Auto-dismiss the new-order banner after a few seconds.
  useEffect(() => {
    if (!newOrderNotice) {
      return
    }
    const timer = setTimeout(() => setNewOrderNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [newOrderNotice])

  // Handle real-time order item changes (quantity, notes, added/removed items)
  const handleOrderItemChange = async (payload: any) => {
    const { eventType, new: newItem, old: oldItem } = payload
    const itemRestaurantId = payload.new?.restaurant_id ?? payload.old?.restaurant_id

    if (activeRestaurantIdRef.current !== itemRestaurantId) {
      return // Ignore updates for other restaurants
    }

    // When items change, reload the affected order to get updated totals
    const affectedOrderId = (newItem ?? oldItem)?.order_id
    if (affectedOrderId) {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, status, subtotal, total, currency, customer_note, public_tracking_token, restaurant_id, created_at, restaurant_tables(name), order_items(id, menu_item_id, item_name, quantity, unit_price, notes)')
        .eq('id', affectedOrderId)
        .maybeSingle()

      if (!orderError && orderData) {
        const updatedOrder = orderData as OrderRow
        setOrders((current) =>
          current.map((order) =>
            order.id === updatedOrder.id
              ? {
                  ...order,
                  order_items: updatedOrder.order_items,
                  subtotal: updatedOrder.subtotal,
                  total: updatedOrder.total,
                }
              : order
          )
        )

        // Update line drafts for the affected order
        const itemsMap = Object.fromEntries(
          ((updatedOrder.order_items || []) as OrderItemRow[]).map((item) => [
            item.id,
            { quantity: String(item.quantity), notes: item.notes || '' },
          ])
        )
        setLineDrafts((current) => ({ ...current, ...itemsMap }))
      }
    }
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  // Set up real-time subscriptions for orders and items
  useSupabaseSubscription(
    `orders_${activeRestaurantIdRef.current || 'init'}`,
    'orders',
    ['INSERT', 'UPDATE'],
    handleOrderChange,
    [activeRestaurantIdRef.current]
  )

  useSupabaseSubscription(
    `order_items_${activeRestaurantIdRef.current || 'init'}`,
    'order_items',
    ['INSERT', 'UPDATE', 'DELETE'],
    handleOrderItemChange,
    [activeRestaurantIdRef.current]
  )

  async function refreshOrderTotals(orderId: string) {
    const { data: itemRows, error: itemError } = await supabase
      .from('order_items')
      .select('quantity, unit_price')
      .eq('order_id', orderId)

    if (itemError) {
      throw new Error(itemError.message)
    }

    const subtotal = (((itemRows as Array<{ quantity: number; unit_price: number }>) || [])).reduce(
      (sum, item) => sum + Number(item.unit_price) * item.quantity,
      0
    )

    const { error: updateError } = await supabase.from('orders').update({ subtotal, total: subtotal }).eq('id', orderId)

    if (updateError) {
      throw new Error(updateError.message)
    }
  }

  async function handleRestaurantSelection(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    setLoading(true)
    await loadData(nextRestaurantId)
  }

  async function handleStatusChange(order: OrderRow, nextStatus: string) {
    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase.from('orders').update({ status: nextStatus }).eq('id', order.id)

    if (!updateError) {
      await supabase.from('order_status_history').insert({
        order_id: order.id,
        old_status: order.status,
        new_status: nextStatus,
      })

      // Publish a real-time broadcast so the public tracking page updates instantly.
      // Public customers listen on the `order-status-<orderId>` channel without auth.
      supabase
        .channel(`order-status-${order.id}`)
        .send({
          type: 'broadcast',
          event: 'order-status-update',
          payload: {
            orderId: order.id,
            status: nextStatus,
            timestamp: new Date().toISOString(),
          },
        })
        .then((broadcastResult) => {
          if (broadcastResult === 'error') {
            console.warn(`[Real-time] Broadcast failed for order ${order.id.slice(0, 8)}; customers will fall back to polling.`)
          }
        })
    }

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(t('orders.notice.statusChanged', { id: order.id.slice(0, 8), status: nextStatus }))
    await loadData(selectedRestaurantId || restaurantId || undefined)
  }

  async function handleTakeOrder(order: OrderRow) {
    if (!currentUserId) {
      setError(t('orders.error.noUser'))
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('orders')
      .update({ waiter_id: currentUserId })
      .eq('id', order.id)
      .eq('restaurant_id', order.restaurant_id)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(t('orders.notice.taken', { id: order.id.slice(0, 8) }))
    await loadData(selectedRestaurantId || restaurantId || undefined)
  }

  async function handleCloseSession(sessionId: string, tableName: string) {
    if (!window.confirm(t('orders.confirm.closeSession', { table: tableName }))) return

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('dining_sessions')
      .update({ status: 'CLOSED', closed_at: new Date().toISOString() })
      .eq('id', sessionId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(t('orders.notice.sessionClosed', { table: tableName }))
    await loadData(selectedRestaurantId || restaurantId || undefined)
  }

  async function handleSaveOrderNote(orderId: string) {
    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('orders')
      .update({ customer_note: noteDrafts[orderId]?.trim() || null })
      .eq('id', orderId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(t('orders.notice.noteUpdated'))
    await loadData(selectedRestaurantId || restaurantId || undefined)
  }

  async function handleSaveOrderLine(orderId: string, line: OrderItemRow) {
    const draft = lineDrafts[line.id]
    const quantity = Number(draft?.quantity || line.quantity)

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError(t('orders.error.quantity'))
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('order_items')
      .update({ quantity, notes: draft?.notes?.trim() || null })
      .eq('id', line.id)

    if (!updateError) {
      try {
        await refreshOrderTotals(orderId)
      } catch (refreshError) {
        setSaving(false)
        setError(refreshError instanceof Error ? refreshError.message : t('orders.error.refreshTotals'))
        return
      }
    }

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(t('orders.notice.lineUpdated'))
    await loadData(selectedRestaurantId || restaurantId || undefined)
  }

  async function handleDeleteOrderLine(orderId: string, lineId: string) {
    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: deleteError } = await supabase.from('order_items').delete().eq('id', lineId)

    if (!deleteError) {
      try {
        await refreshOrderTotals(orderId)
      } catch (refreshError) {
        setSaving(false)
        setError(refreshError instanceof Error ? refreshError.message : t('orders.error.refreshTotals'))
        return
      }
    }

    setSaving(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setNotice(t('orders.notice.lineRemoved'))
    await loadData(selectedRestaurantId || restaurantId || undefined)
  }

  async function handleAddItemToOrder(orderId: string) {
    const draft = addItemDrafts[orderId]
    const menuItem = menuOptions.find((option) => option.id === draft?.menuItemId)
    const quantity = Number(draft?.quantity || 1)

    if (!menuItem) {
      setError(t('orders.error.menuItem'))
      return
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setError(t('orders.error.addQuantity'))
      return
    }

    if (!restaurantId) {
      setError(t('orders.error.restaurantContext'))
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: insertError } = await supabase.from('order_items').insert({
      order_id: orderId,
      restaurant_id: restaurantId,
      menu_item_id: menuItem.id,
      item_name: menuItem.name,
      quantity,
      unit_price: menuItem.price,
      notes: null,
    })

    if (!insertError) {
      try {
        await refreshOrderTotals(orderId)
      } catch (refreshError) {
        setSaving(false)
        setError(refreshError instanceof Error ? refreshError.message : t('orders.error.refreshTotals'))
        return
      }
    }

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setNotice(t('orders.notice.itemAdded', { name: menuItem.name }))
    await loadData(selectedRestaurantId || restaurantId || undefined)
  }

  async function handleDeleteOrder(order: OrderRow) {
    if (!window.confirm(t('orders.confirm.deleteOrder', { id: order.id.slice(0, 8), table: getTableName(order) }))) return

    setSaving(true)
    setError(null)
    setNotice(null)

    const result = await deleteOrder(order.id)

    setSaving(false)

    if (result.error) {
      setError(result.error)
      return
    }

    setNotice(result.notice || t('orders.notice.orderDeleted'))
    await loadData(selectedRestaurantId || restaurantId || undefined)
  }

  if (loading) {
    return (
      <section className="panel stack">
        <span className="eyebrow">{t('orders.eyebrow')}</span>
        <h1 className="section-title">{t('orders.loading')}</h1>
      </section>
    )
  }

  return (
    <>
      <section className="panel stack">
        <span className="eyebrow">{t('orders.eyebrow')}</span>
        <h1 className="section-title">{t('orders.title', { restaurant: restaurantName ?? t('orders.restaurantLine', { name: '...' }) })}</h1>
        <p className="lead">{t('orders.lead')}</p>
        {restaurantOptions.length > 0 ? (
          <div className="field">
            <label htmlFor="ordersRestaurantSelector">
              {isPlatformAdmin ? t('orders.restaurantContextAdmin') : t('orders.restaurantContext')}
            </label>
            <select
              id="ordersRestaurantSelector"
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
          <div className="message" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <strong>
              {t('orders.newOrderBanner', {
                table: newOrderNotice.tableName,
                total: formatCurrency(newOrderNotice.total, newOrderNotice.currency),
              })}
            </strong>
            <button className="button-secondary" type="button" onClick={() => setNewOrderNotice(null)}>
              {t('orders.dismiss')}
            </button>
          </div>
        ) : null}
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('orders.accessEyebrow')}</span>
        <ul className="list">
          <li>{t('orders.roleGranted', { role: role ?? 'UNKNOWN' })}</li>
          <li>{t('orders.restaurantLine', { name: restaurantName ?? 'Not selected' })}</li>
          <li>{t('orders.loaded', { count: orders.length })}</li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('orders.liveEyebrow')}</span>

        <div className="stack">
          <div className="tabs-row" role="tablist" aria-label={t('orders.tabsLabel')}>
            {STATUS_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={statusTab === tab}
                className={statusTab === tab ? 'filter-tab filter-tab-active' : 'filter-tab'}
                onClick={() => setStatusTab(tab)}
                disabled={saving}
              >
                {t(`orders.tab.${tab}`)}
                <span className="badge">{tabCounts[tab] ?? 0}</span>
              </button>
            ))}
          </div>

          <div className="field" style={{ maxWidth: '320px' }}>
            <label htmlFor="ordersSortMode">{t('orders.sortLabel')}</label>
            <select
              id="ordersSortMode"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as 'created_desc' | 'created_asc' | 'status')}
              disabled={saving}
            >
              <option value="created_desc">{t('orders.sort.createdDesc')}</option>
              <option value="created_asc">{t('orders.sort.createdAsc')}</option>
              <option value="status">{t('orders.sort.status')}</option>
            </select>
          </div>
        </div>

        {orders.length === 0 ? <p className="muted">{t('orders.noOrders')}</p> : null}
        {orders.length > 0 && visibleOrders.length === 0 ? <p className="muted">{t('orders.noMatchingOrders')}</p> : null}
        <ul className="list">
          {visibleOrders.map((order) => (
            <li key={order.id} data-testid={`order-card-${order.public_tracking_token}`}>
              <div className="cart-line-header">
                <div>
                  <strong>{t('orders.orderId', { id: order.id.slice(0, 8) })}</strong>
                  <p className="muted">{t('orders.tableStatus', { table: getTableName(order), status: order.status })}</p>
                  <p className="muted">{t('orders.submitted', { datetime: formatDateTime(order.created_at) })}</p>
                  <p className="muted">{t('orders.trackToken', { token: order.public_tracking_token })}</p>
                  {order.customer_note ? <p className="muted">{t('orders.customerNoteLine', { note: order.customer_note })}</p> : null}
                </div>
                <div className="badge">{formatCurrency(order.total, order.currency)}</div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                {statusOptions.map((status) => (
                  <button
                    key={`${order.id}-${status}`}
                    className={status === order.status ? 'button' : 'button-secondary'}
                    type="button"
                    disabled={saving || status === order.status}
                    onClick={() => void handleStatusChange(order, status)}
                  >
                    {t(`status.${status}`)}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                {order.waiter_id ? (
                  <span className="badge">
                    {order.waiter_id === currentUserId
                      ? t('orders.handlingYou')
                      : t('orders.handling', { who: teamEmailMap[order.waiter_id] ?? t('orders.staffMember') })}
                  </span>
                ) : currentUserId ? (
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => void handleTakeOrder(order)}
                  >
                    {t('orders.takeOrder')}
                  </button>
                ) : null}
                {order.session_id && activeSessionIds.has(order.session_id) && role && ['OWNER', 'MANAGER', 'SUPER_ADMIN'].includes(role) ? (
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => void handleCloseSession(order.session_id!, getTableName(order))}
                  >
                    {t('orders.closeSession')}
                  </button>
                ) : null}
                {isPlatformAdmin ? (
                  <button
                    className="button-danger"
                    type="button"
                    disabled={saving}
                    onClick={() => void handleDeleteOrder(order)}
                  >
                    {t('orders.deleteOrder')}
                  </button>
                ) : null}
              </div>

              <div className="field" style={{ marginTop: '12px' }}>
                <label htmlFor={`order-note-${order.id}`}>{t('orders.customerNoteLabel')}</label>
                <textarea
                  id={`order-note-${order.id}`}
                  value={noteDrafts[order.id] ?? ''}
                  onChange={(event) => setNoteDrafts((current) => ({ ...current, [order.id]: event.target.value }))}
                />
                <button className="button-secondary" type="button" disabled={saving} onClick={() => void handleSaveOrderNote(order.id)}>
                  {t('orders.saveOrderNote')}
                </button>
              </div>

              <div className="stack" style={{ marginTop: '12px' }}>
                <span className="eyebrow">{t('orders.itemsEyebrow')}</span>
                <ul className="list">
                  {(order.order_items || []).map((line) => (
                    <li key={line.id}>
                      <div className="cart-line-header">
                        <strong>{line.item_name}</strong>
                        <span>{formatCurrency(line.unit_price * line.quantity, order.currency)}</span>
                      </div>
                      {line.modifiers && line.modifiers.length > 0 ? (
                        <p className="muted">{line.modifiers.join(' · ')}</p>
                      ) : null}
                      <div className="field">
                        <label htmlFor={`line-qty-${line.id}`}>{t('orders.quantity')}</label>
                        <input
                          id={`line-qty-${line.id}`}
                          type="number"
                          min="1"
                          step="1"
                          value={lineDrafts[line.id]?.quantity ?? String(line.quantity)}
                          onChange={(event) =>
                            setLineDrafts((current) => ({
                              ...current,
                              [line.id]: { quantity: event.target.value, notes: current[line.id]?.notes ?? line.notes ?? '' },
                            }))
                          }
                        />
                      </div>
                      <div className="field">
                        <label htmlFor={`line-notes-${line.id}`}>{t('orders.lineNote')}</label>
                        <textarea
                          id={`line-notes-${line.id}`}
                          value={lineDrafts[line.id]?.notes ?? line.notes ?? ''}
                          onChange={(event) =>
                            setLineDrafts((current) => ({
                              ...current,
                              [line.id]: { quantity: current[line.id]?.quantity ?? String(line.quantity), notes: event.target.value },
                            }))
                          }
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button className="button-secondary" type="button" disabled={saving} onClick={() => void handleSaveOrderLine(order.id, line)}>
                          {t('orders.saveLine')}
                        </button>
                        <button className="button-danger" type="button" disabled={saving} onClick={() => void handleDeleteOrderLine(order.id, line.id)}>
                          {t('orders.removeLine')}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="stack" style={{ marginTop: '12px' }}>
                <span className="eyebrow">{t('orders.addItem')}</span>
                <div className="field">
                  <label htmlFor={`order-item-${order.id}`}>{t('orders.menuItem')}</label>
                  <select
                    id={`order-item-${order.id}`}
                    value={addItemDrafts[order.id]?.menuItemId ?? ''}
                    onChange={(event) =>
                      setAddItemDrafts((current) => ({
                        ...current,
                        [order.id]: { menuItemId: event.target.value, quantity: current[order.id]?.quantity ?? '1' },
                      }))
                    }
                  >
                    {menuOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {getCategoryLabel(option)} - {option.name} ({formatCurrency(option.price, order.currency)})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor={`add-qty-${order.id}`}>{t('orders.quantity')}</label>
                  <input
                    id={`add-qty-${order.id}`}
                    type="number"
                    min="1"
                    step="1"
                    value={addItemDrafts[order.id]?.quantity ?? '1'}
                    onChange={(event) =>
                      setAddItemDrafts((current) => ({
                        ...current,
                        [order.id]: { menuItemId: current[order.id]?.menuItemId ?? menuOptions[0]?.id ?? '', quantity: event.target.value },
                      }))
                    }
                  />
                </div>
                <button className="button" type="button" disabled={saving || menuOptions.length === 0} onClick={() => void handleAddItemToOrder(order.id)}>
                  {t('orders.addItemToOrder')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
