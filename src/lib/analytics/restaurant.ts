import { createClient } from '@/lib/supabase/client'

export type DailyMetrics = {
  date: string
  orderCount: number
  orderValue: number
}

export type TopProduct = {
  itemName: string
  quantity: number
  value: number
}

export type AnalyticsMetrics = {
  todayOrders: number
  todayValue: number
  weekOrders: number
  weekValue: number
  monthOrders: number
  monthValue: number
  averageOrderValue: number
  topProducts: TopProduct[]
  lastSevenDays: DailyMetrics[]
}

function formatCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

export async function getRestaurantAnalytics(restaurantId: string): Promise<AnalyticsMetrics> {
  const supabase = createClient()

  // Get dates for filtering
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)

  const todayISO = today.toISOString().split('T')[0]
  const weekAgoISO = weekAgo.toISOString().split('T')[0]
  const monthAgoISO = monthAgo.toISOString().split('T')[0]

  // Fetch all orders for the restaurant in the last 30 days
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, status, total, created_at, order_items(item_name, quantity, unit_price)')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', monthAgo.toISOString())
    .order('created_at', { ascending: false })

  if (ordersError) {
    throw new Error(`Failed to fetch orders: ${ordersError.message}`)
  }

  const typedOrders = (orders || []) as Array<{
    id: string
    status: string
    total: number
    created_at: string
    order_items: Array<{ item_name: string; quantity: number; unit_price: number }> | null
  }>

  // Calculate metrics
  let todayOrders = 0
  let todayValue = 0
  let weekOrders = 0
  let weekValue = 0
  let monthOrders = 0
  let monthValue = 0
  const dailyMap = new Map<string, { count: number; value: number }>()
  const productMap = new Map<string, { quantity: number; value: number }>()

  for (const order of typedOrders) {
    const orderDate = new Date(order.created_at)
    const orderDateISO = orderDate.toISOString().split('T')[0]

    // Daily tracking
    const current = dailyMap.get(orderDateISO) || { count: 0, value: 0 }
    current.count += 1
    current.value += order.total
    dailyMap.set(orderDateISO, current)

    // Today
    if (orderDateISO === todayISO) {
      todayOrders += 1
      todayValue += order.total
    }

    // Week
    if (orderDateISO >= weekAgoISO) {
      weekOrders += 1
      weekValue += order.total
    }

    // Month
    if (orderDateISO >= monthAgoISO) {
      monthOrders += 1
      monthValue += order.total
    }

    // Track products
    if (order.order_items) {
      for (const item of order.order_items) {
        const current = productMap.get(item.item_name) || { quantity: 0, value: 0 }
        current.quantity += item.quantity
        current.value += item.unit_price * item.quantity
        productMap.set(item.item_name, current)
      }
    }
  }

  // Calculate average order value
  const totalOrders = monthOrders || 1
  const averageOrderValue = formatCurrency(monthValue / totalOrders)

  // Get top 5 products
  const topProducts = Array.from(productMap.entries())
    .map(([itemName, data]) => ({
      itemName,
      quantity: data.quantity,
      value: formatCurrency(data.value),
    }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)

  // Get last 7 days
  const lastSevenDays: DailyMetrics[] = []
  for (let i = 6; i >= 0; i--) {
    const date = new Date(today)
    date.setDate(date.getDate() - i)
    const dateISO = date.toISOString().split('T')[0]
    const metrics = dailyMap.get(dateISO) || { count: 0, value: 0 }
    lastSevenDays.push({
      date: dateISO,
      orderCount: metrics.count,
      orderValue: formatCurrency(metrics.value),
    })
  }

  return {
    todayOrders,
    todayValue: formatCurrency(todayValue),
    weekOrders,
    weekValue: formatCurrency(weekValue),
    monthOrders,
    monthValue: formatCurrency(monthValue),
    averageOrderValue,
    topProducts,
    lastSevenDays,
  }
}
