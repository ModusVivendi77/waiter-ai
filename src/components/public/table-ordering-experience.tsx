'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { CreateOrderInput } from '@/lib/validation/orders'

type Category = {
  id: string
  name: string
  description: string | null
}

type Modifier = {
  id: string
  name: string
  price_delta: number
  active: boolean
}

type MenuItem = {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  available: boolean
  allergens: string[]
  menu_item_modifiers: Modifier[] | null
}

type CartLine = {
  quantity: number
  notes: string
  modifiers: string[]
  unitPrice: number
}

type Props = {
  token: string
  restaurantName: string
  tableName: string
  currency: string
  categories: Category[]
  items: MenuItem[]
}

type OrderResponse = {
  order?: {
    id: string
    status: string
    total: number
    currency: string
    created_at: string
    public_tracking_token: string
  }
  error?: string
  warning?: string
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export function TableOrderingExperience({ token, restaurantName, tableName, currency, categories, items }: Props) {
  const [cart, setCart] = useState<Record<string, CartLine>>({})
  const [selectedModifiers, setSelectedModifiers] = useState<Record<string, string[]>>({})
  const [customerNote, setCustomerNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<OrderResponse['order'] | null>(null)
  const [warning, setWarning] = useState<string | null>(null)

  const itemsByCategory = useMemo(() => {
    return categories.map((category) => ({
      ...category,
      items: items.filter((item) => item.category_id === category.id && item.available),
    }))
  }, [categories, items])

  const cartItems = useMemo(() => {
    return items
      .map((item) => ({ item, line: cart[item.id] }))
      .filter((entry) => entry.line && entry.line.quantity > 0)
  }, [cart, items])

  const total = useMemo(() => {
    return cartItems.reduce((sum, entry) => sum + entry.line.unitPrice * entry.line.quantity, 0)
  }, [cartItems])

  function activeModifiers(item: MenuItem) {
    return (item.menu_item_modifiers || []).filter((modifier) => modifier.active)
  }

  function modifierDelta(item: MenuItem, names: string[]) {
    const modifiers = activeModifiers(item)
    return names.reduce((sum, name) => {
      const modifier = modifiers.find((entry) => entry.name.toLowerCase() === name.toLowerCase())
      return sum + Number(modifier?.price_delta || 0)
    }, 0)
  }

  function unitPriceFor(item: MenuItem, names: string[]) {
    return Number(item.price) + modifierDelta(item, names)
  }

  function toggleModifier(itemId: string, name: string) {
    setSelectedModifiers((current) => {
      const existing = current[itemId] || []
      const next = existing.includes(name) ? existing.filter((entry) => entry !== name) : [...existing, name]
      return { ...current, [itemId]: next }
    })
  }

  function addToCart(item: MenuItem) {
    const names = selectedModifiers[item.id] || []
    setCart((current) => {
      const existing = current[item.id] || { quantity: 0, notes: '', modifiers: [], unitPrice: item.price }
      return {
        ...current,
        [item.id]: {
          ...existing,
          quantity: existing.quantity + 1,
          modifiers: names,
          unitPrice: unitPriceFor(item, names),
        },
      }
    })
  }

  function updateLine(item: MenuItem, updater: (line: CartLine) => CartLine | null) {
    setCart((current) => {
      const existing = current[item.id] || { quantity: 0, notes: '', modifiers: [], unitPrice: item.price }
      const next = updater(existing)

      if (!next || next.quantity <= 0) {
        const { [item.id]: _removed, ...rest } = current
        return rest
      }

      return {
        ...current,
        [item.id]: next,
      }
    })
  }

  async function handleSubmitOrder() {
    if (cartItems.length === 0) {
      setError('Add at least one item before submitting the order.')
      return
    }

    setPending(true)
    setError(null)
    setSuccess(null)
    setWarning(null)

    const payload: CreateOrderInput = {
      token,
      customerNote: customerNote.trim() || undefined,
      idempotencyKey: crypto.randomUUID(),
      items: cartItems.map(({ item, line }) => ({
        menuItemId: item.id,
        quantity: line.quantity,
        notes: line.notes.trim() || undefined,
        modifiers: line.modifiers,
      })),
    }

    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = (await response.json()) as OrderResponse
    setPending(false)

    if (!response.ok || data.error) {
      setError(data.error || 'Unable to submit order.')
      return
    }

    setCart({})
    setSelectedModifiers({})
    setCustomerNote('')
    setSuccess(data.order || null)
    setWarning(data.warning || null)
  }

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="hero-card">
          <span className="eyebrow">Table Ordering</span>
          <h1 className="hero-title">{restaurantName}</h1>
          <p className="lead">
            You are ordering for {tableName}. Browse the menu, pick your options, and send your order directly to the
            team.
          </p>
          <div className="pill-row">
            <span className="badge">{tableName}</span>
            <span className="badge">No sign-in required</span>
          </div>
        </section>

        <div className="order-layout">
          <section className="panel stack">
            <span className="eyebrow">Menu</span>
            {itemsByCategory.map((category) => (
              <div className="stack" key={category.id}>
                <div>
                  <h2 className="section-title">{category.name}</h2>
                  {category.description ? <p className="muted">{category.description}</p> : null}
                </div>
                <div className="panel-grid">
                  {category.items.map((item) => {
                    const modifiers = activeModifiers(item)
                    const selected = selectedModifiers[item.id] || []

                    return (
                      <article className="metric" key={item.id}>
                        <span className="eyebrow">{category.name}</span>
                        <strong>{item.name}</strong>
                        {item.description ? <p className="muted">{item.description}</p> : null}
                        {item.allergens && item.allergens.length > 0 ? (
                          <p className="muted">
                            <strong>Allergens:</strong> {item.allergens.join(', ')}
                          </p>
                        ) : null}
                        <p>{formatCurrency(item.price, currency)}</p>

                        {modifiers.length > 0 ? (
                          <div className="stack" style={{ gap: '6px' }}>
                            <span className="muted">Options</span>
                            {modifiers.map((modifier) => {
                              const checked = selected.includes(modifier.name)
                              return (
                                <label key={modifier.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleModifier(item.id, modifier.name)}
                                  />
                                  <span>
                                    {modifier.name}
                                    {Number(modifier.price_delta) > 0
                                      ? ` +${formatCurrency(Number(modifier.price_delta), currency)}`
                                      : ''}
                                  </span>
                                </label>
                              )
                            })}
                          </div>
                        ) : null}

                        <button className="button" type="button" onClick={() => addToCart(item)}>
                          Add to cart
                          {selected.length > 0
                            ? ` · ${formatCurrency(unitPriceFor(item, selected), currency)}`
                            : ''}
                        </button>
                      </article>
                    )
                  })}
                  {category.items.length === 0 ? (
                    <article className="metric">
                      <strong>No available items</strong>
                      <p className="muted">This category is temporarily unavailable.</p>
                    </article>
                  ) : null}
                </div>
              </div>
            ))}
          </section>


          <aside className="panel stack">
            <span className="eyebrow">Cart</span>
            <h2 className="section-title">Your order</h2>
            {error ? <div className="error-box">{error}</div> : null}
            {success ? (
              <div className="success">
                Order {success.id.slice(0, 8)} submitted with status {success.status}. Total:{' '}
                {formatCurrency(success.total, success.currency)}.
                <div style={{ marginTop: '10px' }}>
                  <Link className="button-secondary" href={`/orders/${success.public_tracking_token}`}>
                    Track order status
                  </Link>
                </div>
              </div>
            ) : null}
            {warning ? <div className="message">{warning}</div> : null}

            {cartItems.length === 0 ? (
              <p className="muted">Your cart is empty.</p>
            ) : (
              <ul className="list">
                {cartItems.map(({ item, line }) => (
                  <li key={item.id}>
                    <div className="cart-line-header">
                      <strong>{item.name}</strong>
                      <span>{formatCurrency(line.unitPrice * line.quantity, currency)}</span>
                    </div>
                    {line.modifiers.length > 0 ? <p className="muted">{line.modifiers.join(' · ')}</p> : null}
                    <div className="cart-stepper">
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => updateLine(item, (current) => ({ ...current, quantity: current.quantity - 1 }))}
                      >
                        −
                      </button>
                      <span>{line.quantity}</span>
                      <button
                        className="button-secondary"
                        type="button"
                        onClick={() => updateLine(item, (current) => ({ ...current, quantity: current.quantity + 1 }))}
                      >
                        +
                      </button>
                    </div>
                    <div className="field">
                      <label htmlFor={`notes-${item.id}`}>Item note</label>
                      <textarea
                        id={`notes-${item.id}`}
                        value={line.notes}
                        onChange={(event) => updateLine(item, (current) => ({ ...current, notes: event.target.value }))}
                        placeholder="No onions, extra ice, allergy note..."
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="field">
              <label htmlFor="customerNote">Order note</label>
              <textarea
                id="customerNote"
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                placeholder="Anything else the team should know?"
              />
            </div>

            <div className="cart-summary">
              <strong>Total</strong>
              <strong>{formatCurrency(total, currency)}</strong>
            </div>

            <button
              className="button"
              type="button"
              disabled={pending || cartItems.length === 0}
              onClick={() => void handleSubmitOrder()}
            >
              {pending ? 'Submitting order...' : 'Submit order'}
            </button>
          </aside>
        </div>
      </div>
    </main>
  )
}

