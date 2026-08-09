# Waiter AI MVP — Implementation Next Steps & Task Breakdown

**Document Purpose:** Concrete implementation guidance and prioritized tasks  
**Target Audience:** Development team or LLM-assisted coding  

---

## Overview

This document provides a **step-by-step breakdown** of what needs to be built, in the order it should be built. It's designed so a development team or LLM can pick a task, implement it, and move to the next without constantly referring back to the main spec.

---

## Part 1: Pre-Development Setup (Day 1–2)

### Task 1.1: Repository Setup

**What to do:**
- [ ] Create GitHub repository: `waiter-ai` (or appropriate name)
- [ ] Initialize with Node.js `.gitignore`
- [ ] Create `README.md` with project overview
- [ ] Create `DEVELOPMENT.md` with local setup instructions

**Commands:**
```bash
git init
npm init -y
npm install -D typescript next react react-dom
npm install -D @types/react @types/node
npm install @supabase/supabase-js zod react-hook-form tailwindcss
npm install -D playwright @testing-library/react vitest
```

**Expected outcome:** GitHub repo with Next.js project skeleton and dependencies installed

---

### Task 1.2: Supabase Project Setup

**What to do:**
- [ ] Create Supabase project at supabase.com
- [ ] Note project URL and anon key
- [ ] Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

**Expected outcome:** Supabase project credentials in `.env.local` (never commit this file)

---

### Task 1.3: Vercel Deployment

**What to do:**
- [ ] Connect GitHub repo to Vercel
- [ ] Configure environment variables in Vercel project settings
- [ ] Setup preview deployments for branches
- [ ] Test that `npm run build` works

**Expected outcome:** Vercel auto-deploys on push to main

---

### Task 1.4: GitHub Actions CI/CD

**What to do:**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
```

- [ ] Add to repository
- [ ] Verify CI runs on PR

**Expected outcome:** Every PR runs lint, typecheck, tests, and build

---

## Part 2: Database Schema (Day 3–5)

### Task 2.1: Create Migrations Directory

**What to do:**
```bash
mkdir -p supabase/migrations
```

**Expected outcome:** Directory structure ready for SQL migrations

---

### Task 2.2: Migration 001 — Create Core Tables

**File:** `supabase/migrations/001_initial_schema.sql`

```sql
-- Restaurants
CREATE TABLE restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  address TEXT,
  currency CHAR(3) DEFAULT 'EUR',
  timezone TEXT DEFAULT 'Europe/Athens',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Restaurant Users (links auth.users to restaurants)
CREATE TABLE restaurant_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(restaurant_id, user_id)
);

