'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { createClient } from '@/lib/supabase/client'
import { useSupabaseSubscription } from '@/lib/hooks/use-supabase-subscription'
import { initNewOrderAlertClearing, ringNewOrderAlert } from '@/lib/notifications/new-order-alert'

/**
 * The order row shape used by every live-order surface. This is the superset
 * of what the home dashboard and the Orders workspace need, fetched with one
 * shared select so both views are driven by identical data.
 */
export type LiveOrderRow = {
  id: string
  order_number: number | null
  table_id: string
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
  order_items:
    | Array<{
        id: string
        menu_item_id: string
        item_name: string
        quantity: number
        unit_price: number
        notes: string | null
        modifiers: string[]
      }>
    | null
}

export const LIVE_ORDERS_SELECT =
  'id, order_number, table_id, status, subtotal, total, currency, customer_note, public_tracking_token, restaurant_id, created_at, waiter_id, session_id, restaurant_tables(name), order_items(id, menu_item_id, item_name, quantity, unit_price, notes, modifiers)'

export const LIVE_ORDERS_LIMIT = 200

type LiveOrdersHandlers = {
  onOrderInsert?: (payload: any) => void | Promise<void>
  onOrderUpdate?: (payload: any) => void | Promise<void>
  onOrderItemChange?: (payload: any) => void | Promise<void>
  /** Translated "New order" label used for the tab-title badge. */
  alertLabel?: string
}

/**
 * Single source of truth for live orders: fetches the restaurant's orders and
 * subscribes to `orders` + `order_items` realtime changes, then refreshes the
 * list — one implementation shared by the home dashboard and the Orders
 * workspace. Component-specific UI (new-order banners, line-draft sync) goes
 * into the optional handlers, which run before the refresh.
 */
export function useLiveOrders(
  restaurantId: string | null,
  handlers: LiveOrdersHandlers = {}
) {
  const supabase = useMemo(() => createClient(), [])
  const [orders, setOrders] = useState<LiveOrderRow[]>([])
  const [initialLoading, setInitialLoading] = useState(false)
  const restaurantIdRef = useRef<string | null>(restaurantId)
  const handlersRef = useRef(handlers)

  restaurantIdRef.current = restaurantId
  handlersRef.current = handlers

  const fetchOrders = useCallback(
    async (targetRestaurantId: string) => {
      const { data, error } = await supabase
        .from('orders')
        .select(LIVE_ORDERS_SELECT)
        .eq('restaurant_id', targetRestaurantId)
        .order('created_at', { ascending: false })
        .limit(LIVE_ORDERS_LIMIT)
      if (!error && data) {
        setOrders(data as LiveOrderRow[])
      }
    },
    [supabase]
  )

  // Initial fetch + re-fetch whenever the restaurant changes.
  useEffect(() => {
    if (!restaurantId) {
      setOrders([])
      setInitialLoading(false)
      return
    }
    let cancelled = false
    setInitialLoading(true)
    void (async () => {
      await fetchOrders(restaurantId)
      if (!cancelled) {
        setInitialLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [restaurantId, fetchOrders])

  // Clear the tab-title badge the moment the tab regains focus.
  useEffect(() => initNewOrderAlertClearing(), [])

  const refreshOrders = useCallback(async () => {
    const target = restaurantIdRef.current
    if (target) {
      await fetchOrders(target)
    }
  }, [fetchOrders])

  // Safety net: if a realtime event is ever missed (socket hiccup, dropped
  // payload), re-sync the list every 30s while the tab is visible so orders
  // are never stuck stale. Idempotent — the list is replaced wholesale.
  useEffect(() => {
    if (!restaurantId) return
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshOrders()
      }
    }, 30_000)
    return () => window.clearInterval(interval)
  }, [restaurantId, refreshOrders])

  // Realtime: one subscription implementation for both surfaces. Events for
  // other restaurants are ignored, component handlers run, then the list is
  // refreshed from the server (single data path).
  useSupabaseSubscription(
    `live_orders_${restaurantId || 'init'}`,
    'orders',
    ['INSERT', 'UPDATE'],
    async (payload) => {
      const changedRestaurantId = payload?.new?.restaurant_id ?? payload?.old?.restaurant_id
      if (restaurantIdRef.current !== changedRestaurantId) {
        return
      }
      if (payload?.eventType === 'INSERT') {
        await handlersRef.current.onOrderInsert?.(payload)
        // Tab-title badge + optional chime, regardless of which page we're on.
        ringNewOrderAlert(handlersRef.current.alertLabel ?? 'New order')
      } else {
        await handlersRef.current.onOrderUpdate?.(payload)
      }
      await refreshOrders()
    },
    [restaurantId, refreshOrders]
  )

  useSupabaseSubscription(
    `live_order_items_${restaurantId || 'init'}`,
    'order_items',
    ['INSERT', 'UPDATE', 'DELETE'],
    async (payload) => {
      const itemRestaurantId = payload?.new?.restaurant_id ?? payload?.old?.restaurant_id
      if (restaurantIdRef.current !== itemRestaurantId) {
        return
      }
      await handlersRef.current.onOrderItemChange?.(payload)
      await refreshOrders()
    },
    [restaurantId, refreshOrders]
  )

  return { orders, setOrders, refreshOrders, initialLoading }
}
