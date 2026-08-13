import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getStaffPerformanceAnalytics } from '@/lib/analytics/staff'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function atLocalMidnight(daysAgo: number): Date {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  date.setDate(date.getDate() - daysAgo)
  return date
}

function isoAt(date: Date, hour: number): string {
  const d = new Date(date)
  d.setHours(hour, 30, 0, 0)
  return d.toISOString()
}

function buildChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockResolvedValue(result),
  }
}

describe('getStaffPerformanceAnalytics', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('returns zeroed metrics when no orders carry a waiter', async () => {
    mockFrom.mockReturnValue(buildChain({ data: [], error: null }))

    const metrics = await getStaffPerformanceAnalytics('restaurant-1')

    expect(mockFrom).toHaveBeenCalledWith('orders')
    expect(metrics.totalOrdersHandled).toBe(0)
    expect(metrics.totalRevenueHandled).toBe(0)
    expect(metrics.activeStaffCount).toBe(0)
    expect(metrics.staff).toEqual([])
  })

  it('groups orders by waiter, sums revenue, and counts distinct tables', async () => {
    const today = atLocalMidnight(0)
    const rows = [
      { id: 'o1', waiter_id: 'waiter-1', table_id: 't1', status: 'SERVED', total: 20, created_at: isoAt(today, 12) },
      { id: 'o2', waiter_id: 'waiter-1', table_id: 't1', status: 'SERVED', total: 30, created_at: isoAt(today, 13) },
      { id: 'o3', waiter_id: 'waiter-1', table_id: 't2', status: 'READY', total: 50, created_at: isoAt(today, 14) },
      { id: 'o4', waiter_id: 'waiter-2', table_id: 't3', status: 'ACCEPTED', total: 10, created_at: isoAt(today, 15) },
    ]
    mockFrom.mockReturnValue(buildChain({ data: rows, error: null }))

    const metrics = await getStaffPerformanceAnalytics('restaurant-1')

    expect(metrics.totalOrdersHandled).toBe(4)
    expect(metrics.totalRevenueHandled).toBe(110)
    expect(metrics.activeStaffCount).toBe(2)

    const waiter1 = metrics.staff.find((entry) => entry.staffId === 'waiter-1')
    const waiter2 = metrics.staff.find((entry) => entry.staffId === 'waiter-2')

    expect(waiter1).toMatchObject({ ordersHandled: 3, revenueHandled: 100, tablesServed: 2 })
    expect(waiter1?.averageOrderValue).toBeCloseTo(33.33, 1)
    expect(waiter2).toMatchObject({ ordersHandled: 1, revenueHandled: 10, tablesServed: 1 })
  })

  it('excludes cancelled and rejected orders from revenue but still counts them as handled', async () => {
    const today = atLocalMidnight(0)
    const rows = [
      { id: 'o1', waiter_id: 'waiter-1', table_id: 't1', status: 'CANCELLED', total: 99, created_at: isoAt(today, 12) },
      { id: 'o2', waiter_id: 'waiter-1', table_id: 't1', status: 'REJECTED', total: 99, created_at: isoAt(today, 13) },
      { id: 'o3', waiter_id: 'waiter-1', table_id: 't1', status: 'SERVED', total: 25, created_at: isoAt(today, 14) },
    ]
    mockFrom.mockReturnValue(buildChain({ data: rows, error: null }))

    const metrics = await getStaffPerformanceAnalytics('restaurant-1')

    const waiter1 = metrics.staff[0]
    expect(waiter1).toMatchObject({ ordersHandled: 3, revenueHandled: 25, tablesServed: 1 })
  })

  it('honours the custom date range and ignores orders outside it', async () => {
    const today = atLocalMidnight(0)
    const fortyDaysAgo = atLocalMidnight(40)
    const rows = [
      { id: 'o1', waiter_id: 'waiter-1', table_id: 't1', status: 'SERVED', total: 40, created_at: isoAt(today, 12) },
      // 40 days ago: outside the custom 30-day window below.
      { id: 'o2', waiter_id: 'waiter-1', table_id: 't2', status: 'SERVED', total: 999, created_at: isoAt(fortyDaysAgo, 12) },
    ]
    mockFrom.mockReturnValue(buildChain({ data: rows, error: null }))

    const from = localDateKey(atLocalMidnight(30))
    const to = localDateKey(today)
    const metrics = await getStaffPerformanceAnalytics('restaurant-1', { from, to })

    const waiter1 = metrics.staff[0]
    expect(waiter1).toMatchObject({ ordersHandled: 1, revenueHandled: 40, tablesServed: 1 })
  })
})
