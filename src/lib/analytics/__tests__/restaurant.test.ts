import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getRestaurantAnalytics } from '@/lib/analytics/restaurant'

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
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue(result),
  }
}

describe('getRestaurantAnalytics', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('returns zeroed metrics when the restaurant has no orders', async () => {
    mockFrom.mockReturnValue(buildChain({ data: [], error: null }))

    const metrics = await getRestaurantAnalytics('restaurant-1')

    expect(mockFrom).toHaveBeenCalledWith('orders')
    expect(metrics.todayOrders).toBe(0)
    expect(metrics.todayValue).toBe(0)
    expect(metrics.weekOrders).toBe(0)
    expect(metrics.monthOrders).toBe(0)
    expect(metrics.averageOrderValue).toBe(0)
    expect(metrics.topProducts).toEqual([])
    expect(metrics.lastSevenDays).toHaveLength(7)
    metrics.lastSevenDays.forEach((day) => {
      expect(day.orderCount).toBe(0)
      expect(day.orderValue).toBe(0)
    })
  })

  it('throws when the orders query fails', async () => {
    mockFrom.mockReturnValue(buildChain({ data: null, error: { message: 'db down' } }))

    await expect(getRestaurantAnalytics('restaurant-1')).rejects.toThrow('Failed to fetch orders: db down')
  })

  it('calculates today, week, month totals, top products, and a 7-day trend', async () => {
    const today = atLocalMidnight(0)
    const yesterday = atLocalMidnight(1)
    const threeDaysAgo = atLocalMidnight(3)
    const tenDaysAgo = atLocalMidnight(10)

    const orders = [
      {
        id: 'order-1',
        status: 'SERVED',
        total: 20,
        created_at: isoAt(today, 12),
        order_items: [
          { item_name: 'Burger', quantity: 2, unit_price: 8 },
          { item_name: 'Mythos', quantity: 1, unit_price: 4 },
        ],
      },
      {
        id: 'order-2',
        status: 'SERVED',
        total: 30,
        created_at: isoAt(yesterday, 13),
        order_items: [
          { item_name: 'Burger', quantity: 3, unit_price: 8 },
          { item_name: 'Fries', quantity: 1, unit_price: 6 },
        ],
      },
      {
        id: 'order-3',
        status: 'SERVED',
        total: 15,
        created_at: isoAt(threeDaysAgo, 14),
        order_items: [{ item_name: 'Salad', quantity: 1, unit_price: 15 }],
      },
      {
        id: 'order-4',
        status: 'SERVED',
        total: 40,
        created_at: isoAt(tenDaysAgo, 15),
        order_items: [{ item_name: 'Burger', quantity: 5, unit_price: 8 }],
      },
    ]

    mockFrom.mockReturnValue(buildChain({ data: orders, error: null }))

    const metrics = await getRestaurantAnalytics('restaurant-1')

    // Today: only order-1
    expect(metrics.todayOrders).toBe(1)
    expect(metrics.todayValue).toBe(20)

    // Week (last 7 days): order-1, order-2, order-3 (order-4 is 10 days out)
    expect(metrics.weekOrders).toBe(3)
    expect(metrics.weekValue).toBe(20 + 30 + 15)

    // Month (last 30 days): all four orders
    expect(metrics.monthOrders).toBe(4)
    expect(metrics.monthValue).toBe(20 + 30 + 15 + 40)

    // Average: monthValue / monthOrders
    expect(metrics.averageOrderValue).toBe(Math.round((20 + 30 + 15 + 40) / 4 * 100) / 100)

    // Top products by quantity: Burger 10, Fries 1, Mythos 1, Salad 1
    expect(metrics.topProducts[0]).toEqual({ itemName: 'Burger', quantity: 10, value: 80 })
    expect(metrics.topProducts).toHaveLength(4)

    // 7-day trend: today + yesterday populated, older days zeroed
    const trend = metrics.lastSevenDays
    expect(trend).toHaveLength(7)
    expect(trend[6]).toEqual({ date: localDateKey(today), orderCount: 1, orderValue: 20 })
    expect(trend[5]).toEqual({ date: localDateKey(yesterday), orderCount: 1, orderValue: 30 })
    expect(trend[0]?.orderCount).toBe(0)
  })

  it('handles an order with null order_items', async () => {
    const orders = [
      {
        id: 'order-1',
        status: 'NEW',
        total: 12,
        created_at: isoAt(atLocalMidnight(0), 10),
        order_items: null,
      },
    ]

    mockFrom.mockReturnValue(buildChain({ data: orders, error: null }))

    const metrics = await getRestaurantAnalytics('restaurant-1')

    expect(metrics.todayOrders).toBe(1)
    expect(metrics.todayValue).toBe(12)
    expect(metrics.topProducts).toEqual([])
  })
})