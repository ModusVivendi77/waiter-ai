import { notFound } from 'next/navigation'

import { TableOrderingExperience } from '@/components/public/table-ordering-experience'
import { createAdminClient } from '@/lib/supabase/server'

type Props = {
  params: Promise<{
    token: string
  }>
  searchParams: Promise<{
    reorder?: string
  }>
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

type CategoryRow = {
  id: string
  name: string
  name_el: string | null
  description: string | null
  description_el: string | null
  sort_order: number
}

type MenuItemRow = {
  id: string
  category_id: string
  name: string
  name_el: string | null
  description: string | null
  description_el: string | null
  price: number
  available: boolean
  sort_order: number
  allergens: string[]
  menu_item_modifiers:
    | Array<{
        id: string
        name: string
        price_delta: number
        active: boolean
      }>
    | null
}

export const dynamic = 'force-dynamic'

export default async function TableTokenPage({ params, searchParams }: Props) {
  const { token } = await params
  const { reorder } = await searchParams
  const admin = createAdminClient()

  const { data: table, error: tableError } = await admin
    .from('restaurant_tables')
    .select('id, name, restaurant_id, restaurants(name, currency)')
    .eq('qr_token', token)
    .eq('active', true)
    .maybeSingle()

  if (tableError || !table) {
    notFound()
  }

  const typedTable = table as TableRow
  const restaurant = Array.isArray(typedTable.restaurants) ? typedTable.restaurants[0] : typedTable.restaurants

  // Prefer the bilingual columns (`name_el`/`description_el`). They exist only
  // after migration 015 — on a DB where the migration hasn't been applied yet
  // the select fails with Postgres error 42703, so retry without those columns
  // (the component then falls back to the default English text).
  const fetchCategories = async (): Promise<CategoryRow[] | null> => {
    const withEl = await admin
      .from('menu_categories')
      .select('id, name, name_el, description, description_el, sort_order')
      .eq('restaurant_id', typedTable.restaurant_id)
      .eq('active', true)
      .order('sort_order')
    if (withEl.error && withEl.error.code === '42703') {
      const base = await admin
        .from('menu_categories')
        .select('id, name, description, sort_order')
        .eq('restaurant_id', typedTable.restaurant_id)
        .eq('active', true)
        .order('sort_order')
      if (base.error) return null
      return (base.data as CategoryRow[]) || []
    }
    if (withEl.error) return null
    return (withEl.data as CategoryRow[]) || []
  }

  const fetchItems = async (): Promise<MenuItemRow[] | null> => {
    const withEl = await admin
      .from('menu_items')
      .select('id, category_id, name, name_el, description, description_el, price, available, sort_order, allergens, menu_item_modifiers(id, name, price_delta, active)')
      .eq('restaurant_id', typedTable.restaurant_id)
      .eq('available', true)
      .order('sort_order')
    if (withEl.error && withEl.error.code === '42703') {
      const base = await admin
        .from('menu_items')
        .select('id, category_id, name, description, price, available, sort_order, allergens, menu_item_modifiers(id, name, price_delta, active)')
        .eq('restaurant_id', typedTable.restaurant_id)
        .eq('available', true)
        .order('sort_order')
      if (base.error) return null
      return (base.data as MenuItemRow[]) || []
    }
    if (withEl.error) return null
    return (withEl.data as MenuItemRow[]) || []
  }

  const [categories, items] = await Promise.all([fetchCategories(), fetchItems()])

  if (!categories || !items) {
    notFound()
  }

  return (
    <TableOrderingExperience
      token={token}
      reorderToken={reorder || null}
      restaurantName={restaurant?.name ?? 'Restaurant'}
      tableName={typedTable.name}
      currency={restaurant?.currency ?? 'EUR'}
      categories={(categories as CategoryRow[]) || []}
      items={(items as MenuItemRow[]) || []}
    />
  )
}
