import { createClient } from '@/lib/supabase/client'

export type PlatformAnalyticsMetrics = {
  totalRestaurants: number
  activeRestaurants: number
  totalTables: number
  totalOrders: number
  todayOrders: number
  averageOrderValue: number
  totalOrderValue: number
  topRestaurants: Array<{
    name: string
    orders: number
    value: number
  }>
}

function formatCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

export async function getPlatformAnalytics(): Promise<PlatformAnalyticsMetrics> {
  const supabase = createClient()

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayISO = today.toISOString()

  try {
    // Get restaurant counts
    const { data: allRestaurants, error: restaurantsError } = await supabase
      .from('restaurants')
      .select('id')

    if (restaurantsError) throw restaurantsError

    const totalRestaurants = allRestaurants?.length || 0

    // Get orders for today and aggregation
    const { data: todayOrders, error: todayOrdersError } = await supabase
      .from('orders')
      .select('id, total, restaurant_id, restaurants(name)')
      .gte('created_at', todayISO)

    if (todayOrdersError) throw todayOrdersError

    const typedTodayOrders = (todayOrders || []) as Array<{
      id: string
      total: number
      restaurant_id: string
      restaurants: { name: string } | Array<{ name: string }> | null
    }>

    // Get all orders for aggregation
    const thirtyDaysAgo = new Date(today)
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

    const { data: allOrders, error: allOrdersError } = await supabase
      .from('orders')
      .select('id, total, restaurant_id, restaurants(name)')
      .gte('created_at', thirtyDaysAgo.toISOString())

    if (allOrdersError) throw allOrdersError

    const typedAllOrders = (allOrders || []) as Array<{
      id: string
      total: number
      restaurant_id: string
      restaurants: { name: string } | Array<{ name: string }> | null
    }>

    // Get table counts
    const { data: tables, error: tablesError } = await supabase
      .from('restaurant_tables')
      .select('id')

    if (tablesError) throw tablesError

    const totalTables = tables?.length || 0

    // Calculate metrics
    const todayOrderCount = typedTodayOrders.length
    const totalOrders = typedAllOrders.length
    let totalOrderValue = 0

    // Build restaurant rankings
    const restaurantMap = new Map<string, { name: string; orders: number; value: number }>()
    for (const order of typedAllOrders) {
      totalOrderValue += order.total
      const restaurantName = Array.isArray(order.restaurants)
        ? order.restaurants[0]?.name
        : order.restaurants?.name
      const name = restaurantName || 'Unknown'

      const current = restaurantMap.get(order.restaurant_id) || { name, orders: 0, value: 0 }
      current.orders += 1
      current.value += order.total
      restaurantMap.set(order.restaurant_id, current)
    }

    const topRestaurants = Array.from(restaurantMap.values())
      .map((r) => ({
        name: r.name,
        orders: r.orders,
        value: formatCurrency(r.value),
      }))
      .sort((a, b) => b.orders - a.orders)
      .slice(0, 5)

    const averageOrderValue = totalOrders > 0 ? formatCurrency(totalOrderValue / totalOrders) : 0

    // Estimate active restaurants (those with orders in last 30 days)
    const activeRestaurantIds = new Set(typedAllOrders.map((o) => o.restaurant_id))
    const activeRestaurants = activeRestaurantIds.size

    return {
      totalRestaurants,
      activeRestaurants,
      totalTables,
      totalOrders,
      todayOrders: todayOrderCount,
      averageOrderValue,
      totalOrderValue: formatCurrency(totalOrderValue),
      topRestaurants,
    }
  } catch (error) {
    console.error('Platform analytics error:', error)
    throw error
  }
}
