'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import QRCode from 'qrcode'

import { getClientUserContext } from '@/lib/auth/client'
import { createClient } from '@/lib/supabase/client'

type RestaurantTable = {
  id: string
  name: string
  qr_token: string
  active: boolean
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

export function RestaurantSetupConsole() {
  const router = useRouter()
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
  const [csvText, setCsvText] = useState('')
  const [csvReport, setCsvReport] = useState<string | null>(null)
  const [qrDownloadingFor, setQrDownloadingFor] = useState<string | null>(null)
  const [editingTableId, setEditingTableId] = useState<string | null>(null)
  const [editingTableName, setEditingTableName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [editingItemName, setEditingItemName] = useState('')
  const [editingItemDescription, setEditingItemDescription] = useState('')
  const [editingItemPrice, setEditingItemPrice] = useState('')
  const [editingItemCategoryId, setEditingItemCategoryId] = useState('')

  const supabase = useMemo(() => createClient(), [])
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

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
      const membership =
        context.memberships.find((entry) => entry.role === 'OWNER' || entry.role === 'MANAGER') ?? context.memberships[0]

      if (!membership) {
        setError('You need OWNER or MANAGER access to edit restaurant setup.')
        setLoading(false)
        return
      }

      activeRestaurantId = membership.restaurantId
      activeRestaurantName = membership.restaurantName
      setRestaurantOptions([])
      setSelectedRestaurantId('')
    }

    setRestaurantId(activeRestaurantId)
    setRestaurantName(activeRestaurantName)

    const [{ data: tableRows, error: tableError }, { data: categoryRows, error: categoryError }, { data: itemRows, error: itemError }] =
      await Promise.all([
        supabase
          .from('restaurant_tables')
          .select('id, name, qr_token, active')
          .eq('restaurant_id', activeRestaurantId)
          .order('name'),
        supabase
          .from('menu_categories')
          .select('id, name')
          .eq('restaurant_id', activeRestaurantId)
          .order('sort_order'),
        supabase
          .from('menu_items')
          .select('id, name, description, price, available, category_id, menu_categories(name)')
          .eq('restaurant_id', activeRestaurantId)
          .order('created_at', { ascending: false })
          .limit(50),
      ])

    if (tableError || categoryError || itemError) {
      setError(tableError?.message || categoryError?.message || itemError?.message || 'Failed to load setup data.')
    } else {
      setTables((tableRows as RestaurantTable[]) || [])
      setCategories((categoryRows as Category[]) || [])
      setItems((itemRows as MenuItem[]) || [])
      if (categoryRows && categoryRows.length > 0) {
        setItemCategoryId(categoryRows[0].id)
      }
    }

    setLoading(false)
  }

  useEffect(() => {
    void loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleRestaurantSelection(nextRestaurantId: string) {
    setSelectedRestaurantId(nextRestaurantId)
    await loadData(nextRestaurantId)
  }

  async function handleDownloadQr(table: RestaurantTable) {
    setQrDownloadingFor(table.id)
    setError(null)
    setNotice(null)

    try {
      const qrUrl = `${appUrl}/t/${table.qr_token}`
      const svg = await QRCode.toString(qrUrl, { type: 'svg', margin: 1, width: 512 })
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

  function parseCsvRows(rawText: string) {
    const seenKeys = new Set<string>()
    const rows: Array<{ category: string; name: string; description: string; price: number }> = []
    const errors: string[] = []

    rawText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .forEach((line, index) => {
        const lineNumber = index + 1
        const parts = line.split(',').map((value) => value.trim())

        if (parts.length < 4) {
          errors.push(`Line ${lineNumber}: expected at least 4 comma-separated values.`)
          return
        }

        const category = parts[0]
        const name = parts[1]
        const priceRaw = parts[parts.length - 1]
        const description = parts.slice(2, -1).join(',')
        const price = Number(priceRaw)

        if (!category || !name) {
          errors.push(`Line ${lineNumber}: category and name are required.`)
          return
        }

        if (!Number.isFinite(price) || price < 0) {
          errors.push(`Line ${lineNumber}: invalid price "${priceRaw}".`)
          return
        }

        const key = `${category.toLowerCase()}::${name.toLowerCase()}`
        if (seenKeys.has(key)) {
          errors.push(`Line ${lineNumber}: duplicate item "${name}" in category "${category}".`)
          return
        }
        seenKeys.add(key)

        rows.push({ category, name, description, price })
      })

    return { rows, errors }
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

    const { error: insertError } = await supabase.from('menu_items').insert({
      restaurant_id: restaurantId,
      category_id: itemCategoryId,
      name: itemName.trim(),
      description: itemDescription.trim() || null,
      price: numericPrice,
      available: true,
    })

    setSaving(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setItemName('')
    setItemDescription('')
    setItemPrice('')
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
      })
      .eq('id', itemId)
      .eq('restaurant_id', restaurantId)

    setSaving(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    setEditingItemId(null)
    setEditingItemName('')
    setEditingItemDescription('')
    setEditingItemPrice('')
    setEditingItemCategoryId('')
    setNotice('Menu item updated.')
    await loadData()
  }

  async function handleCsvImport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!restaurantId || !csvText.trim()) {
      return
    }

    setSaving(true)
    setError(null)
    setNotice(null)

    setCsvReport(null)

    const { rows: parsedRows, errors: parseErrors } = parseCsvRows(csvText)

    if (parsedRows.length === 0) {
      setSaving(false)
      setError(parseErrors[0] || 'CSV must be in the format: category,name,description,price')
      if (parseErrors.length > 1) {
        setCsvReport(parseErrors.slice(0, 10).join('\n'))
      }
      return
    }

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
      if (parseErrors.length > 0) {
        setCsvReport(parseErrors.slice(0, 10).join('\n'))
      }
      return
    }

    const { error: itemInsertError } = await supabase.from('menu_items').insert(rowsToInsert)

    setSaving(false)

    if (itemInsertError) {
      setError(itemInsertError.message)
      return
    }

    setCsvText('')
    const skipped = parsedRows.length - rowsToInsert.length
    setNotice(`Imported ${rowsToInsert.length} rows from CSV.${skipped > 0 ? ` Skipped ${skipped} duplicate row(s).` : ''}`)
    if (parseErrors.length > 0) {
      setCsvReport(parseErrors.slice(0, 10).join('\n'))
    }
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
        {isPlatformAdmin && restaurantOptions.length > 0 ? (
          <div className="field">
            <label htmlFor="adminRestaurantSelector">Restaurant context (SUPER_ADMIN)</label>
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
        <span className="eyebrow">Menu Categories</span>
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
          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Add category'}
          </button>
        </form>

        <ul className="list">
          {categories.map((category) => (
            <li key={category.id}>
              {editingCategoryId === category.id ? (
                <div className="field">
                  <label htmlFor={`edit-category-${category.id}`}>Category name</label>
                  <input
                    id={`edit-category-${category.id}`}
                    value={editingCategoryName}
                    onChange={(event) => setEditingCategoryName(event.target.value)}
                    required
                  />
                </div>
              ) : (
                <strong>{category.name}</strong>
              )}
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {editingCategoryId === category.id ? (
                  <>
                    <button className="button" type="button" disabled={saving} onClick={() => void handleSaveCategoryName(category.id)}>
                      Save name
                    </button>
                    <button
                      className="button"
                      type="button"
                      disabled={saving}
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
                    className="button"
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
                <button className="button" type="button" disabled={saving} onClick={() => void handleDeleteCategory(category)}>
                  Delete category
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Menu Items</span>
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

          <button className="button" type="submit" disabled={saving || categories.length === 0}>
            {saving ? 'Saving...' : 'Add menu item'}
          </button>
        </form>

        <ul className="list">
          {items.map((item) => (
            <li key={item.id}>
              {editingItemId === item.id ? (
                <>
                  <div className="field">
                    <label htmlFor={`edit-item-name-${item.id}`}>Item name</label>
                    <input
                      id={`edit-item-name-${item.id}`}
                      value={editingItemName}
                      onChange={(event) => setEditingItemName(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`edit-item-description-${item.id}`}>Description</label>
                    <textarea
                      id={`edit-item-description-${item.id}`}
                      value={editingItemDescription}
                      onChange={(event) => setEditingItemDescription(event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`edit-item-price-${item.id}`}>Price</label>
                    <input
                      id={`edit-item-price-${item.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={editingItemPrice}
                      onChange={(event) => setEditingItemPrice(event.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor={`edit-item-category-${item.id}`}>Category</label>
                    <select
                      id={`edit-item-category-${item.id}`}
                      value={editingItemCategoryId}
                      onChange={(event) => setEditingItemCategoryId(event.target.value)}
                    >
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <strong>{item.name}</strong>
                  <p className="muted">Category: {getCategoryName(item)}</p>
                  <p className="muted">Price: EUR {Number(item.price).toFixed(2)}</p>
                </>
              )}
              <p className="muted">Status: {item.available ? 'Available' : 'Unavailable'}</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {editingItemId === item.id ? (
                  <>
                    <button className="button" type="button" disabled={saving} onClick={() => void handleSaveMenuItem(item.id)}>
                      Save changes
                    </button>
                    <button
                      className="button"
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        setEditingItemId(null)
                        setEditingItemName('')
                        setEditingItemDescription('')
                        setEditingItemPrice('')
                        setEditingItemCategoryId('')
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
                      setEditingItemId(item.id)
                      setEditingItemName(item.name)
                      setEditingItemDescription(item.description || '')
                      setEditingItemPrice(String(item.price))
                      setEditingItemCategoryId(item.category_id)
                    }}
                  >
                    Edit
                  </button>
                )}
                <button className="button" type="button" disabled={saving} onClick={() => void handleToggleMenuItemAvailability(item)}>
                  {item.available ? 'Mark unavailable' : 'Mark available'}
                </button>
                <button className="button" type="button" disabled={saving} onClick={() => void handleDeleteMenuItem(item)}>
                  Delete item
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">CSV Import</span>
        <p className="helper-text">Paste CSV lines in this format: category,name,description,price</p>
        <form className="stack" onSubmit={handleCsvImport}>
          <div className="field">
            <label htmlFor="csvText">CSV rows</label>
            <textarea
              id="csvText"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder={'Food,Burger,Beef burger with fries,12.00\nDrinks,Mythos,Greek lager,4.00'}
              required
            />
          </div>
          <button className="button" type="submit" disabled={saving}>
            {saving ? 'Importing...' : 'Import CSV'}
          </button>
        </form>
        {csvReport ? <pre className="muted" style={{ whiteSpace: 'pre-wrap' }}>{csvReport}</pre> : null}
      </section>
    </>
  )
}
