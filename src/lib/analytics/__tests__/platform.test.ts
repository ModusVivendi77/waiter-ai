import { beforeEach, describe, expect, it, vi } from 'vitest'

import { getPlatformAnalytics } from '@/lib/analytics/platform'

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}))

function buildOrderChain(result: unknown) {
  return {
    select: vi.fn().mockReturnThis(),
    gte: vi.fn().mockResolvedValue(result),
  }
}

function buildPlainSelect(result: unknown) {
  return {
    select: vi.fn().mockResolvedValue(result),
  }
}

describe('getPlatformAnalytics', () => {
  beforeEach(() => {
    mockFrom.mockReset()
  })

  it('throws when the restaurants query fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'restaurants') {
        return buildPlainSelect({ data: null, error: { message: 'restaurants down' } })
      }
      return buildPlainSelect({ data: [], error: null })
    })

    await expect(getPlatformAnalytics()).rejects.toThrow('restaurants down')
  })

  it('returns platform metrics across restaurants, orders, and tables', async () => {
    const restaurants = [{ id: 'rest-1' }, { id: 'rest-2' }]
    const todayOrders = [
      { id: 'o-1', total: 10, restaurant_id: 'rest-1', restaurants: { name: 'Green Bar' } },
      { id: 'o-2', total: 20, restaurant_id: 'rest-2', restaurants: { name: 'Blue Cafe' } },
    ]
    const allOrders = [
      ...todayOrders,
      { id: 'o-3', total: 30, restaurant_id: 'rest-1', restaurants: { name: 'Green Bar' } },
      { id: 'o-4', total: 40, restaurant_id: 'rest-2', restaurants: { name: 'Blue Cafe' } },
    ]
    const tables = [{ id: 't-1' }, { id: 't-2' }, { id: 't-3' }]

    // getPlatformAnalytics queries `orders` twice: today's orders first, then the 30-day set.
    let ordersCall = 0
    mockFrom.mockImplementation((table: string) => {
      if (table === 'restaurants') {
        return buildPlainSelect({ data: restaurants, error: null })
      }
      if (table === 'orders') {
        ordersCall += 1
        const data = ordersCall === 1 ? todayOrders : allOrders
        return buildOrderChain({ data, error: null })
      }
      if (table === 'restaurant_tables') {
        return buildPlainSelect({ data: tables, error: null })
      }
      return buildPlainSelect({ data: [], error: null })
    })

    const metrics = await getPlatformAnalytics()

    expect(metrics.totalRestaurants).toBe(2)
    expect(metrics.totalTables).toBe(3)
    expect(metrics.todayOrders).toBe(2)
    expect(metrics.totalOrders).toBe(4)
    expect(metrics.totalOrderValue).toBe(10 + 20 + 30 + 40)
    expect(metrics.averageOrderValue).toBe(Math.round((10 + 20 + 30 + 40) / 4 * 100) / 100)

    // Active restaurants are those with orders in the last 30 days.
    expect(metrics.activeRestaurants).toBe(2)

    // Top restaurants sorted by order count (ties keep insertion order).
    expect(metrics.topRestaurants).toEqual([
      { name: 'Green Bar', orders: 2, value: 40 },
      { name: 'Blue Cafe', orders: 2, value: 60 },
    ])
  })

  it('handles restaurant joins as arrays or missing names', async () => {
    const restaurants = [{ id: 'rest-1' }]
    const allOrders = [
      {
        id: 'o-1',
        total: 15,
        restaurant_id: 'rest-1',
        restaurants: [{ name: 'Green Bar' }],
      },
      {
        id: 'o-2',
        total: 25,
        restaurant_id: 'rest-unknown',
        restaurants: null,
      },
    ]

    mockFrom.mockImplementation((table: string) => {
      if (table === 'restaurants') {
        return buildPlainSelect({ data: restaurants, error: null })
      }
      if (table === 'orders') {
        return buildOrderChain({ data: allOrders, error: null })
      }
      if (table === 'restaurant_tables') {
        return buildPlainSelect({ data: [], error: null })
      }
      return buildPlainSelect({ data: [], error: null })
    })

    const metrics = await getPlatformAnalytics()

    expect(metrics.totalOrders).toBe(2)
    expect(metrics.totalOrderValue).toBe(40)
    expect(metrics.activeRestaurants).toBe(2)
    // Unknown restaurant names fall back to 'Unknown'
    expect(metrics.topRestaurants.find((entry) => entry.name === 'Unknown')?.orders).toBe(1)
  })
})