'use client'

import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'

import { getClientUserContext } from '@/lib/auth/client'
import { listTeamMembers } from '@/lib/auth/team-actions'
import { parseCsvRows, type CsvPreviewRow } from '@/lib/csv/menu-import'
import { createClient } from '@/lib/supabase/client'

type RestaurantTable = {
  id: string
  name: string
  qr_token: string
  active: boolean
  assigned_staff_id: string | null
}

type Category = {
  id: string
  name: string
}

type RestaurantOption = {
  id: string
  name: string
}

type MenuItem = {
  id: string
  name: string
  description: string | null
  price: number
  available: boolean
  category_id: string
  allergens: string[]
  menu_item_modifiers:
    | Array<{
        id: string
        name: string
        price_delta: number
        active: boolean
      }>
    | null
  menu_categories?:
    | {
        name: string
      }
    | Array<{
        name: string
      }>
    | null
}

function createQrToken() {
  const random = crypto.getRandomValues(new Uint8Array(8))
  return Array.from(random, (value) => value.toString(36)).join('').slice(0, 10)
}

function getCategoryName(item: MenuItem) {
  const category = Array.isArray(item.menu_categories) ? item.menu_categories[0] : item.menu_categories
  return category?.name || 'Uncategorized'
}

type ParsedModifier = {
  name: string
  price_delta: number
}

// Parses modifier lines like "Extra cheese +1.50" / "Bacon +2" / "Gluten-free bun".
function parseModifiersText(text: string): ParsedModifier[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)\s+([+\-]?\d+(?:\.\d{1,2})?)\s*$/)
      if (match) {
        return { name: match[1].trim(), price_delta: Math.max(0, Number(match[2])) }
      }
      return { name: line, price_delta: 0 }
    })
}

function modifiersToText(modifiers: Array<{ name: string; price_delta: number }>): string {
  return modifiers
    .map((modifier) =>
      Number(modifier.price_delta) > 0
        ? `${modifier.name} +${Number(modifier.price_delta).toFixed(2)}`
        : modifier.name
    )
    .join('\n')
}

function parseAllergensText(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
}

