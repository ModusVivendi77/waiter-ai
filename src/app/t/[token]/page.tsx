import { notFound } from 'next/navigation'

import { TableOrderingExperience } from '@/components/public/table-ordering-experience'
import { createAdminClient } from '@/lib/supabase/server'

type Props = {
  params: Promise<{
    token: string
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
  description: string | null
  sort_order: number
}

type MenuItemRow = {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  available: boolean
  sort_order: number
}

export const dynamic = 'force-dynamic'

export default async function TableTokenPage({ params }: Props) {
  const { token } = await params
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

  const [{ data: categories, error: categoriesError }, { data: items, error: itemsError }] = await Promise.all([
    admin
      .from('menu_categories')
      .select('id, name, description, sort_order')
      .eq('restaurant_id', typedTable.restaurant_id)
      .eq('active', true)
      .order('sort_order'),
    admin
      .from('menu_items')
      .select('id, category_id, name, description, price, available, sort_order')
      .eq('restaurant_id', typedTable.restaurant_id)
      .eq('available', true)
      .order('sort_order'),
  ])

  if (categoriesError || itemsError) {
    notFound()
  }

  return (
    <TableOrderingExperience
      token={token}
      restaurantName={restaurant?.name ?? 'Restaurant'}
      tableName={typedTable.name}
      currency={restaurant?.currency ?? 'EUR'}
      categories={(categories as CategoryRow[]) || []}
      items={(items as MenuItemRow[]) || []}
    />
  )
}