-- Restaurant Tables
CREATE TABLE restaurant_tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  qr_token TEXT UNIQUE NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Dining Sessions
CREATE TABLE dining_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('ACTIVE', 'CLOSED')) DEFAULT 'ACTIVE',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Menu Categories
CREATE TABLE menu_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Menu Items
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES menu_categories(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES restaurant_tables(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES dining_sessions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (
    status IN ('NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED', 'REJECTED', 'CANCELLED')
  ) DEFAULT 'NEW',
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  currency CHAR(3) NOT NULL DEFAULT 'EUR',
  customer_note TEXT,
  idempotency_key TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Order Items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES menu_items(id),
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order Status History
CREATE TABLE order_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for query performance
CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurant_users_restaurant_id ON restaurant_users(restaurant_id);
CREATE INDEX idx_restaurant_users_user_id ON restaurant_users(user_id);
CREATE INDEX idx_restaurant_tables_qr_token ON restaurant_tables(qr_token);
CREATE INDEX idx_restaurant_tables_restaurant_id ON restaurant_tables(restaurant_id);
CREATE INDEX idx_menu_categories_restaurant_id ON menu_categories(restaurant_id);
CREATE INDEX idx_menu_items_restaurant_id ON menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category_id ON menu_items(category_id);
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_table_id ON orders(table_id);
CREATE INDEX idx_orders_session_id ON orders(session_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
```

**Run:**
```bash
supabase migration up
```

**Expected outcome:** All tables created in PostgreSQL

---

### Task 2.3: Create Seed Data

**File:** `supabase/seed.sql`

```sql
-- Insert test restaurant
INSERT INTO restaurants (name, slug, currency, timezone, active)
VALUES ('The Green Bar', 'the-green-bar', 'EUR', 'Europe/Athens', true)
RETURNING id;

-- Store restaurant ID in variable (you'll need to do this manually or via script)
-- For now, hardcode the UUID returned above

-- Insert test tables (assuming restaurant_id = <UUID>)
INSERT INTO restaurant_tables (restaurant_id, name, qr_token, active)
VALUES 
  ('<restaurant_id>', 'Table 1', 'X7k91Lm', true),
  ('<restaurant_id>', 'Table 2', 'Pq83Za1', true),
  ('<restaurant_id>', 'Table 3', 'V9k2Hn8', true);

-- Insert menu categories
INSERT INTO menu_categories (restaurant_id, name, sort_order)
VALUES 
  ('<restaurant_id>', 'Food', 1),
  ('<restaurant_id>', 'Drinks', 2);

-- Insert menu items
INSERT INTO menu_items (restaurant_id, category_id, name, description, price, available)
SELECT 
  '<restaurant_id>',
  id,
  CASE WHEN name = 'Food' THEN 'Burger' ELSE 'Mythos' END,
  CASE WHEN name = 'Food' THEN 'Beef burger with fries' ELSE 'Greek lager' END,
  CASE WHEN name = 'Food' THEN 12.00 ELSE 4.00 END,
  true
FROM menu_categories
WHERE restaurant_id = '<restaurant_id>';
```

**Run:**
```bash
psql $DATABASE_URL -f supabase/seed.sql
```

**Expected outcome:** Test data populated for local development

---

### Task 2.4: Implement Row-Level Security (RLS)

**File:** `supabase/migrations/002_rls_policies.sql`

```sql
-- Enable RLS on all tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history ENABLE ROW LEVEL SECURITY;

-- Restaurant users: only OWNER can see all restaurant_users
CREATE POLICY "Users can view their restaurant users"
  ON restaurant_users FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM restaurant_users
      WHERE user_id = auth.uid() AND role = 'OWNER'
    )
  );

-- Menu items: authenticated users of restaurant can view
CREATE POLICY "Restaurant staff can view menu items"
  ON menu_items FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM restaurant_users
      WHERE user_id = auth.uid()
    )
  );

-- Orders: only restaurant staff can view orders for their restaurant
CREATE POLICY "Restaurant staff can view orders"
  ON orders FOR SELECT
  USING (
    restaurant_id IN (
      SELECT restaurant_id FROM restaurant_users
      WHERE user_id = auth.uid()
    )
  );

-- Similar policies for all other tables...
-- (Full implementation in actual migration file)
```

**Run:**
```bash
supabase migration up
```

**Expected outcome:** RLS policies enforced on all tables

---

## Part 3: Backend Core (Day 6–8)

### Task 3.1: Setup Next.js Project Structure

**What to do:**
```bash
mkdir -p src/app/{(public)/t/[token],platform,admin,api}
mkdir -p src/{components,lib,types,utils}
mkdir -p src/lib/{supabase,auth,orders,menu,validation}
```

**Expected outcome:** Project structure organized per spec

---

### Task 3.2: Create Supabase Client Utilities

**File:** `src/lib/supabase/client.ts`

```typescript
import { createBrowserClient } from '@supabase/ssr'

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
```

**File:** `src/lib/supabase/server.ts`

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const createServerSupabaseClient = async () => {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        },
      },
    }
  )
}
```

**Expected outcome:** Supabase clients for browser and server

---

### Task 3.3: Create TypeScript Types

**File:** `src/types/index.ts`

