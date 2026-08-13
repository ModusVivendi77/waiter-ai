import { createClient } from '@/lib/supabase/client'
import type { AnalyticsRange } from '@/lib/analytics/restaurant'

export type StaffPerformance = {
  staffId: string
  ordersHandled: number
  revenueHandled: number
  tablesServed: number
  averageOrderValue: number
}

export type StaffPerformanceMetrics = {
  totalOrdersHandled: number
  totalRevenueHandled: number
  activeStaffCount: number
  staff: StaffPerformance[]
}

// Revenue-generating statuses only — cancelled/rejected orders did not produce value.
const VALUE_STATUSES = new Set(['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED'])

function toLocalDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseLocalDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month || 1) - 1, day || 1)
}

type OrderRow = {
  id: string
  waiter_id: string | null
  table_id: string
  status: string
  total: number
  created_at: string
}

/**
 * Staff performance analytics for a restaurant: how many orders each staff
 * member handled, the revenue they served, the distinct tables they covered,
 * and their average order value. Scoped to the last 30 days by default, or to
 * a custom YYYY-MM-DD range (inclusive, capped at 90 days).
 */
export async function getStaffPerformanceAnalytics(
  restaurantId: string,
  range?: AnalyticsRange
): Promise<StaffPerformanceMetrics> {
  const supabase = createClient()

  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const defaultFrom = new Date(today)
  defaultFrom.setDate(defaultFrom.getDate() - 30)

  const fromISO = range?.from ?? toLocalDateKey(defaultFrom)
  const toISO = range?.to ?? toLocalDateKey(today)
  const fromDate = parseLocalDateKey(fromISO)
  const toDate = parseLocalDateKey(toISO)

  if (fromDate.getTime() > toDate.getTime()) {
    return { totalOrdersHandled: 0, totalRevenueHandled: 0, activeStaffCount: 0, staff: [] }
  }

  // Widen the fetch window slightly beyond the range so local-timezone bucketing
  // stays complete for orders created near midnight.
  const fetchFrom = new Date(fromDate)
  fetchFrom.setDate(fetchFrom.getDate() - 1)
  const fetchTo = new Date(toDate)
  fetchTo.setDate(fetchTo.getDate() + 1)

  const { data, error } = await supabase
    .from('orders')
    .select('id, waiter_id, table_id, status, total, created_at')
    .eq('restaurant_id', restaurantId)
    .not('waiter_id', 'is', null)
    .gte('created_at', fetchFrom.toISOString())
    .lte('created_at', fetchTo.toISOString())

  if (error) {
    throw new Error(error.message)
  }

  const rows = (data as OrderRow[]) || []
  const staffMap = new Map<string, { orders: number; revenue: number; tables: Set<string> }>()

  for (const row of rows) {
    const orderKey = toLocalDateKey(new Date(row.created_at))
    if (orderKey < fromISO || orderKey > toISO) {
      continue
    }

    if (!row.waiter_id) {
      continue
    }

    const entry = staffMap.get(row.waiter_id) || { orders: 0, revenue: 0, tables: new Set<string>() }
    entry.orders += 1
    if (VALUE_STATUSES.has(row.status)) {
      entry.revenue += Number(row.total)
    }
    entry.tables.add(row.table_id)
    staffMap.set(row.waiter_id, entry)
  }

  const staff: StaffPerformance[] = Array.from(staffMap.entries()).map(([staffId, entry]) => {
    const revenueHandled = Math.round(entry.revenue * 100) / 100
    const ordersHandled = entry.orders

    return {
      staffId,
      ordersHandled,
      revenueHandled,
      tablesServed: entry.tables.size,
      averageOrderValue: ordersHandled > 0 ? Math.round((revenueHandled / ordersHandled) * 100) / 100 : 0,
    }
  })

  staff.sort((a, b) => b.revenueHandled - a.revenueHandled)

  const totalOrdersHandled = staff.reduce((sum, entry) => sum + entry.ordersHandled, 0)
  const totalRevenueHandled = Math.round(staff.reduce((sum, entry) => sum + entry.revenueHandled, 0) * 100) / 100

  return {
    totalOrdersHandled,
    totalRevenueHandled,
    activeStaffCount: staff.length,
    staff,
  }
}
