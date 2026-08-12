'use client'

import { createBrowserClient } from '@supabase/ssr'

import { normalizeSupabaseUrl } from '@/lib/supabase/config'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables are missing.')
  }

  return createBrowserClient(normalizeSupabaseUrl(url), anonKey)
}