```typescript
export type Restaurant = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  address: string | null
  currency: string
  timezone: string
  active: boolean
  created_at: string
  updated_at: string
}

export type MenuItem = {
  id: string
  category_id: string
  restaurant_id: string
  name: string
  description: string | null
  price: number
  image_url: string | null
  available: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export type Order = {
  id: string
  restaurant_id: string
  table_id: string
  session_id: string
  status: 'NEW' | 'ACCEPTED' | 'PREPARING' | 'READY' | 'SERVED' | 'REJECTED' | 'CANCELLED'
  subtotal: number
  total: number
  currency: string
  customer_note: string | null
  created_at: string
  updated_at: string
}

export type OrderItem = {
  id: string
  order_id: string
  menu_item_id: string
  item_name: string
  quantity: number
  unit_price: number
  notes: string | null
  created_at: string
}

export type UserRole = 'OWNER' | 'MANAGER' | 'STAFF'
```

**Expected outcome:** Type definitions for all major entities

---

### Task 3.4: Create Zod Validation Schemas

**File:** `src/lib/validation/orders.ts`

```typescript
import { z } from 'zod'

export const createOrderSchema = z.object({
  items: z.array(
    z.object({
      menuItemId: z.string().uuid(),
      quantity: z.number().int().min(1).max(50),
      notes: z.string().max(500).optional(),
    })
  ).min(1),
  customerNote: z.string().max(1000).optional(),
  idempotencyKey: z.string().uuid(),
})

export type CreateOrderInput = z.infer<typeof createOrderSchema>
```

**Expected outcome:** Validation schemas for all critical inputs

---

### Task 3.5: Create API Routes — QR Validation

**File:** `src/app/api/qr/validate/route.ts`

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  const { data: table, error } = await supabase
    .from('restaurant_tables')
    .select('*, restaurants(*)')
    .eq('qr_token', token)
    .eq('active', true)
    .single()

  if (error || !table) {
    return NextResponse.json(
      { error: 'Invalid or expired QR code' },
      { status: 404 }
    )
  }

  // Create or get dining session
  const { data: session } = await supabase
    .from('dining_sessions')
    .insert({
      restaurant_id: table.restaurant_id,
      table_id: table.id,
      status: 'ACTIVE',
    })
    .select()
    .single()

  return NextResponse.json({
    restaurant: table.restaurants,
    table: { id: table.id, name: table.name },
    session: session,
  })
}
```

**Expected outcome:** QR validation API working

---

### Task 3.6: Create API Routes — Menu Retrieval

**File:** `src/app/api/menu/route.ts`

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 400 })
  }

  const supabase = await createServerSupabaseClient()

  // Validate token exists and is active
  const { data: table } = await supabase
    .from('restaurant_tables')
    .select('restaurant_id')
    .eq('qr_token', token)
    .eq('active', true)
    .single()

  if (!table) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
  }

  // Fetch menu
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('*, menu_items(*)')
    .eq('restaurant_id', table.restaurant_id)
    .eq('active', true)
    .order('sort_order')

  return NextResponse.json({ categories })
}
```

**Expected outcome:** Menu API returning categories and items

---

### Task 3.7: Create Server Action — Order Creation

**File:** `src/lib/orders/actions.ts`

