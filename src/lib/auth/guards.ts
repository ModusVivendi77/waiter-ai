import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import type { RestaurantMembership, UserRole } from '@/lib/auth/types'

type RawMembership = {
  restaurant_id: string
  role: UserRole
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

export async function requireUser() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return user
}

export async function getMemberships(userId: string): Promise<RestaurantMembership[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('restaurant_users')
    .select('restaurant_id, role, restaurants(name, slug)')
    .eq('user_id', userId)

  if (error || !data) {
    return []
  }

  return (data as RawMembership[])
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
}

export async function isPlatformAdmin(userId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('platform_admin_users')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return false
  }

  return Boolean(data)
}

export async function getCurrentUserContext() {
  const user = await requireUser()
  const platformAdmin = await isPlatformAdmin(user.id)
  const memberships = await getMemberships(user.id)

  return {
    user,
    isPlatformAdmin: platformAdmin,
    memberships,
    primaryMembership: memberships[0] ?? null,
  }
}

export async function requireRole(allowedRoles: UserRole[]) {
  const context = await getCurrentUserContext()

  if (context.isPlatformAdmin) {
    return {
      ...context,
      membership: context.primaryMembership,
    }
  }

  const allowedMembership = context.memberships.find((membership) => allowedRoles.includes(membership.role))

  if (!allowedMembership) {
    redirect('/platform?error=insufficient-role')
  }

  return {
    ...context,
    membership: allowedMembership,
  }
}

export async function requirePlatformAdmin() {
  const context = await getCurrentUserContext()

  if (!context.isPlatformAdmin) {
    redirect('/platform?error=insufficient-role')
  }

  return context
}
