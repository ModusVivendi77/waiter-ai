'use client'

import { useEffect, useState } from 'react'

type OrderStatusPayload = {
  order: {
    id: string
    status: string
    total: number
    currency: string
    customer_note: string | null
    created_at: string
  }
  table: {
    name: string
  }
  restaurant: {
    name: string
  }
  items: Array<{
    id: string
    item_name: string
    quantity: number
    unit_price: number
    notes: string | null
  }>
}

type Props = {
  trackingToken: string
  initialOrder: OrderStatusPayload
}

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

export function OrderStatusView({ trackingToken, initialOrder }: Props) {
  const [data, setData] = useState(initialOrder)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      const response = await fetch(`/api/order-status/${trackingToken}`, { cache: 'no-store' })
      const next = (await response.json()) as OrderStatusPayload | { error: string }

      if (!response.ok || 'error' in next) {
        setError('Unable to refresh order status right now.')
      } else {
        setData(next)
        setLastUpdated(new Date())
        setError(null)
      }
    } catch {
      setError('Failed to refresh order status.')
    } finally {
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    const intervalId = window.setInterval(async () => {
      const response = await fetch(`/api/order-status/${trackingToken}`, { cache: 'no-store' })
      const next = (await response.json()) as OrderStatusPayload | { error: string }

      if (cancelled) {
        return
      }

      if (!response.ok || 'error' in next) {
        setError('Unable to refresh order status right now.')
        return
      }

      setData(next)
      setLastUpdated(new Date())
      setError(null)
    }, 5_000) // Poll every 5 seconds instead of 10 for better responsiveness

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [trackingToken])

  return (
    <main className="page-shell">
      <div className="page-grid">
        <section className="hero-card">
          <span className="eyebrow">Order Status</span>
          <h1 className="hero-title">{data.restaurant.name}</h1>
          <p className="lead">
            Order {data.order.id.slice(0, 8)} for {data.table.name} is currently <strong>{data.order.status}</strong>.
          </p>
          <div className="pill-row">
            <span className="badge">{data.table.name}</span>
            <span className="badge">Last updated: {lastUpdated.toLocaleTimeString()}</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button 
              type="button" 
              className="button-secondary" 
              onClick={handleManualRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Now'}
            </button>
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">Summary</span>
          {error ? <div className="error-box">{error}</div> : null}
          <ul className="list">
            {data.items.map((item) => (
              <li key={item.id}>
                <div className="cart-line-header">
                  <strong>{item.item_name}</strong>
                  <span>{formatCurrency(item.unit_price * item.quantity, data.order.currency)}</span>
                </div>
                <p className="muted">Quantity: {item.quantity}</p>
                {item.notes ? <p className="muted">Note: {item.notes}</p> : null}
              </li>
            ))}
          </ul>
          {data.order.customer_note ? <div className="message">Order note: {data.order.customer_note}</div> : null}
          <div className="cart-summary">
            <strong>Total</strong>
            <strong>{formatCurrency(data.order.total, data.order.currency)}</strong>
          </div>
        </section>
      </div>
    </main>
  )
}