```typescript
'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createOrderSchema } from '@/lib/validation/orders'

export async function createOrder(input: unknown) {
  // Validate input
  const parsed = createOrderSchema.safeParse(input)
  if (!parsed.success) {
    return { error: 'Invalid input', details: parsed.error }
  }

  const supabase = await createServerSupabaseClient()
  const { items, customerNote, idempotencyKey } = parsed.data

  // Check for duplicate using idempotency key
  const { data: existingOrder } = await supabase
    .from('orders')
    .select('id')
    .eq('idempotency_key', idempotencyKey)
    .single()

  if (existingOrder) {
    return { orderId: existingOrder.id, duplicate: true }
  }

  try {
    // Validate and get current prices
    const { data: menuItems } = await supabase
      .from('menu_items')
      .select('id, price, available')
      .in('id', items.map(i => i.menuItemId))

    if (!menuItems || menuItems.length !== items.length) {
      return { error: 'Some items not found' }
    }

    // Calculate totals
    let subtotal = 0
    items.forEach(item => {
      const menuItem = menuItems.find(m => m.id === item.menuItemId)
      if (menuItem && menuItem.available) {
        subtotal += menuItem.price * item.quantity
      }
    })

    // Create order (transaction)
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        restaurant_id: '<from-session>', // Get from session
        table_id: '<from-session>',
        session_id: '<from-session>',
        subtotal,
        total: subtotal,
        currency: 'EUR',
        customer_note: customerNote,
        idempotency_key: idempotencyKey,
      })
      .select()
      .single()

    if (orderError || !order) {
      return { error: 'Failed to create order' }
    }

    // Create order items
    await supabase.from('order_items').insert(
      items.map(item => ({
        order_id: order.id,
        menu_item_id: item.menuItemId,
        item_name: '<from-menu>', // Get from menuItems
        quantity: item.quantity,
        unit_price: 0, // Get current price
        notes: item.notes,
      }))
    )

    return { orderId: order.id, success: true }
  } catch (error) {
    return { error: 'Server error during order creation' }
  }
}
```

**Expected outcome:** Order creation logic with validation and transactions

---

## Part 4: Frontend Pages (Day 9–11)

### Task 4.1: Customer Landing Page

**File:** `src/app/(public)/t/[token]/page.tsx`

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function TablePage({
  params,
}: {
  params: { token: string }
}) {
  const supabase = await createServerSupabaseClient()

  const { data: table } = await supabase
    .from('restaurant_tables')
    .select('*, restaurants(*), dining_sessions(*)')
    .eq('qr_token', params.token)
    .eq('active', true)
    .single()

  if (!table) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Invalid QR Code</h1>
          <p>Please ask a staff member for assistance.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white p-4">
      {table.restaurants?.logo_url && (
        <img
          src={table.restaurants.logo_url}
          alt="Restaurant"
          className="w-20 h-20 mb-4"
        />
      )}
      <h1 className="text-3xl font-bold mb-2">{table.restaurants?.name}</h1>
      <p className="text-gray-600 mb-8">Table {table.name}</p>
      <button className="bg-blue-600 text-white px-8 py-3 rounded-lg text-lg font-semibold">
        Start Order
      </button>
    </div>
  )
}
```

**Expected outcome:** QR landing page displaying restaurant and table

---

### Task 4.2: Menu Browsing Page

**File:** `src/app/(public)/t/[token]/menu/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { MenuItem } from '@/types'

