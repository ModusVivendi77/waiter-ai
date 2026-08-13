import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/server'
import { getRateLimitHeaders, rateLimit } from '@/lib/utils/rateLimit'

function rateLimitHeaders(limit: ReturnType<typeof rateLimit>) {
  return getRateLimitHeaders(limit)
}

function getClientKey(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }
  return request.headers.get('x-real-ip') || 'unknown-client'
}

type Props = {
  params: Promise<{
    trackingToken: string
  }>
}

type OrderRow = {
  id: string
  status: string
  total: number
  currency: string
  customer_note: string | null
  created_at: string
  restaurant_tables:
    | {
        name: string
      }
    | Array<{
        name: string
      }>
    | null
  restaurants:
    | {
        name: string
      }
    | Array<{
        name: string
      }>
    | null
  order_items:
    | Array<{
        id: string
        item_name: string
        quantity: number
        unit_price: number
        notes: string | null
      }>
    | null
  order_status_history:
    | Array<{
        id: string
        old_status: string | null
        new_status: string
        created_at: string
      }>
    | null
}

export async function GET(request: NextRequest, { params }: Props) {
  const limit = rateLimit(getClientKey(request), 120, 60 * 1000)

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many status requests. Please try again later.' },
      {
        status: 429,
        headers: rateLimitHeaders(limit),
      }
    )
  }

  const { trackingToken } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('orders')
    .select('id, status, total, currency, customer_note, created_at, restaurant_tables(name), restaurants(name), order_items(id, item_name, quantity, unit_price, notes), order_status_history(id, old_status, new_status, created_at)')
    .eq('public_tracking_token', trackingToken)
    .order('created_at', { foreignTable: 'order_status_history', ascending: true })
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json(
      { error: 'Order not found.' },
      { status: 404, headers: rateLimitHeaders(limit) }
    )
  }

  const order = data as OrderRow
  const table = Array.isArray(order.restaurant_tables) ? order.restaurant_tables[0] : order.restaurant_tables
  const restaurant = Array.isArray(order.restaurants) ? order.restaurants[0] : order.restaurants

  return NextResponse.json(
    {
      order: {
        id: order.id,
        status: order.status,
        total: order.total,
        currency: order.currency,
        customer_note: order.customer_note,
        created_at: order.created_at,
      },
      table: {
        name: table?.name || 'Unknown table',
      },
      restaurant: {
        name: restaurant?.name || 'Restaurant',
      },
      items: order.order_items || [],
      history: order.order_status_history || [],
    },
    { headers: rateLimitHeaders(limit) }
  )
}
