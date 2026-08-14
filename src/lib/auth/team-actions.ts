'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient } from '@/lib/supabase/server'
import { getCurrentUserContext } from '@/lib/auth/guards'
import type { UserRole } from '@/lib/auth/types'
import { sendInvitationEmail } from '@/lib/notifications/email'

const roles: UserRole[] = ['OWNER', 'MANAGER', 'STAFF']

export type TeamMember = {
  userId: string
  email: string
  name: string | null
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
    .select('user_id, role, created_at, full_name')
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
      name: (membership.full_name as string | null) || null,
      role: membership.role,
      createdAt: membership.created_at,
    })),
  }
}

export async function addTeamMember(
  restaurantId: string,
  email: string,
  role: UserRole,
  fullName?: string
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

  const trimmedName = fullName?.trim() || null

  const admin = createAdminClient()

  const { data: restaurant } = await admin
    .from('restaurants')
    .select('name')
    .eq('id', restaurantId)
    .single()

  const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  let target = (users?.users || []).find((u) => (u.email || '').toLowerCase() === trimmedEmail)

  let createdNow = false
  if (!target) {
    // No prior account is required: create one, auto-confirmed, so the invited
    // staff member never needs a separate registration or confirmation email.
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: trimmedEmail,
      password: crypto.randomUUID().replace(/-/g, '').slice(0, 20),
      email_confirm: true,
      user_metadata: trimmedName ? { full_name: trimmedName } : undefined,
    })

    if (createError || !created?.user) {
      return { error: createError?.message ?? 'Unable to create the account for this email.' }
    }

    target = created.user
    createdNow = true
  }

  let { error: insertError } = await admin.from('restaurant_users').insert({
    restaurant_id: restaurantId,
    user_id: target.id,
    role,
    full_name: trimmedName,
  })
  if (insertError?.code === '42703') {
    // `full_name` column not migrated yet — insert without it.
    const retry = await admin.from('restaurant_users').insert({
      restaurant_id: restaurantId,
      user_id: target.id,
      role,
    })
    insertError = retry.error
  }

  if (insertError) {
    if (insertError.code === '23505') {
      return { error: 'This user is already a member of the restaurant.' }
    }
    return { error: insertError.message }
  }

  // Send an invitation with a "set your password" link so the staff member can
  // sign in. Resend is primary; Supabase's built-in "Reset Password" email is
  // the fallback when Resend is not configured.
  if (createdNow) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const { data: linkData } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email: trimmedEmail,
      options: { redirectTo: `${appUrl}/auth/callback?next=/reset-password` },
    })
    const actionLink = linkData?.properties?.action_link

    if (actionLink) {
      const sent = await sendInvitationEmail({
        email: trimmedEmail,
        restaurantName: restaurant?.name ?? 'your restaurant',
        setPasswordUrl: actionLink,
      })
      if (!sent) {
        // Fallback: Supabase's built-in "Reset Password" template email.
        // (The GoTrue admin API supports type: 'recovery' even though the
        // client types only expose the narrower union.)
        await admin.auth
          .resend({ type: 'recovery' as 'signup', email: trimmedEmail })
          .catch(() => undefined)
      }
    }
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
