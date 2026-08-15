'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { getClientUserContext } from '@/lib/auth/client'
import { listTeamMembers } from '@/lib/auth/team-actions'
import { deleteOrder } from '@/lib/admin/data-actions'
import { createClient } from '@/lib/supabase/client'
import { useLiveOrders } from '@/lib/hooks/use-live-orders'
import { LoadingBar } from '@/components/app/loading-bar'
import { useLanguage } from '@/components/app/language-provider'
import {
  acknowledgeNewOrder,
  clearPendingNewOrders,
  isNewOrderSoundEnabled,
  playNewOrderSound,
  setNewOrderSoundEnabled,
} from '@/lib/notifications/new-order-alert'
import { HISTORY_STATUSES, HISTORY_TABS, OPEN_STATUSES, STATUS_OPTIONS, STATUS_PRIORITY, STATUS_TABS } from '@/lib/orders/status'

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
  order_number: number | null
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

function getOrderLabel(order: OrderRow) {
  return order.order_number != null ? String(order.order_number) : order.id.slice(0, 8)
}

function orderMatchesTab(order: OrderRow, tab: string) {
  // "ALL" means all LIVE (open) orders — terminal orders live in history.
  if (tab === 'ALL') return OPEN_STATUSES.includes(order.status)
  return order.status === tab
}

