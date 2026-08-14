'use server'

import { revalidatePath } from 'next/cache'

import { createAdminClient, createClient } from '@/lib/supabase/server'

/**
 * Server-side guard: only SUPER_ADMIN (platform_admin_users) accounts may run
 * these destructive operations. Deletion happens through the service-role
 * client so it is never blocked by RLS, and the caller check runs with the
 * real session client.
 */
async function isCallerPlatformAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  const { data } = await supabase
    .from('platform_admin_users')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle()

  return Boolean(data)
}

export type DataActionResult = {
  error?: string
  notice?: string
  deletedCount?: number
}

/**
 * Deletes orders. `restaurantId` can be empty to cover every restaurant.
 * When `olderThanDays > 0` only orders created before that cutoff are removed.
 * Deleting an order cascades to its line items and status history.
 */
export async function deleteOrders(restaurantId: string, olderThanDays?: number): Promise<DataActionResult> {
  if (!(await isCallerPlatformAdmin())) {
    return { error: 'You need SUPER_ADMIN access to delete platform data.' }
  }

  const days =
    olderThanDays && Number.isFinite(olderThanDays) && olderThanDays > 0 ? Math.floor(olderThanDays) : 0

  let query = createAdminClient().from('orders').delete().select('id')

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId)
  }

  if (days > 0) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
    query = query.lt('created_at', cutoff)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/platform/orders')
  revalidatePath('/admin')

  return {
    notice: `Deleted ${data?.length ?? 0} order(s).`,
    deletedCount: data?.length ?? 0,
  }
}

/**
 * Deletes a single order by id (cascades to line items + status history).
 */
export async function deleteOrder(orderId: string): Promise<DataActionResult> {
  if (!(await isCallerPlatformAdmin())) {
    return { error: 'You need SUPER_ADMIN access to delete orders.' }
  }

  if (!orderId) {
    return { error: 'Missing order id.' }
  }

  const { error } = await createAdminClient().from('orders').delete().eq('id', orderId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/platform/orders')

  return { notice: 'Order deleted.' }
}

/**
 * Deletes dining sessions (cascades to any orders still linked to them).
 * This effectively resets the floor: tables become free again.
 */
export async function deleteSessions(restaurantId: string): Promise<DataActionResult> {
  if (!(await isCallerPlatformAdmin())) {
    return { error: 'You need SUPER_ADMIN access to delete platform data.' }
  }

  let query = createAdminClient().from('dining_sessions').delete().select('id')

  if (restaurantId) {
    query = query.eq('restaurant_id', restaurantId)
  }

  const { data, error } = await query

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/platform')
  revalidatePath('/admin')

  return {
    notice: `Deleted ${data?.length ?? 0} dining session(s).`,
    deletedCount: data?.length ?? 0,
  }
}

/**
 * Deletes a restaurant and everything under it (menu, tables, orders,
 * sessions, team memberships) via ON DELETE CASCADE.
 */
export async function deleteRestaurant(restaurantId: string): Promise<DataActionResult> {
  if (!(await isCallerPlatformAdmin())) {
    return { error: 'You need SUPER_ADMIN access to delete platform data.' }
  }

  if (!restaurantId) {
    return { error: 'Select a restaurant to delete.' }
  }

  const admin = createAdminClient()

  const { data: restaurant } = await admin.from('restaurants').select('name').eq('id', restaurantId).single()

  const { error } = await admin.from('restaurants').delete().eq('id', restaurantId)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/platform')
  revalidatePath('/platform/orders')
  revalidatePath('/admin')

  return { notice: `Restaurant "${restaurant?.name ?? 'Unknown'}" and all of its data were deleted.` }
}
