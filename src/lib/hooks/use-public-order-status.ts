'use client'

import { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'

export type PublicOrderStatusPayload = {
  orderId: string
  status: string
  timestamp: string
}

/**
 * Subscribes public customers to a broadcast channel for instant order status
 * updates. No authentication is required to listen — broadcasting is gated
 * server-side by Realtime Authorization (see migration 007).
 *
 * This is an enhancement layer; the customer tracking page keeps its 5-second
 * polling as a reliable fallback.
 */
export function usePublicOrderStatus(
  orderId: string,
  onStatusUpdate: (payload: PublicOrderStatusPayload) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const handlerRef = useRef(onStatusUpdate)

  handlerRef.current = onStatusUpdate

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`public-order-status-${orderId}`)
      .on('broadcast', { event: 'order-status-update' }, (payload) => {
        const data = payload.payload as PublicOrderStatusPayload
        if (data?.orderId === orderId && data?.status) {
          handlerRef.current(data)
        }
      })
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn(`[Real-time] Public status channel error for order ${orderId.slice(0, 8)}; polling fallback active.`)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, [orderId])
}