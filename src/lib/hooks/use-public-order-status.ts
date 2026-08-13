'use client'

import { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'

export type PublicOrderStatusPayload = {
  orderId: string
  status: string
  timestamp: string
}

const MAX_RETRIES = 5
const INITIAL_RETRY_MS = 1_000
const MAX_RETRY_MS = 15_000

/**
 * Subscribes public customers to a broadcast channel for instant order status
 * updates. No authentication is required to listen — broadcasting is gated
 * server-side by Realtime Authorization (see migration 007).
 *
 * Includes reconnection/retry logic with exponential backoff. On channel
 * errors/closes the hook re-subscribes (up to MAX_RETRIES). The customer
 * tracking page keeps its 5-second polling as a reliable fallback.
 */
export function usePublicOrderStatus(
  orderId: string,
  onStatusUpdate: (payload: PublicOrderStatusPayload) => void
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const handlerRef = useRef(onStatusUpdate)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  handlerRef.current = onStatusUpdate

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    let retries = 0

    const cleanupChannel = () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }

    const scheduleRetry = () => {
      if (cancelled || retries >= MAX_RETRIES) {
        return
      }

      retries += 1
      const delay = Math.min(INITIAL_RETRY_MS * 2 ** (retries - 1), MAX_RETRY_MS)

      timeoutRef.current = setTimeout(() => {
        if (cancelled) {
          return
        }
        subscribe()
      }, delay)
    }

    const subscribe = () => {
      cleanupChannel()

      const channel = supabase
        .channel(`public-order-status-${orderId}`)
        .on('broadcast', { event: 'order-status-update' }, (payload) => {
          const data = payload.payload as PublicOrderStatusPayload
          if (data?.orderId === orderId && data?.status) {
            handlerRef.current(data)
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            retries = 0
          } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
            console.warn(
              `[Real-time] Public status channel ${status.toLowerCase()} for order ${orderId.slice(0, 8)}; retrying.`
            )
            scheduleRetry()
          }
        })

      channelRef.current = channel
    }

    subscribe()

    return () => {
      cancelled = true
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      cleanupChannel()
    }
  }, [orderId])
}