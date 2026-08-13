'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/guards'
import type { UserRole } from '@/lib/auth/types'

const roles: UserRole[] = ['OWNER', 'MANAGER', 'STAFF']

export type TeamMember = {
  userId: string
  email: string
  role: UserRole
  createdAt: string
}

export type TeamActionResult = {
  error?: string
  members?: TeamMember[]
}

/**
 * Verifies the caller is either a SUPER_ADMIN or an OWNER of the restaurant,
 * and returns the caller's auth user.
 */
async function authorizeRestaurantManager(restaurantId: string) {
  const context = await getCurrentUserContext()
  const isOwner = context.memberships.some(
    (membership) => membership.restaurantId === restaurantId && membership.role === 'OWNER'
  )

  if (!context.isPlatformAdmin && !isOwner) {
    return null
  }

  return context.user
}

export async function listTeamMembers(restaurantId: string): Promise<TeamActionResult> {
  const caller = await authorizeRestaurantManager(restaurantId)
  if (!caller) {
    return { error: "You need OWNER access to manage this restaurant's team." }
  }

  const admin = createAdminClient()
  const { data: members, error } = await admin
    .from('restaurant_users')
    .select('user_id, role, created_at')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: true })

  if (error || !members) {
    return { error: error?.message ?? 'Unable to load team members.' }
  }

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailByUserId = new Map((users?.users || []).map((u) => [u.id, u.email]))

  return {
    members: members.map((membership) => ({
      userId: membership.user_id,
      email: emailByUserId.get(membership.user_id) ?? 'Unknown user',
      role: membership.role,
      createdAt: membership.created_at,
    })),
  }
}

export async function addTeamMember(
  restaurantId: string,
  email: string,
  role: UserRole
): Promise<TeamActionResult> {
  const caller = await authorizeRestaurantManager(restaurantId)
  if (!caller) {
    return { error: "You need OWNER access to manage this restaurant's team." }
  }

  if (!roles.includes(role)) {
    return { error: 'Invalid role.' }
  }

  const trimmedEmail = email.trim().toLowerCase()
  if (!trimmedEmail) {
    return { error: 'Email is required.' }
  }

  const admin = createAdminClient()
  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const target = (users?.users || []).find((u) => (u.email || '').toLowerCase() === trimmedEmail)

  if (!target) {
    return { error: `No account found for ${trimmedEmail}. The user must register first.` }
  }

  const { error: insertError } = await admin.from('restaurant_users').insert({
    restaurant_id: restaurantId,
    user_id: target.id,
    role,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'This user is already a member of the restaurant.' }
    }
    return { error: insertError.message }
  }

  revalidatePath('/platform/team')

  return {}
}

export async function updateTeamMemberRole(
  restaurantId: string,
  userId: string,
  role: UserRole
): Promise<TeamActionResult> {
  const caller = await authorizeRestaurantManager(restaurantId)
  if (!caller) {
    return { error: "You need OWNER access to manage this restaurant's team." }
  }

  if (!roles.includes(role)) {
    return { error: 'Invalid role.' }
  }

  const admin = createAdminClient()
  const { error } = await admin
    .from('restaurant_users')
    .update({ role })
    .eq('restaurant_id', restaurantId)
    .eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/platform/team')

  return {}
}

export async function removeTeamMember(restaurantId: string, userId: string): Promise<TeamActionResult> {
  const caller = await authorizeRestaurantManager(restaurantId)
  if (!caller) {
    return { error: "You need OWNER access to manage this restaurant's team." }
  }

  const admin = createAdminClient()

  // Never allow removing the last OWNER of a restaurant.
  const { data: owners, error: ownerError } = await admin
    .from('restaurant_users')
    .select('user_id')
    .eq('restaurant_id', restaurantId)
    .eq('role', 'OWNER')

  if (ownerError) {
    return { error: ownerError.message }
  }

  if (owners && owners.length <= 1 && owners.some((owner) => owner.user_id === userId)) {
    return { error: 'Cannot remove the last remaining owner.' }
  }

  // Never allow removing yourself.
  if (userId === caller.id) {
    return { error: 'You cannot remove your own membership.' }
  }

  const { error } = await admin.from('restaurant_users').delete().eq('restaurant_id', restaurantId).eq('user_id', userId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/platform/team')

  return {}
}
