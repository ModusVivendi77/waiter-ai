import { NextRequest, NextResponse } from 'next/server'

import { createOrderSchema } from '@/lib/validation/orders'
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

type TableRow = {
  id: string
  name: string
  restaurant_id: string
  restaurants:
    | {
        name: string
        currency: string
      }
    | Array<{
        name: string
        currency: string
      }>
    | null
}

type SessionRow = {
  id: string
}

type MenuItemRow = {
  id: string
  name: string
  price: number
  available: boolean
  menu_item_modifiers:
    | Array<{
        id: string
        name: string
        price_delta: number
        active: boolean
      }>
    | null
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(getClientKey(request), 30, 10 * 60 * 1000)

  if (!limit.allowed) {
    return NextResponse.json(
      { error: 'Too many order submissions. Please try again later.' },
      {
        status: 429,
        headers: rateLimitHeaders(limit),
      }
    )
  }

  const payload = await request.json().catch(() => null)
  const parsed = createOrderSchema.safeParse(payload)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid order payload.' },
      { status: 400, headers: rateLimitHeaders(limit) }
    )
  }

  const { token, items, customerNote, idempotencyKey } = parsed.data
  const admin = createAdminClient()

  const { data: existingOrder } = await admin
    .from('orders')
    .select('id, order_number, status, total, currency, created_at, public_tracking_token')
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle()

  if (existingOrder) {
    return NextResponse.json({ order: existingOrder }, { status: 200, headers: rateLimitHeaders(limit) })
  }

  const { data: table, error: tableError } = await admin
    .from('restaurant_tables')
    .select('id, name, restaurant_id, restaurants(name, currency)')
    .eq('qr_token', token)
    .eq('active', true)
    .maybeSingle()

  if (tableError || !table) {
    return NextResponse.json(
      { error: 'Table QR token is invalid or inactive.' },
      { status: 404, headers: rateLimitHeaders(limit) }
    )
  }

  const typedTable = table as TableRow
  const restaurant = Array.isArray(typedTable.restaurants) ? typedTable.restaurants[0] : typedTable.restaurants

  const menuItemIds = items.map((item) => item.menuItemId)
  const { data: menuItems, error: menuError } = await admin
    .from('menu_items')
    .select('id, name, price, available, menu_item_modifiers(id, name, price_delta, active)')
    .eq('restaurant_id', typedTable.restaurant_id)
    .in('id', menuItemIds)

  if (menuError || !menuItems) {
    return NextResponse.json(
      { error: menuError?.message ?? 'Unable to validate menu items.' },
      { status: 400, headers: rateLimitHeaders(limit) }
    )
  }

  const typedMenuItems = menuItems as MenuItemRow[]
  if (typedMenuItems.length !== menuItemIds.length || typedMenuItems.some((item) => !item.available)) {
    return NextResponse.json(
      { error: 'One or more selected items are unavailable.' },
      { status: 400, headers: rateLimitHeaders(limit) }
    )
  }

  const itemMap = new Map(typedMenuItems.map((item) => [item.id, item]))

  // Resolve each line's unit price (base + selected modifier deltas) and
  // validate that every requested modifier actually belongs to the menu item.
  const resolvedLines = items.map((item) => {
    const menuItem = itemMap.get(item.menuItemId) as MenuItemRow
    const activeModifiers = (menuItem.menu_item_modifiers || []).filter((modifier) => modifier.active)
    const modifierNames: string[] = []

    for (const name of item.modifiers || []) {
      const found = activeModifiers.find((modifier) => modifier.name.toLowerCase() === name.toLowerCase())
      if (!found) {
        return { error: `"${name}" is not a valid option for ${menuItem.name}.` }
      }
      modifierNames.push(found.name)
    }

    const modifierDelta = modifierNames.reduce((sum, name) => {
      const modifier = activeModifiers.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
      return sum + Number(modifier?.price_delta || 0)
    }, 0)

    return {
      menuItem,
      modifierNames,
      unitPrice: Number(menuItem.price) + modifierDelta,
      quantity: item.quantity,
      notes: item.notes || null,
    }
  })

  const invalidLine = resolvedLines.find((line) => 'error' in line) as { error: string } | undefined
  if (invalidLine) {
    return NextResponse.json({ error: invalidLine.error }, { status: 400, headers: rateLimitHeaders(limit) })
  }

  const subtotal = (resolvedLines as Array<{ unitPrice: number; quantity: number }>).reduce(
    (sum, line) => sum + line.unitPrice * line.quantity,
    0
  )

  const { data: activeSession, error: sessionError } = await admin
    .from('dining_sessions')
    .select('id')
    .eq('table_id', typedTable.id)
    .eq('status', 'ACTIVE')
    .maybeSingle()

  if (sessionError) {
    return NextResponse.json({ error: sessionError.message }, { status: 400, headers: rateLimitHeaders(limit) })
  }

  let sessionId = (activeSession as SessionRow | null)?.id ?? null

  if (!sessionId) {
    const { data: createdSession, error: createSessionError } = await admin
      .from('dining_sessions')
      .insert({
        restaurant_id: typedTable.restaurant_id,
        table_id: typedTable.id,
        status: 'ACTIVE',
      })
      .select('id')
      .single()

    if (createSessionError || !createdSession) {
      return NextResponse.json(
        { error: createSessionError?.message ?? 'Unable to start dining session.' },
        { status: 400, headers: rateLimitHeaders(limit) }
      )
    }

    sessionId = createdSession.id
  }

  const { data: order, error: orderError } = await admin
    .from('orders')
    .insert({
      restaurant_id: typedTable.restaurant_id,
      table_id: typedTable.id,
      session_id: sessionId,
      status: 'NEW',
      subtotal,
      total: subtotal,
      currency: restaurant?.currency || 'EUR',
      customer_note: customerNote || null,
      idempotency_key: idempotencyKey,
    })
    .select('id, order_number, status, total, currency, created_at, public_tracking_token')
    .single()

  if (orderError || !order) {
    return NextResponse.json(
      { error: orderError?.message ?? 'Unable to create order.' },
      { status: 400, headers: rateLimitHeaders(limit) }
    )
  }

  const { error: orderItemsError } = await admin.from('order_items').insert(
    (resolvedLines as Array<{
      menuItem: MenuItemRow
      modifierNames: string[]
      unitPrice: number
      quantity: number
      notes: string | null
    }>).map((line) => ({
      order_id: order.id,
      restaurant_id: typedTable.restaurant_id,
      menu_item_id: line.menuItem.id,
      item_name: line.menuItem.name,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      modifiers: line.modifierNames,
      notes: line.notes,
    }))
  )

  if (orderItemsError) {
    await admin.from('orders').delete().eq('id', order.id)
    return NextResponse.json(
      { error: orderItemsError.message },
      { status: 400, headers: rateLimitHeaders(limit) }
    )
  }

  const { error: historyError } = await admin.from('order_status_history').insert({
    order_id: order.id,
    old_status: null,
    new_status: 'NEW',
    changed_by: null,
  })

  if (historyError) {
    return NextResponse.json(
      {
        order,
        warning: 'Order created, but status history could not be recorded.',
      },
      { headers: rateLimitHeaders(limit) }
    )
  }

  return NextResponse.json(
    {
      order,
      table: {
        id: typedTable.id,
        name: typedTable.name,
      },
      restaurant: {
        name: restaurant?.name ?? 'Restaurant',
        currency: restaurant?.currency ?? 'EUR',
      },
    },
    { headers: rateLimitHeaders(limit) }
  )
}
