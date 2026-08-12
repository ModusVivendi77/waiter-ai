'use client'

import type { User } from '@supabase/supabase-js'

import type { RestaurantMembership } from '@/lib/auth/types'
import { createClient } from '@/lib/supabase/client'

type RawMembership = {
  restaurant_id: string
  role: RestaurantMembership['role']
  restaurants:
    | {
        name: string
        slug: string
      }
    | Array<{
        name: string
        slug: string
      }>
    | null
}

export type ClientUserContext = {
  user: User | null
  isPlatformAdmin: boolean
  memberships: RestaurantMembership[]
  error: string | null
}

export async function getClientUserContext(): Promise<ClientUserContext> {
  const supabase = createClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return {
      user: null,
      isPlatformAdmin: false,
      memberships: [],
      error: userError?.message ?? 'Auth session missing!',
    }
  }

  const { data: adminRow, error: adminError } = await supabase
    .from('platform_admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const isPlatformAdmin = Boolean(adminRow) && !adminError

  const { data, error: membershipError } = await supabase
    .from('restaurant_users')
    .select('restaurant_id, role, restaurants(name, slug)')
    .eq('user_id', user.id)

  if (membershipError || !data) {
    return {
      user,
      isPlatformAdmin,
      memberships: [],
      error: membershipError?.message ?? null,
    }
  }

  const memberships = (data as RawMembership[])
    .filter((membership) => membership.restaurants)
    .map((membership) => {
      const restaurant = Array.isArray(membership.restaurants)
        ? membership.restaurants[0]
        : membership.restaurants

      return {
        restaurantId: membership.restaurant_id,
        restaurantName: restaurant?.name ?? 'Unknown restaurant',
        restaurantSlug: restaurant?.slug ?? '',
        role: membership.role,
      }
    })

  return {
    user,
    isPlatformAdmin,
    memberships,
    error: null,
  }
}
