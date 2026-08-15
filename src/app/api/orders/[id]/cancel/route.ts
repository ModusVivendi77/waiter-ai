import { NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/server'
import { envInt, getRateLimitHeaders, rateLimit } from '@/lib/utils/rateLimit'

type Props = {
  params: Promise<{
    id: string
  }>
}

type OrderRow = {
  id: string
  status: string
  created_at: string
  restaurant_id: string
}

const DEFAULT_CANCEL_WINDOW_MINUTES = 5
const CANCELLABLE_STATUSES = new Set(['NEW', 'ACCEPTED'])

/**
 * Lets a customer cancel their own order from the tracking page, within the
 * restaurant's configurable cancellation window (default 5 minutes). The
 * tracking token in the body proves ownership — no auth required.
 */
export async function POST(request: NextRequest, { params }: Props) {
  const { id } = await params

  // Per-order budget (the tracking token in the body proves ownership), not a
  // platform-wide bucket — previously a single `order-cancel` counter of 5/min
  // was shared by every restaurant and every customer. Tune via
  // ORDER_CANCEL_RATE_LIMIT / ORDER_CANCEL_RATE_WINDOW_MINUTES.
  const limit = rateLimit(
    `order-cancel:${id}`,
    envInt('ORDER_CANCEL_RATE_LIMIT', 5),
    envInt('ORDER_CANCEL_RATE_WINDOW_MINUTES', 1) * 60 * 1000
  )

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many cancellation attempts. Please try again later.' },
      { status: 429, headers: getRateLimitHeaders(limit) }
    )
  }

  const body = (await request.json().catch(() => null)) as { trackingToken?: string } | null
  const trackingToken = body?.trackingToken

  if (!trackingToken || typeof trackingToken !== 'string') {
    return NextResponse.json({ error: 'Missing tracking token.' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: order } = await admin
    .from('orders')
    .select('id, status, created_at, restaurant_id')
    .eq('id', id)
    .eq('public_tracking_token', trackingToken)
    .maybeSingle()

  if (!order) {
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 })
  }

  const typedOrder = order as OrderRow

  if (!CANCELLABLE_STATUSES.has(typedOrder.status)) {
    return NextResponse.json({ error: 'This order can no longer be cancelled.' }, { status: 400 })
  }

  // Owner-configurable window, default 5 minutes. Defensive: if the live DB
  // hasn't been migrated yet the column is missing and we use the default.
  let windowMinutes = DEFAULT_CANCEL_WINDOW_MINUTES
  const { data: restaurantRow } = await admin
    .from('restaurants')
    .select('cancel_window_minutes')
    .eq('id', typedOrder.restaurant_id)
    .maybeSingle()
  if (restaurantRow && typeof (restaurantRow as { cancel_window_minutes?: number }).cancel_window_minutes === 'number') {
    windowMinutes = (restaurantRow as { cancel_window_minutes: number }).cancel_window_minutes
  }

  const createdAt = new Date(typedOrder.created_at).getTime()
  if (Number.isFinite(createdAt) && Date.now() - createdAt > windowMinutes * 60_000) {
    return NextResponse.json({ error: 'The cancellation window has passed.' }, { status: 400 })
  }

  const { error: updateError } = await admin.from('orders').update({ status: 'CANCELLED' }).eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await admin.from('order_status_history').insert({
    order_id: id,
    old_status: typedOrder.status,
    new_status: 'CANCELLED',
    changed_by: null,
  })

  return NextResponse.json({ ok: true })
}