function historyMatchesTab(order: OrderRow, tab: string) {
  if (tab === 'ALL') return HISTORY_STATUSES.includes(order.status)
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
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

// Compact "time since submission" (e.g. "12m", "2h 05m", "now") so waiters can
// spot waiting orders at a glance.
function formatTimeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60_000))
  if (minutes < 1) return 'now'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${String(minutes % 60).padStart(2, '0')}m`
}

export function OrdersConsole() {
  const supabase = useMemo(() => createClient(), [])
  const searchParams = useSearchParams()
  const { t, lang } = useLanguage()
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
  const [statusTab, setStatusTab] = useState<string>('ALL')
  const [sortMode, setSortMode] = useState<'created_desc' | 'created_asc' | 'status'>('created_desc')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyTab, setHistoryTab] = useState<string>('ALL')
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null)
  const [menuOptions, setMenuOptions] = useState<MenuOption[]>([])
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [lineDrafts, setLineDrafts] = useState<Record<string, LineDraft>>({})
  const [addItemDrafts, setAddItemDrafts] = useState<Record<string, AddItemDraft>>({})
  const [addItemSearch, setAddItemSearch] = useState<Record<string, string>>({})
  const [expandedCustomerNote, setExpandedCustomerNote] = useState<Record<string, boolean>>({})
  const [expandedLineNote, setExpandedLineNote] = useState<Record<string, boolean>>({})
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [teamEmailMap, setTeamEmailMap] = useState<Record<string, string>>({})
  const [teamNameMap, setTeamNameMap] = useState<Record<string, string>>({})
  const [activeSessionIds, setActiveSessionIds] = useState<Set<string>>(new Set())
  const [newOrderNotice, setNewOrderNotice] = useState<{
    orderId: string
    tableName: string
    total: number
    currency: string
  } | null>(null)
  const activeRestaurantIdRef = useRef<string | null>(null)
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return isNewOrderSoundEnabled()
  })
  const [showBackToTop, setShowBackToTop] = useState(false)

  // Floating "back to top" appears once the order list has been scrolled.
  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Shared live-orders data layer (fetch + realtime refresh) — the same
  // implementation the home dashboard uses. Realtime events run the handlers
  // below (banner, line-draft sync), then the list refreshes from the server.
  const { orders, refreshOrders, initialLoading } = useLiveOrders(restaurantId, {
    onOrderInsert: handleOrderInsert,
    onOrderItemChange: handleOrderItemChange,
    alertLabel: t('notify.tabTitle'),
  })

  // Initialize line/note/add-item drafts once per restaurant, after the shared
  // orders fetch has loaded. Realtime refreshes never re-run this, so
  // in-progress edits are preserved.
  const draftsLoadedForRef = useRef<string | null>(null)
  useEffect(() => {
    if (initialLoading) return
    if (draftsLoadedForRef.current === restaurantId) return
    draftsLoadedForRef.current = restaurantId

    setNoteDrafts(Object.fromEntries(orders.map((order) => [order.id, order.customer_note || ''])))
    setLineDrafts(
      Object.fromEntries(
        orders.flatMap((order) =>
          ((order.order_items || []) as OrderItemRow[]).map((item) => [
            item.id,
            { quantity: String(item.quantity), notes: item.notes || '' },
          ])
        )
      )
    )
    setAddItemDrafts((current) => {
      const defaults = Object.fromEntries(
        orders.map((order) => [
          order.id,
          current[order.id] || { menuItemId: menuOptions[0]?.id || '', quantity: '1' },
        ])
      )
      return defaults
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialLoading, orders, restaurantId])

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

    const [menuResult, teamResult, sessionResult] = await Promise.all([
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
    setTeamNameMap(
      Object.fromEntries(
        (teamResult && teamResult.members ? teamResult.members : []).map((member) => [member.userId, member.name || member.email])
      )
    )

    if (menuResult.error) {
      setError(menuResult.error.message || t('orders.error.loadFailed'))
      setLoading(false)
      return
    }

    setMenuOptions((menuResult.data as MenuOption[]) || [])
    activeRestaurantIdRef.current = activeRestaurantId
    setLoading(false)
  }

  const tabCounts = useMemo(() => {
    const live = orders.filter((order) => OPEN_STATUSES.includes(order.status))
    const counts: Record<string, number> = { ALL: live.length }
    for (const tab of STATUS_TABS) {
      if (tab === 'ALL') continue
      counts[tab] = live.filter((order) => order.status === tab).length
    }
    return counts
  }, [orders])

  const visibleOrders = useMemo(() => {
    const filtered = orders.filter(
      (order) => OPEN_STATUSES.includes(order.status) && orderMatchesTab(order, statusTab)
    )
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

  // Terminal orders (SERVED / CANCELLED / REJECTED) belong to Order history,
  // newest first, optionally filtered by status.
  const historyOrders = useMemo(() => {
    const filtered = orders.filter(
      (order) => HISTORY_STATUSES.includes(order.status) && historyMatchesTab(order, historyTab)
    )
    return [...filtered].sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [orders, historyTab])

  const historyTotal = useMemo(
    () => orders.filter((order) => HISTORY_STATUSES.includes(order.status)).length,
    [orders]
  )

  const historyTabCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: historyTotal }
    for (const tab of HISTORY_TABS) {
      if (tab === 'ALL') continue
      counts[tab] = orders.filter((order) => order.status === tab).length
    }
    return counts
  }, [orders, historyTotal])

  // Handle real-time new orders: show an in-app banner and fire a best-effort
  // browser notification when permission is already granted. The shared hook
  // refreshes the order list itself.
  async function handleOrderInsert(payload: any) {
    const inserted = payload.new as { id: string; restaurant_id: string }
    if (activeRestaurantIdRef.current !== inserted.restaurant_id) {
      return // Ignore orders for other restaurants
    }

    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, order_number, status, subtotal, total, currency, customer_note, public_tracking_token, restaurant_id, created_at, waiter_id, session_id, restaurant_tables(name), order_items(id, menu_item_id, item_name, quantity, unit_price, notes, modifiers)')
      .eq('id', inserted.id)
      .maybeSingle()

    if (orderError || !orderData) {
      return
    }

    const order = orderData as OrderRow
    setNewOrderNotice({
      orderId: order.id,
      tableName: getTableName(order),
      total: order.total,
      currency: order.currency,
    })
    // The order is already visible in this workspace — drop it from the
    // unacknowledged list so the nav badge/tab title don't keep counting it.
    acknowledgeNewOrder(order.id)

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

  // Auto-dismiss the new-order banner after a few seconds.
  useEffect(() => {
    if (!newOrderNotice) {
      return
    }
    const timer = setTimeout(() => setNewOrderNotice(null), 6000)
    return () => clearTimeout(timer)
  }, [newOrderNotice])

  // Handle real-time order item changes: reload the affected order so the
  // line drafts (quantity/notes inputs) stay in sync with the server. The
  // shared hook refreshes the order list itself.
  async function handleOrderItemChange(payload: any) {
    const { new: newItem, old: oldItem } = payload
    const itemRestaurantId = payload.new?.restaurant_id ?? payload.old?.restaurant_id

    if (activeRestaurantIdRef.current !== itemRestaurantId) {
      return // Ignore updates for other restaurants
    }

    // When items change, reload the affected order to get updated totals
    const affectedOrderId = (newItem ?? oldItem)?.order_id
    if (affectedOrderId) {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, status, subtotal, total, currency, customer_note, public_tracking_token, restaurant_id, created_at, restaurant_tables(name), order_items(id, menu_item_id, item_name, quantity, unit_price, notes)')
        .eq('id', affectedOrderId)
        .maybeSingle()

      if (!orderError && orderData) {
        const updatedOrder = orderData as OrderRow

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

  // Entering the Orders workspace counts as "seen": reset the pending
  // notification list (nav badge + tab title + home lines).
  useEffect(() => {
    clearPendingNewOrders()
  }, [restaurantId])

  // Deep-link support: when the home dashboard sends ?focus=<trackingToken>,
  // always land on the exact order card. Force the "All" tab + newest-first
  // sort so the card is never hidden, then scroll to and highlight it.
  const focusToken = searchParams.get('focus')
  const focusedOnceRef = useRef<string | null>(null)

  useEffect(() => {
    if (focusToken) {
      setStatusTab('ALL')
      setSortMode('created_desc')
    }
  }, [focusToken])

  useEffect(() => {
    if (!focusToken || orders.length === 0 || focusedOnceRef.current === focusToken) return
    let attempts = 0

    const attempt = () => {
      const card = document.querySelector(`[data-testid="order-card-${focusToken}"]`)
      if (card) {
        focusedOnceRef.current = focusToken
        card.scrollIntoView({ behavior: 'smooth', block: 'center' })
        card.classList.add('focus-flash')
        window.setTimeout(() => card.classList.remove('focus-flash'), 4000)
        return
      }
      attempts += 1
      if (attempts < 12) {
        window.setTimeout(attempt, 250)
      }
    }

    attempt()
  }, [focusToken, orders])

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

    setNotice(t('orders.notice.statusChanged', { id: getOrderLabel(order), status: nextStatus }))
    await refreshOrders()
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

    setNotice(t('orders.notice.taken', { id: getOrderLabel(order) }))
    await refreshOrders()
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

    if (!updateError) {
      // Closing a table completes its still-open orders: mark them SERVED so
      // they leave "Live orders" and move to "Order history".
      const { data: openOrders, error: openError } = await supabase
        .from('orders')
        .select('id, status')
        .eq('session_id', sessionId)
        .in('status', OPEN_STATUSES)

      if (!openError && openOrders && openOrders.length > 0) {
        const { error: completeError } = await supabase
          .from('orders')
          .update({ status: 'SERVED' })
          .eq('session_id', sessionId)
          .in('status', OPEN_STATUSES)

        if (!completeError) {
          await supabase.from('order_status_history').insert(
            (openOrders as Array<{ id: string; status: string }>).map((order) => ({
              order_id: order.id,
              old_status: order.status,
              new_status: 'SERVED',
            }))
          )
        }
      }
    }

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
    await refreshOrders()
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
    await refreshOrders()
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
    await refreshOrders()
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
    await refreshOrders()
  }

  async function handleDeleteOrder(order: OrderRow) {
    if (!window.confirm(t('orders.confirm.deleteOrder', { id: getOrderLabel(order), table: getTableName(order) }))) return

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
    await refreshOrders()
  }

  if (loading || initialLoading) {
    return (
      <section className="panel stack">
        <LoadingBar />
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

          <button
            className="button-secondary button-sm"
            type="button"
            aria-pressed={soundEnabled}
            title={t('notify.soundToggle', { state: soundEnabled ? t('notify.soundOn') : t('notify.soundOff') })}
            onClick={() => {
              const next = !soundEnabled
              setSoundEnabled(next)
              setNewOrderSoundEnabled(next)
            }}
          >
            {soundEnabled ? '🔔' : '🔕'}{' '}
            {t('notify.soundToggle', { state: soundEnabled ? t('notify.soundOn') : t('notify.soundOff') })}
          </button>

          <button className="button-secondary button-sm" type="button" onClick={() => playNewOrderSound()}>
            🔊 {t('notify.testSound')}
          </button>
        </div>

        {orders.length === 0 ? <p className="muted">{t('orders.noOrders')}</p> : null}
        {orders.length > 0 && visibleOrders.length === 0 ? <p className="muted">{t('orders.noMatchingOrders')}</p> : null}
        <ul className="list">
          {visibleOrders.map((order) => (
            <li key={order.id} data-testid={`order-card-${order.public_tracking_token}`}>
              <div className="cart-line-header">
                <div>
                  <strong>{t('orders.orderId', { id: getOrderLabel(order) })}</strong>
                  <p className="muted">{t('orders.tableStatus', { table: getTableName(order), status: lang === 'el' ? t(`statusLabel.${order.status}`) : order.status })}</p>
                  <p className="muted">
                    {t('orders.timeAgo', { time: formatTimeAgo(order.created_at) })} ·{' '}
                    {t('orders.submitted', { datetime: formatDateTime(order.created_at) })}
                  </p>
                  {order.customer_note ? <p className="muted">{t('orders.customerNoteLine', { note: order.customer_note })}</p> : null}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {!order.waiter_id && currentUserId ? (
                    <button
                      className="button"
                      type="button"
                      disabled={saving}
                      onClick={() => void handleTakeOrder(order)}
                    >
                      {t('orders.takeOrder')}
                    </button>
                  ) : null}
                  <span className="badge">{t(`status.${order.status}`)}</span>
                  <span className="badge">{formatCurrency(order.total, order.currency)}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                {STATUS_OPTIONS.map((status) => (
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
                      : t('orders.handling', { who: teamNameMap[order.waiter_id] ?? t('orders.staffMember') })}
                  </span>
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

              {order.customer_note || expandedCustomerNote[order.id] ? (
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
              ) : (
                <div style={{ marginTop: '12px' }}>
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={saving}
                    onClick={() => setExpandedCustomerNote((current) => ({ ...current, [order.id]: true }))}
                  >
                    {t('orders.addCustomerNote')}
                  </button>
                </div>
              )}

              <div className="stack" style={{ marginTop: '12px' }}>
                <span className="eyebrow">{t('orders.itemsEyebrow')}</span>
                <ul className="list order-lines">
                  {(order.order_items || []).map((line) => (
                    <li key={line.id} className="order-line">
                      <div className="order-line-top">
                        <span className="order-line-name">
                          <strong>
                            {lineDrafts[line.id]?.quantity ?? line.quantity} × {line.item_name}
                          </strong>
                          {line.modifiers && line.modifiers.length > 0 ? (
                            <span className="muted">{line.modifiers.join(' · ')}</span>
                          ) : null}
                        </span>
                        <span className="order-line-total">
                          {formatCurrency(line.unit_price * line.quantity, order.currency)}
                        </span>
                      </div>
                      <div className="order-line-controls">
                        <input
                          className="input-sm"
                          id={`line-qty-${line.id}`}
                          aria-label={t('orders.quantity')}
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
                        {line.notes || expandedLineNote[line.id] ? (
                          <input
                            className="input-sm order-line-note"
                            aria-label={t('orders.lineNote')}
                            type="text"
                            value={lineDrafts[line.id]?.notes ?? line.notes ?? ''}
                            onChange={(event) =>
                              setLineDrafts((current) => ({
                                ...current,
                                [line.id]: { quantity: current[line.id]?.quantity ?? String(line.quantity), notes: event.target.value },
                              }))
                            }
                          />
                        ) : (
                          <button
                            className="button-tertiary button-sm"
                            type="button"
                            disabled={saving}
                            onClick={() => setExpandedLineNote((current) => ({ ...current, [line.id]: true }))}
                          >
                            {t('orders.addLineNote')}
                          </button>
                        )}
                        <span className="order-line-actions">
                          <button className="button-secondary button-sm" type="button" disabled={saving} onClick={() => void handleSaveOrderLine(order.id, line)}>
                            {t('orders.saveLine')}
                          </button>
                          <button className="button-danger button-sm" type="button" disabled={saving} onClick={() => void handleDeleteOrderLine(order.id, line.id)}>
                            {t('orders.removeLine')}
                          </button>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="stack" style={{ marginTop: '12px' }}>
                <span className="eyebrow">{t('orders.addItem')}</span>
                <div className="field">
                  <label htmlFor={`order-item-search-${order.id}`}>{t('orders.menuItemSearch')}</label>
                  <input
                    id={`order-item-search-${order.id}`}
                    type="text"
                    value={addItemSearch[order.id] ?? ''}
                    placeholder={t('orders.menuItemSearchPlaceholder')}
                    onChange={(event) => {
                      const value = event.target.value
                      setAddItemSearch((current) => ({ ...current, [order.id]: value }))
                      setAddItemDrafts((current) => ({
                        ...current,
                        [order.id]: { menuItemId: '', quantity: current[order.id]?.quantity ?? '1' },
                      }))
                    }}
                  />
                </div>
                {(() => {
                  const searchTerm = (addItemSearch[order.id] ?? '').trim().toLowerCase()
                  if (!searchTerm) return null
                  const matches = menuOptions
                    .filter(
                      (option) =>
                        option.name.toLowerCase().includes(searchTerm) ||
                        (getCategoryLabel(option) || '').toLowerCase().includes(searchTerm)
                    )
                    .slice(0, 8)
                  if (matches.length === 0) {
                    return <p className="muted">{t('orders.noMatchingItems')}</p>
                  }
                  return (
                    <ul className="list">
                      {matches.map((option) => (
                        <li key={option.id}>
                          <button
                            className="button-secondary"
                            type="button"
                            style={{ width: '100%', justifyContent: 'space-between' }}
                            onClick={() => {
                              setAddItemSearch((current) => ({ ...current, [order.id]: '' }))
                              setAddItemDrafts((current) => ({
                                ...current,
                                [order.id]: { menuItemId: option.id, quantity: current[order.id]?.quantity ?? '1' },
                              }))
                            }}
                          >
                            <span>
                              {getCategoryLabel(option)} - {option.name}
                            </span>
                            <span>{formatCurrency(option.price, order.currency)}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                })()}
                {addItemDrafts[order.id]?.menuItemId ? (
                  <p className="muted">
                    {t('orders.selectedItem')}:{' '}
                    {(() => {
                      const selected = menuOptions.find(
                        (option) => option.id === addItemDrafts[order.id]?.menuItemId
                      )
                      return selected ? `${getCategoryLabel(selected)} - ${selected.name}` : ''
                    })()}
                  </p>
                ) : null}
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
                        [order.id]: {
                          menuItemId: current[order.id]?.menuItemId ?? '',
                          quantity: event.target.value,
                        },
                      }))
                    }
                  />
                </div>
                <button
                  className="button"
                  type="button"
                  disabled={saving || !addItemDrafts[order.id]?.menuItemId}
                  onClick={() => void handleAddItemToOrder(order.id)}
                >
                  {t('orders.addItemToOrder')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack" data-testid="order-history-panel">
        <div className="cart-line-header">
          <span className="eyebrow">{t('orders.historyEyebrow')}</span>
          <button
            className="button-secondary button-sm"
            type="button"
            aria-label={historyOpen ? t('orders.historyCollapse') : t('orders.historyExpand')}
            onClick={() => setHistoryOpen((current) => !current)}
          >
            {historyOpen ? t('orders.historyCollapse') : t('orders.historyExpand')}
            <span className="badge">{historyTotal}</span>
          </button>
        </div>

        {historyOpen ? (
          <>
            <div className="tabs-row" role="tablist" aria-label={t('orders.historyTabsLabel')}>
              {HISTORY_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={historyTab === tab}
                  className={historyTab === tab ? 'filter-tab filter-tab-active' : 'filter-tab'}
                  onClick={() => setHistoryTab(tab)}
                  disabled={saving}
                >
                  {t(`orders.tab.${tab}`)}
                  <span className="badge">{historyTabCounts[tab] ?? 0}</span>
                </button>
              ))}
            </div>

            {historyOrders.length === 0 ? (
              <p className="muted">{t('orders.historyEmpty')}</p>
            ) : (
              <ul className="list">
                {historyOrders.map((order) => {
                  const expanded = expandedHistoryId === order.id
                  return (
                    <li key={order.id}>
                      <div className="cart-line-header">
                        <div>
                          <strong>{t('orders.orderId', { id: getOrderLabel(order) })}</strong>
                          <p className="muted">
                            {t('orders.tableStatus', {
                              table: getTableName(order),
                              status: lang === 'el' ? t(`statusLabel.${order.status}`) : order.status,
                            })}{' '}
                            · {t('orders.submitted', { datetime: formatDateTime(order.created_at) })}
                          </p>
                          {order.customer_note ? (
                            <p className="muted">{t('orders.customerNoteLine', { note: order.customer_note })}</p>
                          ) : null}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span className="badge">{t(`status.${order.status}`)}</span>
                          <span className="badge">{formatCurrency(order.total, order.currency)}</span>
                          <button
                            className="button-secondary button-sm"
                            type="button"
                            onClick={() => setExpandedHistoryId(expanded ? null : order.id)}
                          >
                            {expanded ? t('home.hideSummary') : t('home.viewSummary')}
                          </button>
                        </div>
                      </div>
                      {expanded ? (
                        <div className="stack" style={{ marginTop: '12px' }}>
                          <ul className="list">
                            {(order.order_items || []).map((line) => (
                              <li key={line.id}>
                                <div className="cart-line-header">
                                  <strong>
                                    {line.quantity} × {line.item_name}
                                  </strong>
                                  <span>{formatCurrency(line.unit_price * line.quantity, order.currency)}</span>
                                </div>
                                {line.modifiers && line.modifiers.length > 0 ? (
                                  <p className="muted">{line.modifiers.join(' · ')}</p>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                          <div className="cart-line-header">
                            <strong>{t('common.total')}</strong>
                            <strong>{formatCurrency(order.total, order.currency)}</strong>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        ) : null}
      </section>

      {showBackToTop ? (
        <button
          className="up-float"
          type="button"
          aria-label={t('common.backToTop')}
          title={t('common.backToTop')}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          ↑
        </button>
      ) : null}
    </>
  )
}
