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
  previousWeekOrders: number
  previousWeekValue: number
  weekOrdersChangePct: number
  weekValueChangePct: number
  monthOrders: number
  monthValue: number
  averageOrderValue: number
  topProducts: TopProduct[]
  lastSevenDays: DailyMetrics[]
  rangeOrders: number
  rangeValue: number
  rangeAverageOrderValue: number
  rangeDaily: DailyMetrics[]
  statusFunnel: Array<{ status: string; count: number }>
}

function formatCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

// Local-timezone date key (YYYY-MM-DD) so "today"/"week"/"month" bucketing is
// consistent regardless of the server's UTC offset. Using toISOString() here
// would shift dates for timezones east of UTC (e.g. Europe/Athens at UTC+3).
function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export type AnalyticsRange = {
  from?: string
  to?: string
}

function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

function buildRangeDaily(
  fromISO: string,
  toISO: string,
  dailyMap: Map<string, { count: number; value: number }>
): DailyMetrics[] {
  const result: DailyMetrics[] = []
  const start = parseLocalDateKey(fromISO)
  const end = parseLocalDateKey(toISO)

  if (start.getTime() > end.getTime()) {
    return []
  }

  const cursor = new Date(start)
  let days = 0
  while (cursor.getTime() <= end.getTime() && days < 90) {
    const key = toLocalDateKey(cursor)
    const metrics = dailyMap.get(key) || { count: 0, value: 0 }
    result.push({
      date: key,
      orderCount: metrics.count,
      orderValue: formatCurrency(metrics.value),
    })
    cursor.setDate(cursor.getDate() + 1)
    days += 1
  }

  return result
}

export async function getRestaurantAnalytics(restaurantId: string, range?: AnalyticsRange): Promise<AnalyticsMetrics> {
  const supabase = createClient()

  // Get dates for filtering
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const monthAgo = new Date(today)
  monthAgo.setDate(monthAgo.getDate() - 30)

  const todayISO = toLocalDateKey(today)
  const weekAgoISO = toLocalDateKey(weekAgo)
  const monthAgoISO = toLocalDateKey(monthAgo)
  const previousWeekStart = new Date(weekAgo)
  previousWeekStart.setDate(previousWeekStart.getDate() - 7)
  const previousWeekStartISO = toLocalDateKey(previousWeekStart)

  // A custom range may extend further back than the standard 30-day window.
  // Widen the fetch start when a custom `from` is supplied so range metrics
  // are complete, while the standard buckets keep using the 30-day window.
  const customFromDate = range?.from ? parseLocalDateKey(range.from) : null
  const fetchStart = customFromDate && customFromDate.getTime() < monthAgo.getTime() ? customFromDate : monthAgo

  // Fetch all orders for the restaurant from the fetch start through today
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('id, status, total, created_at, order_items(item_name, quantity, unit_price)')
    .eq('restaurant_id', restaurantId)
    .gte('created_at', fetchStart.toISOString())
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
  let previousWeekOrders = 0
  let previousWeekValue = 0
  let monthOrders = 0
  let monthValue = 0
  const dailyMap = new Map<string, { count: number; value: number }>()
  const productMap = new Map<string, { quantity: number; value: number }>()

  for (const order of typedOrders) {
    const orderDate = new Date(order.created_at)
    const orderDateISO = toLocalDateKey(orderDate)

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

    // Week (current rolling week)
    if (orderDateISO >= weekAgoISO) {
      weekOrders += 1
      weekValue += order.total
    } else if (orderDateISO >= previousWeekStartISO) {
      // Previous week (the 7 days immediately before this week)
      previousWeekOrders += 1
      previousWeekValue += order.total
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

  // Week-over-week change percentages (safe division — no change when base is 0)
  const weekOrdersChangePct = previousWeekOrders > 0
    ? Math.round(((weekOrders - previousWeekOrders) / previousWeekOrders) * 100)
    : (weekOrders > 0 ? 100 : 0)
  const weekValueChangePct = previousWeekValue > 0
    ? Math.round(((weekValue - previousWeekValue) / previousWeekValue) * 100)
    : (weekValue > 0 ? 100 : 0)

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
    const dateISO = toLocalDateKey(date)
    const metrics = dailyMap.get(dateISO) || { count: 0, value: 0 }
    lastSevenDays.push({
      date: dateISO,
      orderCount: metrics.count,
      orderValue: formatCurrency(metrics.value),
    })
  }

  // Custom date-range metrics (inclusive YYYY-MM-DD bounds). When no custom
  // range is supplied, fall back to the 30-day window so the fields always
  // reflect the displayed period.
  const rangeFromISO = range?.from ?? monthAgoISO
  const rangeToISO = range?.to ?? todayISO
  let rangeOrders = 0
  let rangeValue = 0
  for (const order of typedOrders) {
    const orderKey = toLocalDateKey(new Date(order.created_at))
    if (orderKey >= rangeFromISO && orderKey <= rangeToISO) {
      rangeOrders += 1
      rangeValue += order.total
    }
  }
  const rangeAverageOrderValue = rangeOrders > 0 ? formatCurrency(rangeValue / rangeOrders) : 0
  const rangeDaily = buildRangeDaily(rangeFromISO, rangeToISO, dailyMap)

  // Order status funnel: how many of the month's orders are in each lifecycle stage.
  // This surfaces where orders get stuck, rejected, or cancelled. Scoped to the
  // standard 30-day window so it stays consistent with the "Last 30 Days" metrics
  // even when a custom range widens the raw fetch.
  const monthOrdersOnly = typedOrders.filter((order) => toLocalDateKey(new Date(order.created_at)) >= monthAgoISO)
  const statusFunnel = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'REJECTED', 'CANCELLED'].map((status) => ({
    status,
    count: monthOrdersOnly.filter((order) => order.status === status).length,
  }))

  return {
    todayOrders,
    todayValue: formatCurrency(todayValue),
    weekOrders,
    weekValue: formatCurrency(weekValue),
    previousWeekOrders,
    previousWeekValue: formatCurrency(previousWeekValue),
    weekOrdersChangePct,
    weekValueChangePct,
    monthOrders,
    monthValue: formatCurrency(monthValue),
    averageOrderValue,
    topProducts,
    lastSevenDays,
    rangeOrders,
    rangeValue: formatCurrency(rangeValue),
    rangeAverageOrderValue,
    rangeDaily,
    statusFunnel,
  }
}
