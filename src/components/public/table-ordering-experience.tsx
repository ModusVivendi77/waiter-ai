'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { CreateOrderInput } from '@/lib/validation/orders'

type Category = {
  id: string
  name: string
  description: string | null
}

type MenuItem = {
  id: string
  category_id: string
  name: string
  description: string | null
  price: number
  available: boolean
}

type CartLine = {
  quantity: number
  notes: string
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
    return cartItems.reduce((sum, entry) => sum + entry.item.price * entry.line.quantity, 0)
  }, [cartItems])

  function updateLine(itemId: string, updater: (line: CartLine) => CartLine | null) {
    setCart((current) => {
      const existing = current[itemId] || { quantity: 0, notes: '' }
      const next = updater(existing)

      if (!next || next.quantity <= 0) {
        const { [itemId]: _removed, ...rest } = current
        return rest
      }

      return {
        ...current,
        [itemId]: next,
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
      items: cartItems.map((entry) => ({
        menuItemId: entry.item.id,
        quantity: entry.line.quantity,
        notes: entry.line.notes.trim() || undefined,
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
            You are ordering for {tableName}. Browse the menu, build your cart, and send your order directly to the team.
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
                  {category.items.map((item) => (
                    <article className="metric" key={item.id}>
                      <span className="eyebrow">{category.name}</span>
                      <strong>{item.name}</strong>
                      <p className="muted">{item.description || 'No description yet.'}</p>
                      <p>{formatCurrency(item.price, currency)}</p>
                      <button
                        className="button"
                        type="button"
                        onClick={() => updateLine(item.id, (line) => ({ ...line, quantity: line.quantity + 1 }))}
                      >
                        Add to cart
                      </button>
                    </article>
                  ))}
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
                Order {success.id.slice(0, 8)} submitted with status {success.status}. Total: {formatCurrency(success.total, success.currency)}.
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
                      <span>{formatCurrency(item.price * line.quantity, currency)}</span>
                    </div>
                    <div className="cart-stepper">
                      <button className="button-secondary" type="button" onClick={() => updateLine(item.id, (current) => ({ ...current, quantity: current.quantity - 1 }))}>
                        -
                      </button>
                      <span>{line.quantity}</span>
                      <button className="button-secondary" type="button" onClick={() => updateLine(item.id, (current) => ({ ...current, quantity: current.quantity + 1 }))}>
                        +
                      </button>
                    </div>
                    <div className="field">
                      <label htmlFor={`notes-${item.id}`}>Item note</label>
                      <textarea
                        id={`notes-${item.id}`}
                        value={line.notes}
                        onChange={(event) => updateLine(item.id, (current) => ({ ...current, notes: event.target.value }))}
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

            <button className="button" type="button" disabled={pending || cartItems.length === 0} onClick={() => void handleSubmitOrder()}>
              {pending ? 'Submitting order...' : 'Submit order'}
            </button>
          </aside>
        </div>
      </div>
    </main>
  )
}
