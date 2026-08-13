import { NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/server'

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
}

export async function GET(_: Request, { params }: Props) {
  const { trackingToken } = await params
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('orders')
    .select('id, status, total, currency, customer_note, created_at, restaurant_tables(name), restaurants(name), order_items(id, item_name, quantity, unit_price, notes)')
    .eq('public_tracking_token', trackingToken)
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  const order = data as OrderRow
  const table = Array.isArray(order.restaurant_tables) ? order.restaurant_tables[0] : order.restaurant_tables
  const restaurant = Array.isArray(order.restaurants) ? order.restaurants[0] : order.restaurants

  return NextResponse.json({
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
  })
}