export default function MenuPage({
  params,
}: {
  params: { token: string }
}) {
  const [categories, setCategories] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/menu?token=${params.token}`)
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories || [])
        setLoading(false)
      })
  }, [params.token])

  if (loading) return <div>Loading...</div>

  return (
    <div className="min-h-screen bg-white">
      {/* Category tabs */}
      <div className="sticky top-0 flex gap-2 overflow-x-auto p-4 bg-gray-50">
        {categories.map(cat => (
          <button
            key={cat.id}
            className="px-4 py-2 bg-white border rounded-full whitespace-nowrap"
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Items grid */}
      <div className="p-4 space-y-4">
        {categories.map(category => (
          <div key={category.id}>
            <h2 className="text-lg font-bold mb-3">{category.name}</h2>
            <div className="space-y-3">
              {category.menu_items.map((item: MenuItem) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-3 flex gap-3"
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      className="w-20 h-20 object-cover rounded"
                    />
                  )}
                  <div className="flex-1">
                    <h3 className="font-bold">{item.name}</h3>
                    {item.description && (
                      <p className="text-sm text-gray-600">{item.description}</p>
                    )}
                    <p className="font-bold text-lg mt-2">€{item.price.toFixed(2)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button>−</button>
                    <input type="text" value="1" className="w-8 text-center" />
                    <button>+</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Cart button (sticky) */}
      <div className="sticky bottom-0 p-4 bg-white border-t">
        <button className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold">
          View Cart (0 items)
        </button>
      </div>
    </div>
  )
}
```

**Expected outcome:** Mobile-first menu UI with categories and items

---

### Task 4.3: Shopping Cart

**File:** `src/app/(public)/t/[token]/cart/page.tsx`

```typescript
'use client'

import { useState } from 'react'
import { createOrder } from '@/lib/orders/actions'
import { v4 as uuidv4 } from 'uuid'

export default function CartPage({
  params,
}: {
  params: { token: string }
}) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)

  async function handleSubmit() {
    setLoading(true)

    const result = await createOrder({
      items: items.map(item => ({
        menuItemId: item.id,
        quantity: item.quantity,
        notes: item.notes,
      })),
      idempotencyKey: uuidv4(),
    })

    if (result.success) {
      // Redirect to order status page
      window.location.href = `/t/${params.token}/order/${result.orderId}`
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <h1 className="text-2xl font-bold mb-4">Review Order</h1>

      {items.length === 0 ? (
        <p className="text-gray-600">Your cart is empty</p>
      ) : (
        <>
          <div className="space-y-3 mb-8">
            {items.map((item, i) => (
              <div key={i} className="flex justify-between border-b pb-3">
                <div>
                  <p className="font-bold">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.quantity}x</p>
                </div>
                <p className="font-bold">€{(item.price * item.quantity).toFixed(2)}</p>
              </div>
            ))}
          </div>

          <div className="border-t pt-4 mb-4">
            <div className="flex justify-between text-lg font-bold">
              <span>Total</span>
              <span>€{total.toFixed(2)}</span>
            </div>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold disabled:bg-gray-400"
          >
            {loading ? 'Sending...' : 'Send Order'}
          </button>
        </>
      )}
    </div>
  )
}
```

**Expected outcome:** Shopping cart with order submission

---

### Task 4.4: Order Status Tracking

**File:** `src/app/(public)/t/[token]/order/[orderId]/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const STATUS_STEPS = [
  { status: 'NEW', label: 'Order received' },
  { status: 'ACCEPTED', label: 'Restaurant accepted' },
  { status: 'PREPARING', label: 'Preparing' },
  { status: 'READY', label: 'Ready' },
  { status: 'SERVED', label: 'Served' },
]

export default function OrderStatusPage({
  params,
}: {
  params: { orderId: string; token: string }
}) {
  const [order, setOrder] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to real-time updates
    const channel = supabase
      .channel(`order:${params.orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${params.orderId}`,
        },
        payload => {
          setOrder(payload.new)
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [params.orderId, supabase])

  if (!order) return <div>Loading...</div>

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.status === order.status)

  return (
    <div className="min-h-screen bg-white p-4">
      <h1 className="text-2xl font-bold mb-8">Order #{order.id.slice(0, 8)}</h1>

      {/* Status timeline */}
      <div className="space-y-4 mb-8">
        {STATUS_STEPS.map((step, i) => (
          <div key={step.status} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                  i <= currentStepIndex
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {i <= currentStepIndex ? '✓' : i + 1}
              </div>
              {i < STATUS_STEPS.length - 1 && (
                <div className={`w-1 h-8 ${i < currentStepIndex ? 'bg-green-600' : 'bg-gray-300'}`} />
              )}
            </div>
            <div className="flex-1">
              <p className={i <= currentStepIndex ? 'font-bold' : 'text-gray-600'}>
                {step.label}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Order details */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-sm text-gray-600">Total: €{order.total.toFixed(2)}</p>
      </div>
    </div>
  )
}
```

**Expected outcome:** Real-time order status tracking

---

## Part 5: Restaurant Dashboard (Day 12–14)

### Task 5.1: Restaurant Login

**File:** `src/app/(auth)/login/page.tsx`

```typescript
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
    } else {
      router.push('/platform')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 bg-white rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-6">Restaurant Login</h1>

        {error && <div className="bg-red-50 text-red-700 p-3 rounded mb-4">{error}</div>}

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2 border rounded-lg"
            required
          />
        </div>

        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold"
        >
          Sign In
        </button>
      </form>
    </div>
  )
}
```

**Expected outcome:** Restaurant staff can log in with email/password

---

### Task 5.2: Orders Dashboard

**File:** `src/app/platform/orders/page.tsx`

```typescript
'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function OrdersDashboard() {
  const [orders, setOrders] = useState<any[]>([])
  const supabase = createClient()

  useEffect(() => {
    // Subscribe to new orders
    const channel = supabase
      .channel('orders')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders',
        },
        payload => {
          setOrders(prev => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [supabase])

  async function updateOrderStatus(orderId: string, newStatus: string) {
    await supabase
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId)
  }

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-8">Active Orders</h1>

      <div className="grid gap-4">
        {orders.map(order => (
          <div
            key={order.id}
            className="border rounded-lg p-6 bg-white shadow"
          >
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">TABLE {order.table_id}</h2>
                <p className="text-gray-600">{new Date(order.created_at).toLocaleTimeString()}</p>
              </div>
              <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-bold">
                {order.status}
              </span>
            </div>

            {/* Order items would be displayed here */}

            <div className="border-t pt-4 mb-4">
              <p className="text-xl font-bold">€{order.total.toFixed(2)}</p>
            </div>

            <div className="flex gap-2">
              {order.status === 'NEW' && (
                <>
                  <button
                    onClick={() => updateOrderStatus(order.id, 'ACCEPTED')}
                    className="flex-1 bg-green-600 text-white py-2 rounded font-bold"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => updateOrderStatus(order.id, 'REJECTED')}
                    className="flex-1 bg-red-600 text-white py-2 rounded font-bold"
                  >
                    Reject
                  </button>
                </>
              )}
              {order.status === 'ACCEPTED' && (
                <button
                  onClick={() => updateOrderStatus(order.id, 'PREPARING')}
                  className="w-full bg-blue-600 text-white py-2 rounded font-bold"
                >
                  Start Preparing
                </button>
              )}
              {order.status === 'PREPARING' && (
                <button
                  onClick={() => updateOrderStatus(order.id, 'READY')}
                  className="w-full bg-purple-600 text-white py-2 rounded font-bold"
                >
                  Mark Ready
                </button>
              )}
              {order.status === 'READY' && (
                <button
                  onClick={() => updateOrderStatus(order.id, 'SERVED')}
                  className="w-full bg-green-600 text-white py-2 rounded font-bold"
                >
                  Mark Served
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Expected outcome:** Real-time order dashboard for restaurant staff

---

## Part 6: Testing & Hardening (Day 15–18)

### Task 6.1: Unit Tests

**File:** `src/lib/orders/__tests__/validation.test.ts`

```typescript
import { describe, it, expect } from 'vitest'
import { createOrderSchema } from '@/lib/validation/orders'

describe('Order Validation', () => {
  it('should validate correct order', () => {
    const input = {
      items: [{ menuItemId: '123e4567', quantity: 2, notes: 'No onions' }],
      idempotencyKey: '987e6543',
    }
    const result = createOrderSchema.safeParse(input)
    expect(result.success).toBe(true)
  })

  it('should reject zero quantity', () => {
    const input = {
      items: [{ menuItemId: '123e4567', quantity: 0 }],
      idempotencyKey: '987e6543',
    }
    const result = createOrderSchema.safeParse(input)
    expect(result.success).toBe(false)
  })

  it('should reject quantity over 50', () => {
    const input = {
      items: [{ menuItemId: '123e4567', quantity: 51 }],
      idempotencyKey: '987e6543',
    }
    const result = createOrderSchema.safeParse(input)
    expect(result.success).toBe(false)
  })
})
```

**Run:** `npm run test`

**Expected outcome:** Validation logic tested and passing

---

### Task 6.2: E2E Test

**File:** `tests/e2e/customer-flow.spec.ts`

```typescript
import { test, expect } from '@playwright/test'

test('Complete customer ordering flow', async ({ page }) => {
  // 1. Scan QR (navigate to table page)
  await page.goto('/t/X7k91Lm')
  await expect(page.locator('h1')).toContainText('The Green Bar')
  await page.click('button:has-text("Start Order")')

  // 2. Browse menu
  await expect(page.locator('h2')).toContainText('Food')
  const burgerButton = page.locator('text=Burger')
  await expect(burgerButton).toBeVisible()

  // 3. Add to cart
  await page.click('button:has-text("+")')
  await expect(page.locator('input[type="text"]')).toHaveValue('1')

  // 4. Submit order
  await page.click('button:has-text("Send Order")')

  // 5. See order status
  await expect(page.locator('text=Order received')).toBeVisible()

  // 6. Status updates (simulate restaurant accepting)
  await page.waitForTimeout(2000)
  // In real test, would update backend
  await expect(page.locator('text=Restaurant accepted')).toBeVisible()
})
```

**Run:** `npx playwright test`

**Expected outcome:** End-to-end customer flow validated

---

### Task 6.3: Add Rate Limiting

**File:** `src/lib/utils/rateLimit.ts`

```typescript
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export function rateLimit(ip: string, maxRequests = 20, windowMs = 10 * 60 * 1000) {
  const now = Date.now()
  const record = requestCounts.get(ip)

  if (!record || now > record.resetTime) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }

  if (record.count >= maxRequests) {
    return false
  }

  record.count++
  return true
}
```

**Expected outcome:** Rate limiting prevents abuse on public endpoints

---

### Task 6.4: Add Error Logging

**File:** `src/lib/utils/logger.ts`

```typescript
export function logError(message: string, error: any, context?: Record<string, any>) {
  // In production, send to Sentry or similar
  console.error(message, {
    error: error.message || String(error),
    stack: error.stack,
    ...context,
  })

  // Optionally send to monitoring service
  // await fetch('/api/logs', { method: 'POST', body: JSON.stringify(...) })
}
```

**Expected outcome:** Errors logged and trackable

---

## Part 7: Deployment & Pilot (Day 19+)

### Task 7.1: Deploy to Vercel

**What to do:**
- [ ] Push code to main branch
- [ ] Vercel auto-deploys
- [ ] Set production environment variables in Vercel
- [ ] Test production deployment

**Expected outcome:** MVP live at production URL

---

### Task 7.2: Onboard First Restaurant

**What to do:**
- [ ] Create restaurant account
- [ ] Add 5–10 test tables
- [ ] Upload sample menu (5–10 items)
- [ ] Print QR codes and place on test tables
- [ ] Train restaurant staff on dashboard
- [ ] Monitor for errors

**Expected outcome:** Pilot restaurant using platform

---

### Task 7.3: Gather Feedback

**What to do:**
- [ ] Weekly check-ins with restaurant
- [ ] Monitor error logs
- [ ] Track UX issues
- [ ] Document improvement requests
- [ ] Fix critical bugs immediately

**Expected outcome:** Real-world validation and rapid iteration

---

## Summary

**Total estimated effort:** 3–4 weeks of focused development
**Critical path:** Infrastructure → DB → Auth → Customer ordering → Dashboard → Testing

**Success criteria:**
- ✅ Customer can scan QR, browse menu, place order (< 2 seconds load)
- ✅ Restaurant receives order instantly via real-time dashboard
- ✅ Order status updates propagate to customer < 500ms
- ✅ All data protected by RLS
- ✅ Zero production secrets exposed
- ✅ Pilot restaurant successfully using platform

Once this MVP is validated with pilot restaurants, expansion to payments, POS integration, and analytics becomes straightforward.

---

**Next immediate action:** Start with Task 1.1 (Repository Setup)
