'use client'

import { RealtimeChannel } from '@supabase/supabase-js'
import { useEffect, useRef } from 'react'

import { createClient } from '@/lib/supabase/client'

type SubscriptionHandler = (payload: any) => void | Promise<void>

export function useSupabaseSubscription(
  channelName: string,
  tableName: string,
  events: ('*' | 'INSERT' | 'UPDATE' | 'DELETE')[],
  onPayload: SubscriptionHandler,
  dependencies: any[] = []
) {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: events.join(',') as any, schema: 'public', table: tableName }, (payload) => {
        void onPayload(payload)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[Real-time] Subscribed to ${channelName}`)
        } else if (status === 'CHANNEL_ERROR') {
          console.error(`[Real-time] Channel error for ${channelName}`)
        }
      })

    channelRef.current = channel

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
    }
  }, dependencies)
}
