'use client'

import { Fragment, FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import QRCode from 'qrcode'

import { getClientUserContext } from '@/lib/auth/client'
import { listTeamMembers } from '@/lib/auth/team-actions'
import { parseCsvRows, type CsvPreviewRow } from '@/lib/csv/menu-import'
import { createClient } from '@/lib/supabase/client'
import { useLanguage } from '@/components/app/language-provider'
import { LoadingBar } from '@/components/app/loading-bar'
import { AddRestaurantForm } from '@/components/platform/add-restaurant-form'

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
  name_el: string | null
}

type RestaurantOption = {
  id: string
  name: string
}

type MenuItem = {
  id: string
  name: string
  name_el: string | null
  description: string | null
  description_el: string | null
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
  const { t } = useLanguage()
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
  const [cancelWindowMinutes, setCancelWindowMinutes] = useState('5')
  const [cancelWindowSaving, setCancelWindowSaving] = useState(false)
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editingTableName, setEditingTableName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingCategoryNameEl, setEditingCategoryNameEl] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemName, setEditingItemName] = useState('')
  const [editingItemNameEl, setEditingItemNameEl] = useState('')
  const [editingItemDescription, setEditingItemDescription] = useState('')
  const [editingItemDescriptionEl, setEditingItemDescriptionEl] = useState('')
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
        setError(restaurantsError?.message || t('setup.error.noRestaurants'))
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
        setError(t('setup.error.roleRequired'))
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

    const [{ data: tableRows, error: tableError }, { data: categoryRows, error: categoryError }, { data: itemRows, error: itemError }, staffResult, restaurantResult] =
      await Promise.all([
        supabase
          .from('restaurant_tables')
          .select('id, name, qr_token, active, assigned_staff_id')
          .eq('restaurant_id', activeRestaurantId)
          .order('name'),
        supabase
          .from('menu_categories')
          .select('id, name, name_el')
          .eq('restaurant_id', activeRestaurantId)
          .order('sort_order'),
        supabase
          .from('menu_items')
          .select('id, name, name_el, description, description_el, price, available, category_id, allergens, menu_item_modifiers(id, name, price_delta, active), menu_categories(name)')
          .eq('restaurant_id', activeRestaurantId)
          .order('created_at', { ascending: false })
          .limit(50),
        listTeamMembers(activeRestaurantId).catch(() => ({ error: undefined, members: undefined })),
        supabase.from('restaurants').select('cancel_window_minutes').eq('id', activeRestaurantId).maybeSingle(),
      ])

    setCancelWindowMinutes(
      String((restaurantResult?.data as { cancel_window_minutes?: number | null } | null)?.cancel_window_minutes ?? 5)
    )

    setStaffOptions(
      (staffResult && staffResult.members
        ? staffResult.members.filter((member) => member.role === 'MANAGER' || member.role === 'STAFF')
        : []
      ).map((member) => ({ id: member.userId, name: member.email }))
    )

    if (tableError || categoryError || itemError) {
      setError(tableError?.message || categoryError?.message || itemError?.message || t('setup.error.loadFailed'))
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

  // Owner-configurable cancellation window: how long a customer may cancel an
  // order from the tracking page after submitting it (default 5 minutes).
  async function handleSaveCancelWindow() {
    if (!restaurantId) return
    const minutes = Math.max(0, Math.floor(Number(cancelWindowMinutes) || 5))
    if (minutes < 1 || minutes > 120) {
      setError(t('setup.error.cancelWindow'))
      return
    }

    setCancelWindowSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('restaurants')
      .update({ cancel_window_minutes: minutes })
      .eq('id', restaurantId)

    setCancelWindowSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setCancelWindowMinutes(String(minutes))
    setNotice(t('setup.notice.cancelWindowSaved'))
  }

  async function handleRestaurantSelection(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    await loadData(nextRestaurantId)
  }

  async function handleDownloadQr(table: RestaurantTable) {
    setQrDownloadingFor(table.id)
    setError(null)
    setNotice(null)

    try {
      const svg = qrSvgMap[table.id] || (await QRCode.toString(`${appUrl}/t/${table.qr_token}`, { type: 'svg', margin: 1, width: 256 }))
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
      const objectUrl = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = objectUrl
      anchor.download = `${table.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'table'}-qr.svg`
      anchor.click()
      URL.revokeObjectURL(objectUrl)
      setNotice(t('setup.notice.qrDownloadedFor', { name: table.name }))
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

    setNotice(t('setup.notice.previewReady', { count: rows.length }))
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
    setNotice(t('setup.notice.tableCreated'))
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

    setNotice(t('setup.notice.tableToggled', { name: table.name, state: table.active ? 'inactive' : 'active' }))
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

    setNotice(t('setup.notice.tableAssignment'))
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

    setNotice(t('setup.notice.tableDeletedName', { name: table.name }))
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
    setNotice(t('setup.notice.tableNameUpdated'))
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
    setNotice(t('setup.notice.categoryCreated'))
    await loadData()
  }

  async function handleDeleteCategory(category: Category) {
    if (!restaurantId) {
      return
    }

    const hasLinkedItems = items.some((item) => item.category_id === category.id)
    if (hasLinkedItems) {
      setError(t('setup.error.categoryInUse'))
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

    setNotice(t('setup.notice.categoryDeleted', { name: category.name }))
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
      .update({ name: editingCategoryName.trim(), name_el: editingCategoryNameEl.trim() || null })
      .eq('id', categoryId)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEditingCategoryId(null)
    setEditingCategoryName('')
    setEditingCategoryNameEl('')
    setNotice(t('setup.notice.categoryRenamed'))
    await loadData()
  }

  async function handleAddMenuItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !itemName.trim() || !itemCategoryId || !itemPrice) {
      return
    }

    const numericPrice = Number(itemPrice)
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setError(t('setup.error.invalidPrice'))
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
    setNotice(t('setup.notice.itemCreated'))
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

    setNotice(t('setup.notice.itemToggled', { name: item.name, state: item.available ? 'unavailable' : 'available' }))
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

    setNotice(t('setup.notice.itemDeletedName', { name: item.name }))
    await loadData()
  }

  async function handleSaveMenuItem(itemId: string) {
    if (!restaurantId || !editingItemName.trim() || !editingItemCategoryId || !editingItemPrice) {
      return
    }

    const numericPrice = Number(editingItemPrice)
    if (Number.isNaN(numericPrice) || numericPrice < 0) {
      setError(t('setup.error.invalidPrice'))
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    const { error: updateError } = await supabase
      .from('menu_items')
      .update({
        name: editingItemName.trim(),
        name_el: editingItemNameEl.trim() || null,
        description: editingItemDescription.trim() || null,
        description_el: editingItemDescriptionEl.trim() || null,
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
    setEditingItemNameEl('')
    setEditingItemDescription('')
    setEditingItemDescriptionEl('')
    setEditingItemPrice('')
    setEditingItemCategoryId('')
    setEditingItemAllergens('')
    setEditingItemModifiersText('')
    setNotice(t('setup.notice.itemUpdated'))
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
      setError(t('setup.error.namePriceRequired'))
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

    setNotice(t('setup.notice.itemUpdatedName', { name: item.name }))
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
    setEditingItemNameEl(item.name_el || '')
    setEditingItemDescription(item.description || '')
    setEditingItemDescriptionEl(item.description_el || '')
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
      setError(t('setup.error.previewFirst'))
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
        name_el: row.nameEl || null,
        description: row.description || null,
        description_el: row.descriptionEl || null,
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
      setNotice(t('setup.notice.nothingImported'))
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
    setNotice(
      skipped > 0
        ? t('setup.notice.importedWithSkip', { count: rowsToInsert.length, skipped })
        : t('setup.imported', { count: rowsToInsert.length })
    )
    setCsvReport(null)
    await loadData()
  }

  if (loading) {
    return (
      <section className="panel stack">
        <LoadingBar />
      </section>
    )
  }

  return (
    <>
      <section className="panel stack">
        <span className="eyebrow">{t('setup.phaseEyebrow')}</span>
        <h1 className="section-title">{t('setup.title')}</h1>
        <p className="lead">{t('setup.lead', { restaurant: restaurantName ?? t('settings.yourRestaurant') })}</p>
        {restaurantOptions.length > 0 ? (
          <div className="field">
            <label htmlFor="adminRestaurantSelector">
              {isPlatformAdmin ? t('setup.restaurantContextAdmin') : t('setup.restaurantContext')}
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
        <span className="eyebrow">{t('setup.cancelWindowEyebrow')}</span>
        <p className="helper-text">{t('setup.cancelWindowHelper')}</p>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="field" style={{ minWidth: '160px' }}>
            <label htmlFor="cancelWindowMinutes">{t('setup.cancelWindowLabel')}</label>
            <input
              id="cancelWindowMinutes"
              type="number"
              min={1}
              max={120}
              value={cancelWindowMinutes}
              onChange={(event) => setCancelWindowMinutes(event.target.value)}
            />
          </div>
          <button className="button-secondary" type="button" disabled={cancelWindowSaving} onClick={() => void handleSaveCancelWindow()}>
            {cancelWindowSaving ? t('setup.saving') : t('setup.saveCancelWindow')}
          </button>
        </div>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('setup.tablesEyebrow')}</span>
        <form className="stack" onSubmit={handleAddTable}>
          <div className="field">
            <label htmlFor="tableName">{t('setup.newTableName')}</label>
            <input
              id="tableName"
              value={tableName}
              onChange={(event) => setTableName(event.target.value)}
              placeholder={t('setup.tablePlaceholder')}
              required
            />
          </div>
          <button className="button" type="submit" disabled={saving}>
            {saving ? t('setup.saving') : t('setup.addTable')}
          </button>
        </form>

        <ul className="list">
          {tables.map((table) => (
            <li key={table.id}>
              {editingTableId === table.id ? (
                <div className="field">
                  <label htmlFor={`edit-table-${table.id}`}>{t('setup.tableName')}</label>
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
              <p className="muted">{table.active ? t('setup.statusActive') : t('setup.statusInactive')}</p>
              <p className="muted">{t('setup.token', { token: table.qr_token })}</p>
              <p className="muted">{t('setup.qrUrl', { url: `${appUrl}/t/${table.qr_token}` })}</p>
              {staffOptions.length > 0 ? (
                <div className="field">
                  <label htmlFor={`assigned-staff-${table.id}`}>{t('setup.assignedStaff')}</label>
                  <select
                    id={`assigned-staff-${table.id}`}
                    value={table.assigned_staff_id ?? ''}
                    disabled={saving}
                    onChange={(event) => void handleAssignTableStaff(table.id, event.target.value)}
                  >
                    <option value="">{t('setup.unassignedOption')}</option>
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
                      {t('setup.saveName')}
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
                      {t('setup.cancel')}
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
                    {t('setup.rename')}
                  </button>
                )}
                <button className="button" type="button" disabled={saving} onClick={() => void handleToggleTableActive(table)}>
                  {table.active ? t('setup.deactivate') : t('setup.activate')}
                </button>
                <button className="button" type="button" disabled={saving} onClick={() => void handleDeleteTable(table)}>
                  {t('setup.deleteTable')}
                </button>
                <button
                  className="button"
                  type="button"
                  disabled={saving || qrDownloadingFor === table.id}
                  onClick={() => void handleDownloadQr(table)}
                >
                  {qrDownloadingFor === table.id ? t('setup.preparingQr') : t('setup.downloadQr')}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <span className="eyebrow">{t('setup.qrSheetEyebrow')}</span>
            <h2 className="section-title">{t('setup.qrSheetTitle')}</h2>
          </div>
          <button className="button" type="button" onClick={handlePrintQrSheet} disabled={tables.length === 0}>
            {t('setup.printQrSheet')}
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
        <span className="eyebrow">{t('setup.menuEyebrow')}</span>
        <p className="helper-text">{t('setup.menuHelper')}</p>

        <span className="eyebrow" style={{ marginTop: '12px' }}>{t('setup.newItemEyebrow')}</span>
        <form className="stack" onSubmit={handleAddMenuItem}>
          <div className="field">
            <label htmlFor="itemName">{t('setup.itemName')}</label>
            <input
              id="itemName"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
              placeholder={t('setup.itemNamePlaceholder')}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="itemDescription">{t('setup.itemDescription')}</label>
            <textarea
              id="itemDescription"
              value={itemDescription}
              onChange={(event) => setItemDescription(event.target.value)}
              placeholder={t('setup.itemDescriptionPlaceholder')}
            />
          </div>

          <div className="field">
            <label htmlFor="itemPrice">{t('setup.itemPrice')}</label>
            <input
              id="itemPrice"
              type="number"
              step="0.01"
              min="0"
              value={itemPrice}
              onChange={(event) => setItemPrice(event.target.value)}
              placeholder={t('setup.itemPricePlaceholder')}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="itemCategoryId">{t('setup.itemCategory')}</label>
            <select
              id="itemCategoryId"
              value={itemCategoryId}
              onChange={(event) => setItemCategoryId(event.target.value)}
              required
            >
              <option value="" disabled>
                {t('setup.selectCategory')}
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="itemAllergens">{t('setup.itemAllergens')}</label>
            <input
              id="itemAllergens"
              value={itemAllergens}
              onChange={(event) => setItemAllergens(event.target.value)}
              placeholder={t('setup.allergensPlaceholder')}
            />
          </div>

          <div className="field">
            <label htmlFor="itemModifiersText">{t('setup.itemModifiers')}</label>
            <textarea
              id="itemModifiersText"
              value={itemModifiersText}
              onChange={(event) => setItemModifiersText(event.target.value)}
              placeholder={t('setup.modifiersPlaceholder')}
            />
            <p className="helper-text">{t('setup.modifierFormatHelper')}</p>
          </div>

          <button className="button" type="submit" disabled={saving || categories.length === 0}>
            {saving ? t('setup.saving') : t('setup.addMenuItem')}
          </button>
        </form>

        <span className="eyebrow" style={{ marginTop: '16px' }}>{t('setup.categoriesEyebrow')}</span>
        <form className="stack" onSubmit={handleAddCategory}>
          <div className="field">
            <label htmlFor="categoryName">{t('setup.newCategory')}</label>
            <input
              id="categoryName"
              value={categoryName}
              onChange={(event) => setCategoryName(event.target.value)}
              placeholder={t('setup.categoryPlaceholder')}
              required
            />
          </div>
          <button className="button-secondary" type="submit" disabled={saving}>
            {saving ? t('setup.saving') : t('setup.addCategory')}
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
                  <p className="muted">{t('setup.itemsCount', { count: categoryItems.length })}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button className="button-secondary" type="button" disabled={saving} onClick={() => toggleCategory(category.id)}>
                    {isOpen ? t('setup.collapse') : t('setup.expand')}
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
                      <input
                        id={`edit-category-el-${category.id}`}
                        aria-label={t('setup.categoryNameEl')}
                        placeholder={t('setup.categoryNameEl')}
                        value={editingCategoryNameEl}
                        onChange={(event) => setEditingCategoryNameEl(event.target.value)}
                        style={{ width: 160 }}
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
                          setEditingCategoryNameEl('')
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
                        setEditingCategoryNameEl(category.name_el || '')
                      }}
                    >
                      Rename
                    </button>
                  )}
                  <button className="button-danger" type="button" disabled={saving} onClick={() => void handleDeleteCategory(category)}>
                    {t('setup.deleteCategory')}
                  </button>
                </div>
              </div>

              {isOpen ? (
                categoryItems.length === 0 ? (
                  <p className="muted">{t('setup.noItemsInCategory')}</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>{t('setup.itemCol')}</th>
                          <th style={{ width: 120 }}>{t('setup.itemPrice')}</th>
                          <th style={{ width: 120 }}>{t('setup.statusCol')}</th>
                          <th>{t('setup.actionsCol')}</th>
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
                                      <label htmlFor={`details-name-el-${item.id}`}>{t('setup.itemNameEl')}</label>
                                      <input
                                        id={`details-name-el-${item.id}`}
                                        value={editingItemNameEl}
                                        onChange={(event) => setEditingItemNameEl(event.target.value)}
                                        placeholder={t('setup.itemNameElPlaceholder')}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`details-desc-${item.id}`}>{t('setup.itemDescription')}</label>
                                      <textarea
                                        id={`details-desc-${item.id}`}
                                        value={editingItemDescription}
                                        onChange={(event) => setEditingItemDescription(event.target.value)}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`details-desc-el-${item.id}`}>{t('setup.itemDescriptionEl')}</label>
                                      <textarea
                                        id={`details-desc-el-${item.id}`}
                                        value={editingItemDescriptionEl}
                                        onChange={(event) => setEditingItemDescriptionEl(event.target.value)}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`details-category-${item.id}`}>{t('setup.itemCategory')}</label>
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
                                      <label htmlFor={`details-allergens-${item.id}`}>{t('setup.itemAllergens')}</label>
                                      <input
                                        id={`details-allergens-${item.id}`}
                                        value={editingItemAllergens}
                                        onChange={(event) => setEditingItemAllergens(event.target.value)}
                                        placeholder={t('setup.allergensPlaceholder')}
                                      />
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`details-modifiers-${item.id}`}>{t('setup.itemModifiers')}</label>
                                      <textarea
                                        id={`details-modifiers-${item.id}`}
                                        value={editingItemModifiersText}
                                        onChange={(event) => setEditingItemModifiersText(event.target.value)}
                                        placeholder={t('setup.modifiersPlaceholder')}
                                      />
                                      <p className="helper-text">{t('setup.modifierFormatHelper')}</p>
                                    </div>
                                    <div className="pill-row">
                                      <button className="button" type="button" disabled={saving} onClick={() => void handleSaveMenuItem(item.id)}>
                                        {t('setup.saveChanges')}
                                      </button>
                                      <button className="button-secondary" type="button" onClick={() => setExpandedItemId(null)}>
                                        {t('setup.cancel')}
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
        <span className="eyebrow">{t('setup.csvEyebrow')}</span>
        <p className="helper-text">{t('setup.csvHelper')}</p>
        <form className="stack" onSubmit={handleCsvImport}>
          <div className="field">
            <label htmlFor="csvText">{t('setup.csvRows')}</label>
            <textarea
              id="csvText"
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value)
                setCsvPreviewRows([])
                setCsvPreviewSource('')
                setCsvReport(null)
              }}
              placeholder={
                'category,name,description,price,name_el,description_el\nStarters,Burger,Beef burger with fries,12.00,Μπέργκερ,Μπέργκερ με πατάτες\nDrinks,"Tonic, Zero","Sugar-free mixer, bottled",4.00'
              }
              required
            />
          </div>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <button className="button-secondary" type="button" disabled={saving || !csvText.trim()} onClick={handlePreviewCsv}>
              {t('setup.previewCsv')}
            </button>
            <button className="button" type="submit" disabled={saving || csvPreviewSource !== csvText || csvPreviewRows.length === 0}>
              {saving ? t('setup.importing') : t('setup.importPreview')}
            </button>
          </div>
        </form>
        {csvPreviewRows.length > 0 ? (
          <div className="stack">
            <span className="eyebrow">{t('setup.previewEyebrow')}</span>
            <table className="preview-table">
              <thead>
                <tr>
                  <th>{t('setup.csvCategoryCol')}</th>
                  <th>{t('setup.csvNameCol')}</th>
                  <th>{t('setup.csvDescriptionCol')}</th>
                  <th>{t('setup.csvPriceCol')}</th>
                  <th>{t('setup.csvNameElCol')}</th>
                  <th>{t('setup.csvDescriptionElCol')}</th>
                </tr>
              </thead>
              <tbody>
                {csvPreviewRows.map((row, index) => (
                  <tr key={`${row.category}-${row.name}-${index}`}>
                    <td>{row.category}</td>
                    <td>{row.name}</td>
                    <td>{row.description || t('setup.noDescription')}</td>
                    <td>{t('setup.priceEur', { price: row.price.toFixed(2) })}</td>
                    <td>{row.nameEl || <span className="muted">—</span>}</td>
                    <td>{row.descriptionEl || <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {csvReport ? <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{csvReport}</pre> : null}
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('setup.addAnotherEyebrow')}</span>
        <p className="helper-text">{t('setup.addAnotherHelper')}</p>
        <AddRestaurantForm />
      </section>
    </>
  )
}
