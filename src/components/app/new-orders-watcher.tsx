'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import { createClient } from '@/lib/supabase/client'
import { recordNewOrder } from '@/lib/notifications/new-order-alert'
import { useLanguage } from '@/components/app/language-provider'

/**
 * Platform-wide "new order" watcher.
 *
 * Home and Orders already mount `useLiveOrders`, which reports new orders to
 * the notification store (nav badge, tab title, chime, home lines) on both
 * realtime events AND a 15s poll fallback. On every other logged-in platform
 * page (Team, Settings, Analytics, Admin, …) no such hook runs, so this
 * component subscribes to `orders` INSERTs for the user's restaurants and
 * records them the same way — the badge appears no matter which tab the
 * staff member is on.
 */
export function NewOrdersWatcher() {
  const pathname = usePathname()
  const { t } = useLanguage()

  useEffect(() => {
    // Public surfaces and the two pages with their own live-orders hooks are
    // already covered.
    if (
      pathname.startsWith('/t/') ||
      pathname.startsWith('/orders/') ||
      pathname.startsWith('/login') ||
      pathname.startsWith('/platform/signup') ||
      pathname.startsWith('/platform') === false ||
      pathname === '/platform' ||
      pathname.startsWith('/platform/orders')
    ) {
      return
    }

    let cancelled = false
    let supabase: ReturnType<typeof createClient> | null = null

    void (async () => {
      const context = await getClientUserContext()
      if (cancelled || !context.user) return

      const membershipIds = (context.memberships || []).map((membership) => membership.restaurantId)
      if (membershipIds.length === 0) return

      supabase = createClient()
      const channel = supabase
        .channel('new-orders-watcher')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'orders',
            filter: `restaurant_id=in.(${membershipIds.join(',')})`,
          },
          (payload) => {
            const inserted = payload.new as
              | { id?: string; restaurant_id?: string }
              | undefined
            if (!inserted?.id) return
            // Resolve table name + totals for the notification line, then record.
            void (async () => {
              if (!supabase) return
              const { data: order } = await supabase
                .from('orders')
                .select(
                  'id, order_number, total, currency, restaurant_tables(name)'
                )
                .eq('id', inserted.id)
                .maybeSingle()
              if (!order || cancelled) return
              const table = Array.isArray(order.restaurant_tables)
                ? order.restaurant_tables[0]
                : order.restaurant_tables
              recordNewOrder(
                {
                  orderId: order.id,
                  orderNumber: order.order_number,
                  tableName: table?.name ?? 'Unknown table',
                  total: order.total,
                  currency: order.currency,
                },
                t('notify.tabTitle')
              )
            })()
          }
        )
        .subscribe()

      return () => {
        void channel.unsubscribe()
      }
    })()

    return () => {
      cancelled = true
      if (supabase) {
        supabase.removeAllChannels()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
