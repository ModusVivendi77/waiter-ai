'use client'

import { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'

type SubscriptionHandler = (payload: any) => void | Promise<void>

const MAX_RETRIES = 5
const INITIAL_RETRY_MS = 1_000
const MAX_RETRY_MS = 15_000

export function useSupabaseSubscription(
  channelName: string,
  tableName: string,
  events: ('*' | 'INSERT' | 'UPDATE' | 'DELETE')[],
  onPayload: SubscriptionHandler,
  dependencies: any[] = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handlerRef = useRef(onPayload)

  handlerRef.current = onPayload

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

      // Register one postgres_changes listener per event. Supabase Realtime
      // does not match comma-joined event strings (e.g. 'INSERT,UPDATE'), so
      // multi-event subscriptions must bind each event separately.
      let channel = supabase.channel(channelName)
      for (const event of events) {
        channel = channel.on(
          'postgres_changes',
          { event, schema: 'public', table: tableName },
          (payload) => {
            void handlerRef.current(payload)
          }
        )
      }
      channel = channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Real-time] Subscribed to ${channelName}`)
          retries = 0
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          console.warn(`[Real-time] Channel ${status.toLowerCase()} for ${channelName}; retrying.`)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