export function RestaurantSetupConsole() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [restaurantId, setRestaurantId] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false)
  const [restaurantOptions, setRestaurantOptions] = useState<RestaurantOption[]>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [tables, setTables] = useState<RestaurantTable[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [items, setItems] = useState<MenuItem[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tableName, setTableName] = useState('')
  const [categoryName, setCategoryName] = useState('')
  const [itemName, setItemName] = useState('')
  const [itemDescription, setItemDescription] = useState('')
  const [itemPrice, setItemPrice] = useState('')
  const [itemCategoryId, setItemCategoryId] = useState('')
  const [itemAllergens, setItemAllergens] = useState('')
  const [itemModifiersText, setItemModifiersText] = useState('')
  const [csvText, setCsvText] = useState('')
  const [csvReport, setCsvReport] = useState<string | null>(null)
  const [csvPreviewRows, setCsvPreviewRows] = useState<CsvPreviewRow[]>([])
  const [csvPreviewSource, setCsvPreviewSource] = useState('')
  const [qrDownloadingFor, setQrDownloadingFor] = useState<string | null>(null)
  const [qrSvgMap, setQrSvgMap] = useState<Record<string, string>>({})
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editingTableName, setEditingTableName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemName, setEditingItemName] = useState('')
  const [editingItemDescription, setEditingItemDescription] = useState('')
  const [editingItemPrice, setEditingItemPrice] = useState('')
  const [editingItemCategoryId, setEditingItemCategoryId] = useState('')
  const [editingItemAllergens, setEditingItemAllergens] = useState('')
  const [editingItemModifiersText, setEditingItemModifiersText] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const [quickDrafts, setQuickDrafts] = useState<Record<string, { name: string; price: string }>>({})
  const [staffOptions, setStaffOptions] = useState<Array<{ id: string; name: string }>>([])

  const supabase = useMemo(() => createClient(), [])
  // QR URLs should point at the origin the staff member is actually using
  // (production on Vercel, localhost during local dev) — never hardcode localhost.
  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || 'https://waiter-ai-iota.vercel.app'

  async function loadData(restaurantOverrideId?: string) {
    const context = await getClientUserContext()

    if (!context.user) {
      router.replace('/login?next=/platform/setup')
      return
    }

    setIsPlatformAdmin(context.isPlatformAdmin)

    let activeRestaurantId: string | null = null
    let activeRestaurantName: string | null = null

    if (context.isPlatformAdmin) {
      const { data: restaurants, error: restaurantsError } = await supabase.from('restaurants').select('id, name').order('name')

      if (restaurantsError || !restaurants || restaurants.length === 0) {
        setError(restaurantsError?.message || 'No restaurants found for platform administration.')
        setLoading(false)
        return
      }

      const typedRestaurants = (restaurants as RestaurantOption[]) || []
      setRestaurantOptions(typedRestaurants)

      const savedRestaurantId = typeof window !== 'undefined' ? localStorage.getItem('platformAdminRestaurantId') || '' : ''
      const candidateId = restaurantOverrideId || selectedRestaurantId || savedRestaurantId || context.memberships[0]?.restaurantId || ''
      const selectedRestaurant = typedRestaurants.find((entry) => entry.id === candidateId) ?? typedRestaurants[0]

      activeRestaurantId = selectedRestaurant.id
      activeRestaurantName = selectedRestaurant.name
      setSelectedRestaurantId(selectedRestaurant.id)
      if (typeof window !== 'undefined') {
        localStorage.setItem('platformAdminRestaurantId', selectedRestaurant.id)
      }
    } else {
      const memberships = context.memberships.filter((entry) => entry.role === 'OWNER' || entry.role === 'MANAGER')
      if (memberships.length === 0) {
        setError('You need OWNER or MANAGER access to edit restaurant setup.')
        setLoading(false)
        return
      }

      const savedRestaurantId = typeof window !== 'undefined' ? localStorage.getItem('staffSetupRestaurantId') || '' : ''
      const candidateId = restaurantOverrideId || selectedRestaurantId || savedRestaurantId
      const selectedMembership = memberships.find((entry) => entry.restaurantId === candidateId) ?? memberships[0]

      if (memberships.length > 1) {
        setRestaurantOptions(memberships.map((entry) => ({ id: entry.restaurantId, name: entry.restaurantName })))
        setSelectedRestaurantId(selectedMembership.restaurantId)
        if (typeof window !== 'undefined') {
          localStorage.setItem('staffSetupRestaurantId', selectedMembership.restaurantId)
        }
      } else {
        setRestaurantOptions([])
        setSelectedRestaurantId('')
      }

      activeRestaurantId = selectedMembership.restaurantId
      activeRestaurantName = selectedMembership.restaurantName
    }

    setRestaurantId(activeRestaurantId)
    setRestaurantName(activeRestaurantName)

    const [{ data: tableRows, error: tableError }, { data: categoryRows, error: categoryError }, { data: itemRows, error: itemError }, staffResult] =
      await Promise.all([
        supabase
          .from('restaurant_tables')
          .select('id, name, qr_token, active, assigned_staff_id')
          .eq('restaurant_id', activeRestaurantId)
          .order('name'),
        supabase
          .from('menu_categories')
          .select('id, name')
          .eq('restaurant_id', activeRestaurantId)
          .order('sort_order'),
        supabase
          .from('menu_items')
          .select('id, name, description, price, available, category_id, allergens, menu_item_modifiers(id, name, price_delta, active), menu_categories(name)')
          .eq('restaurant_id', activeRestaurantId)
          .order('created_at', { ascending: false })
          .limit(50),
        listTeamMembers(activeRestaurantId).catch(() => ({ error: undefined, members: undefined })),
      ])

    setStaffOptions(
      (staffResult && staffResult.members
        ? staffResult.members.filter((member) => member.role === 'MANAGER' || member.role === 'STAFF')
        : []
      ).map((member) => ({ id: member.userId, name: member.email }))
    )

    if (tableError || categoryError || itemError) {
      setError(tableError?.message || categoryError?.message || itemError?.message || 'Failed to load setup data.')
    } else {
      const typedCategories = (categoryRows as Category[]) || []
      const typedItems = (itemRows as MenuItem[]) || []
      setTables((tableRows as RestaurantTable[]) || [])
      setCategories(typedCategories)
      setItems(typedItems)
      if (typedCategories.length > 0) {
        setItemCategoryId(typedCategories[0].id)
      }
      // Categories start expanded; quick-edit drafts mirror the loaded items.
      setExpandedCategories((current) => {
        const next = { ...current }
        typedCategories.forEach((category) => {
          if (!(category.id in next)) {
            next[category.id] = true
          }
        })
        return next
      })
      setQuickDrafts(
        Object.fromEntries(typedItems.map((item) => [item.id, { name: item.name, price: String(item.price) }]))
      )
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadData(searchParams.get('restaurantId') || undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadQrMarkup() {
      if (tables.length === 0) {
        setQrSvgMap({})
        return
      }

      const entries = await Promise.all(
        tables.map(async (table) => {
          const qrUrl = `${appUrl}/t/${table.qr_token}`
          const svg = await QRCode.toString(qrUrl, { type: 'svg', margin: 1, width: 256 })
          return [table.id, svg] as const
        })
      )

      if (!cancelled) {
        setQrSvgMap(Object.fromEntries(entries))
      }
    }

    void loadQrMarkup()

    return () => {
      cancelled = true
    }
  }, [appUrl, tables])

  async function handleRestaurantSelection(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    await loadData(nextRestaurantId)
  }

  async function handleDownloadQr(table: RestaurantTable) {
    setQrDownloadingFor(table.id)
    setError(null)
    setNotice(null)

    try {
      const svg = qrSvgMap[table.id] || (await QRCode.toString(`${appUrl}/t/${table.qr_token}`, { type: 'svg', margin: 1, width: 512 }))
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `${table.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'table'}-qr.svg`
      anchor.click()
      URL.revokeObjectURL(objectUrl)
      setNotice(`Downloaded QR SVG for ${table.name}.`)
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Failed to generate QR code.')
    } finally {
      setQrDownloadingFor(null)
    }
  }

  function handlePrintQrSheet() {
    window.print()
  }

  function handlePreviewCsv() {
    setError(null)
    setNotice(null)

    const { rows, errors } = parseCsvRows(csvText)
    setCsvPreviewRows(rows)
    setCsvPreviewSource(csvText)
    setCsvReport(errors.length > 0 ? errors.slice(0, 10).join('\n') : null)

    if (rows.length === 0) {
      setError(errors[0] || 'CSV must be in the format: category,name,description,price')
      return
    }

    setNotice(`Preview ready for ${rows.length} CSV row(s).`)
  }

  async function handleAddTable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !tableName.trim()) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const token = createQrToken()

    const { error: insertError } = await supabase.from('restaurant_tables').insert({
      restaurant_id: restaurantId,
      name: tableName.trim(),
      qr_token: token,
      active: true,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setTableName('')
    setNotice('Table created with a fresh QR token.')
    await loadData()
  }

  async function handleToggleTableActive(table: RestaurantTable) {
    if (!restaurantId) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('restaurant_tables')
      .update({ active: !table.active })
      .eq('id', table.id)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(`Table ${table.name} is now ${table.active ? 'inactive' : 'active'}.`)
    await loadData()
  }

  async function handleAssignTableStaff(tableId: string, staffId: string) {
    if (!restaurantId) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('restaurant_tables')
      .update({ assigned_staff_id: staffId || null })
      .eq('id', tableId)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice('Table assignment updated.')
    await loadData()
  }

  async function handleDeleteTable(table: RestaurantTable) {
    if (!restaurantId) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: deleteError } = await supabase
      .from('restaurant_tables')
      .delete()
      .eq('id', table.id)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setNotice(`Table ${table.name} deleted.`)
    await loadData()
  }

  async function handleSaveTableName(tableId: string) {
    if (!restaurantId || !editingTableName.trim()) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('restaurant_tables')
      .update({ name: editingTableName.trim() })
      .eq('id', tableId)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEditingTableId(null)
    setEditingTableName('')
    setNotice('Table name updated.')
    await loadData()
  }

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !categoryName.trim()) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const sortOrder = categories.length + 1
    const { error: insertError } = await supabase.from('menu_categories').insert({
      restaurant_id: restaurantId,
      name: categoryName.trim(),
      sort_order: sortOrder,
      active: true,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setCategoryName('')
    setNotice('Category created.')
    await loadData()
  }

  async function handleDeleteCategory(category: Category) {
    if (!restaurantId) {
      return
    }

    const hasLinkedItems = items.some((item) => item.category_id === category.id)
    if (hasLinkedItems) {
      setError('Cannot delete this category while menu items still reference it.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: deleteError } = await supabase
      .from('menu_categories')
      .delete()
      .eq('id', category.id)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setNotice(`Category ${category.name} deleted.`)
    await loadData()
  }

  async function handleSaveCategoryName(categoryId: string) {
    if (!restaurantId || !editingCategoryName.trim()) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('menu_categories')
      .update({ name: editingCategoryName.trim() })
      .eq('id', categoryId)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEditingCategoryId(null)
    setEditingCategoryName('')
    setNotice('Category name updated.')
    await loadData()
  }

  async function handleAddMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !itemName.trim() || !itemCategoryId || !itemPrice) {
      return
    }

    const numericPrice = Number(itemPrice)
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setError('Price must be a valid positive number.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { data: createdItem, error: insertError } = await supabase
      .from('menu_items')
      .insert({
        restaurant_id: restaurantId,
        category_id: itemCategoryId,
        name: itemName.trim(),
        description: itemDescription.trim() || null,
        price: numericPrice,
        available: true,
        allergens: parseAllergensText(itemAllergens),
      })
      .select('id')
      .single()

    setSaving(false)

    if (insertError || !createdItem) {
      setError(insertError?.message ?? 'Unable to create the menu item.')
      return
    }

    const modifiers = parseModifiersText(itemModifiersText)
    if (modifiers.length > 0) {
      const { error: modifiersError } = await supabase.from('menu_item_modifiers').insert(
        modifiers.map((modifier) => ({
          menu_item_id: createdItem.id,
          name: modifier.name,
          price_delta: modifier.price_delta,
        }))
      )
      if (modifiersError) {
        setError(modifiersError.message)
        return
      }
    }

    setItemName('')
    setItemDescription('')
    setItemPrice('')
    setItemAllergens('')
    setItemModifiersText('')
    setNotice('Menu item created.')
    await loadData()
  }

  async function handleToggleMenuItemAvailability(item: MenuItem) {
    if (!restaurantId) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({ available: !item.available })
      .eq('id', item.id)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(`${item.name} is now ${item.available ? 'unavailable' : 'available'}.`)
    await loadData()
  }

  async function handleDeleteMenuItem(item: MenuItem) {
    if (!restaurantId) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: deleteError } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', item.id)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (deleteError) {
      setError(deleteError.message)
      return
    }

    setNotice(`Menu item ${item.name} deleted.`)
    await loadData()
  }

  async function handleSaveMenuItem(itemId: string) {
    if (!restaurantId || !editingItemName.trim() || !editingItemCategoryId || !editingItemPrice) {
      return
    }

    const numericPrice = Number(editingItemPrice)
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setError('Price must be a valid positive number.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({
        name: editingItemName.trim(),
        description: editingItemDescription.trim() || null,
        price: numericPrice,
        category_id: editingItemCategoryId,
        allergens: parseAllergensText(editingItemAllergens),
      })
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId)

    if (updateError) {
      setSaving(false)
      setError(updateError.message)
      return
    }

    // Sync modifiers: delete the current set and insert the edited one.
    const modifiers = parseModifiersText(editingItemModifiersText)
    const { error: deleteModifiersError } = await supabase
      .from('menu_item_modifiers')
      .delete()
      .eq('menu_item_id', itemId)

    if (deleteModifiersError) {
      setSaving(false)
      setError(deleteModifiersError.message)
      return
    }

    if (modifiers.length > 0) {
      const { error: insertModifiersError } = await supabase.from('menu_item_modifiers').insert(
        modifiers.map((modifier) => ({
          menu_item_id: itemId,
          name: modifier.name,
          price_delta: modifier.price_delta,
        }))
      )

      if (insertModifiersError) {
        setSaving(false)
        setError(insertModifiersError.message)
        return
      }
    }

    setSaving(false)

    setEditingItemId(null)
    setEditingItemName('')
    setEditingItemDescription('')
    setEditingItemPrice('')
    setEditingItemCategoryId('')
    setEditingItemAllergens('')
    setEditingItemModifiersText('')
    setNotice('Menu item updated.')
    await loadData()
  }

  function toggleCategory(categoryId: string) {
    setExpandedCategories((current) => ({ ...current, [categoryId]: !current[categoryId] }))
  }

  function updateQuickDraft(itemId: string, field: 'name' | 'price', value: string) {
    setQuickDrafts((current) => ({ ...current, [itemId]: { ...current[itemId], [field]: value } }))
  }

  // Quick inline save for name + price straight from the category table.
  async function handleQuickSaveItem(item: MenuItem) {
    if (!restaurantId) return

    const draft = quickDrafts[item.id]
    const price = Number(draft?.price)
    if (!draft?.name.trim() || Number.isNaN(price) || price < 0) {
      setError('A name and a valid price are required.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({ name: draft.name.trim(), price })
      .eq('id', item.id)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setNotice(`${item.name} updated.`)
    await loadData()
  }

  function openItemDetails(item: MenuItem) {
    if (expandedItemId === item.id) {
      setExpandedItemId(null)
      return
    }
    setExpandedItemId(item.id)
    setEditingItemId(item.id)
    setEditingItemName(item.name)
    setEditingItemDescription(item.description || '')
    setEditingItemPrice(String(item.price))
    setEditingItemCategoryId(item.category_id)
    setEditingItemAllergens((item.allergens || []).join(', '))
    setEditingItemModifiersText(modifiersToText(item.menu_item_modifiers || []))
  }

  async function handleCsvImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !csvText.trim()) {
      return
    }

    if (csvPreviewSource !== csvText || csvPreviewRows.length === 0) {
      setError('Preview the CSV before importing.')
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const parsedRows = csvPreviewRows

    const uniqueCategoryNames = Array.from(new Set(parsedRows.map((row) => row.category)))

    const { error: categoryUpsertError } = await supabase.from('menu_categories').upsert(
      uniqueCategoryNames.map((name, index) => ({
        restaurant_id: restaurantId,
        name,
        sort_order: index + 1,
        active: true,
      })),
      { onConflict: 'restaurant_id,name' }
    )

    if (categoryUpsertError) {
      setSaving(false)
      setError(categoryUpsertError.message)
      return
    }

    const { data: refreshedCategories, error: categoryFetchError } = await supabase
      .from('menu_categories')
      .select('id, name')
      .eq('restaurant_id', restaurantId)

    if (categoryFetchError || !refreshedCategories) {
      setSaving(false)
      setError(categoryFetchError?.message || 'Failed to refresh categories after CSV import.')
      return
    }

    const categoryMap = new Map(refreshedCategories.map((category) => [category.name, category.id]))

    const { data: existingItems, error: existingItemsError } = await supabase
      .from('menu_items')
      .select('category_id, name')
      .eq('restaurant_id', restaurantId)

    if (existingItemsError) {
      setSaving(false)
      setError(existingItemsError.message)
      return
    }

    const existingKeys = new Set(
      ((existingItems as Array<{ category_id: string; name: string }>) || []).map(
        (row) => `${row.category_id}::${row.name.toLowerCase()}`
      )
    )

    const rowsToInsert = parsedRows
      .map((row) => ({
        restaurant_id: restaurantId,
        category_id: categoryMap.get(row.category),
        name: row.name,
        description: row.description || null,
        price: row.price,
        available: true,
      }))
      .filter((row) => Boolean(row.category_id))
      .filter((row) => {
        const key = `${row.category_id as string}::${row.name.toLowerCase()}`
        if (existingKeys.has(key)) {
          return false
        }
        existingKeys.add(key)
        return true
      })

    if (rowsToInsert.length === 0) {
      setSaving(false)
      setNotice('No new menu items imported. All parsed rows already exist.')
      return
    }

    const { error: itemInsertError } = await supabase.from('menu_items').insert(rowsToInsert)

    setSaving(false)

    if (itemInsertError) {
      setError(itemInsertError.message)
      return
    }

    setCsvText('')
    setCsvPreviewRows([])
    setCsvPreviewSource('')
    const skipped = parsedRows.length - rowsToInsert.length
    setNotice(`Imported ${rowsToInsert.length} rows from CSV.${skipped > 0 ? ` Skipped ${skipped} duplicate row(s).` : ''}`)
    setCsvReport(null)
    await loadData()
  }

  if (loading) {
    return (
      <section className="panel stack">
        <span className="eyebrow">Restaurant Setup</span>
        <h2 className="section-title">Loading setup workspace...</h2>
      </section>
    )
  }

  return (
    <>
      <section className="panel stack">
        <span className="eyebrow">Phase 4</span>
        <h1 className="section-title">Restaurant setup workspace</h1>
        <p className="lead">
          Configure tables, generate QR links, and manage categories and menu items for
          {restaurantName ? ` ${restaurantName}` : ' your restaurant'}.
        </p>
        {restaurantOptions.length > 0 ? (
          <div className="field">
            <label htmlFor="adminRestaurantSelector">
              {isPlatformAdmin ? 'Restaurant context (SUPER_ADMIN)' : 'Restaurant context'}
            </label>
            <select
              id="adminRestaurantSelector"
              value={selectedRestaurantId}
              onChange={(event) => void handleRestaurantSelection(event.target.value)}
              disabled={saving}
            >
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {notice ? <div className="success">{notice}</div> : null}
        {error ? <div className="error-box">{error}</div> : null}
      </section>

      <section className="panel stack">
        <span className="eyebrow">Tables & QR</span>
        <form className="stack" onSubmit={handleAddTable}>
          <div className="field">
            <label htmlFor="tableName">New table name</label>
            <input
              id="tableName"
              value={tableName}
              onChange={(event) => setTableName(event.target.value)}
              placeholder="Table 8"
              required
            />
          </div>
          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add table'}
          </button>
        </form>

        <ul className="list">
          {tables.map((table) => (
            <li key={table.id}>
              {editingTableId === table.id ? (
                <div className="field">
                  <label htmlFor={`edit-table-${table.id}`}>Table name</label>
                  <input
                    id={`edit-table-${table.id}`}
                    value={editingTableName}
                    onChange={(event) => setEditingTableName(event.target.value)}
                    required
                  />
                </div>
              ) : (
                <strong>{table.name}</strong>
              )}
              <p className="muted">Status: {table.active ? 'Active' : 'Inactive'}</p>
              <p className="muted">Token: {table.qr_token}</p>
              <p className="muted">QR URL: {`${appUrl}/t/${table.qr_token}`}</p>
              {staffOptions.length > 0 ? (
                <div className="field">
                  <label htmlFor={`assigned-staff-${table.id}`}>Assigned staff</label>
                  <select
                    id={`assigned-staff-${table.id}`}
                    value={table.assigned_staff_id ?? ''}
                    disabled={saving}
                    onChange={(event) => void handleAssignTableStaff(table.id, event.target.value)}
                  >
                    <option value="">— Unassigned —</option>
                    {staffOptions.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {editingTableId === table.id ? (
                  <>
                    <button className="button" type="button" disabled={saving} onClick={() => void handleSaveTableName(table.id)}>
                      Save name
                    </button>
                    <button
                      className="button"
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setEditingTableId(null)
                        setEditingTableName('')
                      }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <button
                    className="button"
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      setEditingTableId(table.id)
                      setEditingTableName(table.name)
                    }}
                  >
                    Rename
                  </button>
                )}
                <button className="button" type="button" disabled={saving} onClick={() => void handleToggleTableActive(table)}>
                  {table.active ? 'Deactivate' : 'Activate'}
                </button>
                <button className="button" type="button" disabled={saving} onClick={() => void handleDeleteTable(table)}>
                  Delete table
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={saving || qrDownloadingFor === table.id}
                  onClick={() => void handleDownloadQr(table)}
                >
                  {qrDownloadingFor === table.id ? 'Preparing QR...' : 'Download QR (SVG)'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">QR Sheet</span>
            <h2 className="section-title">Printable multi-table QR layout</h2>
          </div>
          <button className="button" type="button" onClick={handlePrintQrSheet} disabled={tables.length === 0}>
            Print QR sheet
          </button>
        </div>
        <div className="qr-sheet">
          {tables.map((table) => (
            <article className="qr-card" key={`sheet-${table.id}`}>
              <strong>{table.name}</strong>
              <div className="qr-svg" dangerouslySetInnerHTML={{ __html: qrSvgMap[table.id] || '' }} />
              <p className="muted">{`${appUrl}/t/${table.qr_token}`}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Menu</span>
        <p className="helper-text">
          Add items, then manage them per category. Use the table to quickly change names and prices, or expand an item
          to edit details like description, allergens, and options.
        </p>

        <span className="eyebrow" style={{ marginTop: '12px' }}>Add menu item</span>
        <form className="stack" onSubmit={handleAddMenuItem}>
          <div className="field">
            <label htmlFor="itemName">Item name</label>
            <input
              id="itemName"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder="Classic Burger"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="itemDescription">Description</label>
            <textarea
              id="itemDescription"
              value={itemDescription}
              onChange={(event) => setItemDescription(event.target.value)}
              placeholder="200g patty, brioche bun, fries"
            />
          </div>

          <div className="field">
            <label htmlFor="itemPrice">Price</label>
            <input
              id="itemPrice"
              type="number"
              step="0.01"
              min="0"
              value={itemPrice}
              onChange={(event) => setItemPrice(event.target.value)}
              placeholder="12.50"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="itemCategoryId">Category</label>
            <select
              id="itemCategoryId"
              value={itemCategoryId}
              onChange={(event) => setItemCategoryId(event.target.value)}
              required
            >
              <option value="" disabled>
                Select category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="itemAllergens">Allergens</label>
            <input
              id="itemAllergens"
              value={itemAllergens}
              onChange={(event) => setItemAllergens(event.target.value)}
              placeholder="Gluten, Dairy, Nuts (comma separated)"
            />
          </div>

          <div className="field">
            <label htmlFor="itemModifiersText">Options / modifiers</label>
            <textarea
              id="itemModifiersText"
              value={itemModifiersText}
              onChange={(event) => setItemModifiersText(event.target.value)}
              placeholder={'Extra cheese +1.50\nBacon +2.00\nGluten-free bun +1.00'}
            />
            <p className="helper-text">One option per line: "Name +price" (price optional).</p>
          </div>

          <button className="button" type="submit" disabled={saving || categories.length === 0}>
            {saving ? 'Saving...' : 'Add menu item'}
          </button>
        </form>

        <span className="eyebrow" style={{ marginTop: '16px' }}>Categories</span>
        <form className="stack" onSubmit={handleAddCategory}>
          <div className="field">
            <label htmlFor="categoryName">New category</label>
            <input
              id="categoryName"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder="Cocktails"
              required
            />
          </div>
          <button className="button-secondary" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add category'}
          </button>
        </form>


        {categories.map((category) => {
          const categoryItems = items.filter((item) => item.category_id === category.id)
          const isOpen = expandedCategories[category.id] !== false

          return (
            <div key={category.id} className="stack" style={{ marginTop: '16px' }}>
              <div className="cart-line-header">
                <div>
                  <strong>{category.name}</strong>
                  <p className="muted">{categoryItems.length} item(s)</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="button-secondary" type="button" disabled={saving} onClick={() => toggleCategory(category.id)}>
                    {isOpen ? 'Collapse' : 'Expand'}
                  </button>
                  {editingCategoryId === category.id ? (
                    <>
                      <input
                        id={`edit-category-${category.id}`}
                        value={editingCategoryName}
                        onChange={(event) => setEditingCategoryName(event.target.value)}
                        style={{ width: 140 }}
                        required
                      />
                      <button className="button-secondary" type="button" disabled={saving} onClick={() => void handleSaveCategoryName(category.id)}>
                        Save
                      </button>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(null)
                          setEditingCategoryName('')
                        }}
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setEditingCategoryId(category.id)
                        setEditingCategoryName(category.name)
                      }}
                    >
                      Rename
                    </button>
                  )}
                  <button className="button-danger" type="button" disabled={saving} onClick={() => void handleDeleteCategory(category)}>
                    Delete category
                  </button>
                </div>
              </div>

              {isOpen ? (
                categoryItems.length === 0 ? (
                  <p className="muted">No items in this category yet.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th style={{ width: 120 }}>Price</th>
                          <th style={{ width: 120 }}>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categoryItems.map((item) => (
                          <Fragment key={item.id}>
                            <tr>
                              <td>
                                <input
                                  value={quickDrafts[item.id]?.name ?? item.name}
                                  onChange={(event) => updateQuickDraft(item.id, 'name', event.target.value)}
                                  style={{ width: '100%', minHeight: 36 }}
                                />
                              </td>
                              <td>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={quickDrafts[item.id]?.price ?? String(item.price)}
                                  onChange={(event) => updateQuickDraft(item.id, 'price', event.target.value)}
                                  style={{ width: '100%', minHeight: 36 }}
                                />
                              </td>
                              <td>
                                <span className="badge">{item.available ? 'Available' : 'Unavailable'}</span>
                              </td>
                              <td>
                                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                  <button className="button-secondary" type="button" disabled={saving} onClick={() => void handleQuickSaveItem(item)}>
                                    Save
                                  </button>
                                  <button className="button-secondary" type="button" onClick={() => openItemDetails(item)}>
                                    {expandedItemId === item.id ? 'Close details' : 'Details'}
                                  </button>
                                  <button className="button-secondary" type="button" disabled={saving} onClick={() => void handleToggleMenuItemAvailability(item)}>
                                    {item.available ? 'Mark unavailable' : 'Mark available'}
                                  </button>
                                  <button className="button-danger" type="button" disabled={saving} onClick={() => void handleDeleteMenuItem(item)}>
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>

                            {expandedItemId === item.id ? (
                              <tr>
                                <td colSpan={4}>
                                  <div className="stack">
                                    <div className="field">
                                      <label htmlFor={`details-desc-${item.id}`}>Description</label>
                                      <textarea
                                        id={`details-desc-${item.id}`}
                                        value={editingItemDescription}
                                        onChange={(event) => setEditingItemDescription(event.target.value)}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`details-category-${item.id}`}>Category</label>
                                      <select
                                        id={`details-category-${item.id}`}
                                        value={editingItemCategoryId}
                                        onChange={(event) => setEditingItemCategoryId(event.target.value)}
                                      >
                                        {categories.map((option) => (
                                          <option key={option.id} value={option.id}>
                                            {option.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`details-allergens-${item.id}`}>Allergens</label>
                                      <input
                                        id={`details-allergens-${item.id}`}
                                        value={editingItemAllergens}
                                        onChange={(event) => setEditingItemAllergens(event.target.value)}
                                        placeholder="Gluten, Dairy, Nuts (comma separated)"
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`details-modifiers-${item.id}`}>Options / modifiers</label>
                                      <textarea
                                        id={`details-modifiers-${item.id}`}
                                        value={editingItemModifiersText}
                                        onChange={(event) => setEditingItemModifiersText(event.target.value)}
                                        placeholder={'Extra cheese +1.50\nBacon +2.00'}
                                      />
                                      <p className="helper-text">One option per line: "Name +price" (price optional).</p>
                                    </div>
                                    <div className="pill-row">
                                      <button className="button" type="button" disabled={saving} onClick={() => void handleSaveMenuItem(item.id)}>
                                        Save changes
                                      </button>
                                      <button className="button-secondary" type="button" onClick={() => setExpandedItemId(null)}>
                                        Close
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            ) : null}
                          </Fragment>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}
            </div>
          )
        })}
      </section>

      <section className="panel stack">
        <span className="eyebrow">CSV Import</span>
        <p className="helper-text">Paste CSV lines in this format: category,name,description,price. Quoted fields are supported.</p>
        <form className="stack" onSubmit={handleCsvImport}>
          <div className="field">
            <label htmlFor="csvText">CSV rows</label>
            <textarea
              id="csvText"
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value)
                setCsvPreviewRows([])
                setCsvPreviewSource('')
                setCsvReport(null)
              }}
              placeholder={'Food,Burger,Beef burger with fries,12.00\nDrinks,"Tonic, Zero","Sugar-free mixer, bottled",4.00'}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="button-secondary" type="button" disabled={saving || !csvText.trim()} onClick={handlePreviewCsv}>
              Preview CSV
            </button>
            <button className="button" type="submit" disabled={saving || csvPreviewSource !== csvText || csvPreviewRows.length === 0}>
              {saving ? 'Importing...' : 'Import preview'}
            </button>
          </div>
        </form>
        {csvPreviewRows.length > 0 ? (
          <div className="stack">
            <span className="eyebrow">Preview</span>
            <table className="preview-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Price</th>
                </tr>
              </thead>
              <tbody>
                {csvPreviewRows.map((row, index) => (
                  <tr key={`${row.category}-${row.name}-${index}`}>
                    <td>{row.category}</td>
                    <td>{row.name}</td>
                    <td>{row.description || 'No description'}</td>
                    <td>EUR {row.price.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {csvReport ? <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{csvReport}</pre> : null}
      </section>
    </>
  )
}
