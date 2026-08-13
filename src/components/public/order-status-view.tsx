'use client'

import { useCallback, useEffect, useState } from 'react'

import { usePublicOrderStatus } from '@/lib/hooks/use-public-order-status'

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
    modifiers: string[]
  }>
  history: Array<{
    id: string
    old_status: string | null
    new_status: string
    created_at: string
  }>
}

type Props = {
  trackingToken: string
  initialOrder: OrderStatusPayload
}

const STATUS_LABELS: Record<string, string> = {
  NEW: 'Order received',
  ACCEPTED: 'Restaurant accepted',
  PREPARING: 'Preparing',
  READY: 'Ready',
  SERVED: 'Served',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
}

const STATUS_ORDER = ['NEW', 'ACCEPTED', 'PREPARING', 'READY', 'SERVED']

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(value)
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function OrderStatusView({ trackingToken, initialOrder }: Props) {
  const [data, setData] = useState(initialOrder)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [splitMode, setSplitMode] = useState<'equal' | 'items' | null>(null)
  const [peopleCount, setPeopleCount] = useState('2')
  const [guestAssignments, setGuestAssignments] = useState<Record<string, number>>({})

  const refreshFromServer = useCallback(async () => {
    const response = await fetch(`/api/order-status/${trackingToken}`, { cache: 'no-store' })
    const next = (await response.json()) as OrderStatusPayload | { error: string }

    if (!response.ok || 'error' in next) {
      setError('Unable to refresh order status right now.')
      return
    }

    setData(next)
    setLastUpdated(new Date())
    setError(null)
  }, [trackingToken])

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await refreshFromServer()
    } catch {
      setError('Failed to refresh order status.')
    } finally {
      setIsRefreshing(false)
    }
  }

  // Poll every 5 seconds as a reliable fallback.
  useEffect(() => {
    let cancelled = false
    const intervalId = window.setInterval(async () => {
      if (cancelled) {
        return
      }
      try {
        await refreshFromServer()
      } catch {
        // The refresh function handles its own error state.
      }
    }, 5_000)

    return () => {
      cancelled = true
      window.clearInterval(intervalId)
    }
  }, [refreshFromServer])

  // Instant updates when staff change the order status via real-time broadcast.
  usePublicOrderStatus(data.order.id, () => {
    void refreshFromServer()
  })

  const currentStatus = data.order.status
  const isTerminal = currentStatus === 'CANCELLED' || currentStatus === 'REJECTED' || currentStatus === 'SERVED'

  // Build a timeline from the status history if available, otherwise derive from the current status.
  let timelineEntries = data.history
    .filter((entry) => entry.new_status !== 'NEW' || entry.old_status === null)
    .map((entry) => ({
      key: entry.id,
      status: entry.new_status,
      reachedAt: entry.created_at,
    }))

  if (timelineEntries.length === 0) {
    const createdAt = data.order.created_at
    timelineEntries = [
      { key: 'initial', status: data.order.status, reachedAt: createdAt },
    ]
  }

  // Determine how far along the happy path the current status is.
  const currentStepIndex = STATUS_ORDER.indexOf(currentStatus)

  // --- Split the bill (client-side calculator) ---
  const peopleCountParsed = Math.max(1, parseInt(peopleCount, 10) || 1)

  // Equal split: total / N in cents; first guests absorb the remainder so the
  // shares always add back up to the exact total.
  const totalCents = Math.round(data.order.total * 100)
  const baseShareCents = Math.floor(totalCents / peopleCountParsed)
  const remainderCents = totalCents - baseShareCents * peopleCountParsed
  const equalShares = Array.from({ length: peopleCountParsed }, (_, index) =>
    (baseShareCents + (index < remainderCents ? 1 : 0)) / 100
  )

  // Item split: each item is assigned to a guest (defaults to guest 1).
  const guestTotals: number[] = []
  for (const item of data.items) {
    const guestIndex = Math.max(0, guestAssignments[item.id] ?? 0)
    guestTotals[guestIndex] = (guestTotals[guestIndex] || 0) + Number(item.unit_price) * item.quantity
  }

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
          <span className="eyebrow">Status Timeline</span>
          {isTerminal ? (
            <div className="message">
              This order has been {currentStatus === 'SERVED' ? 'served' : currentStatus.toLowerCase()}.
            </div>
          ) : null}

          <ol className="status-timeline" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {STATUS_ORDER.map((status, index) => {
              const reached = index <= currentStepIndex
              const isCurrent = index === currentStepIndex
              const historyEntry = timelineEntries.find((entry) => entry.status === status)

              return (
                <li key={status} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 14,
                        backgroundColor: reached ? '#16a34a' : '#d1d5db',
                        color: reached ? '#fff' : '#6b7280',
                      }}
                    >
                      {reached ? '✓' : index + 1}
                    </div>
                    {index < STATUS_ORDER.length - 1 ? (
                      <div
                        style={{
                          width: 2,
                          height: 32,
                          backgroundColor: index < currentStepIndex ? '#16a34a' : '#d1d5db',
                        }}
                      />
                    ) : null}
                  </div>
                  <div style={{ paddingBottom: '12px' }}>
                    <p
                      style={{
                        fontWeight: reached ? 700 : 400,
                        color: reached ? '#111827' : '#6b7280',
                        margin: 0,
                      }}
                    >
                      {STATUS_LABELS[status] ?? status}
                      {isCurrent ? (
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#16a34a' }}>● current</span>
                      ) : null}
                    </p>
                    {historyEntry ? (
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
                        {formatDateTime(historyEntry.reachedAt)}
                      </p>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ol>

          {timelineEntries.length > 0 ? (
            <div style={{ marginTop: 8 }}>
              <span className="eyebrow">History</span>
              <ul className="list">
                {timelineEntries.map((entry) => (
                  <li key={entry.key}>
                    <div className="cart-line-header">
                      <strong>{STATUS_LABELS[entry.status] ?? entry.status}</strong>
                      <span>{formatTime(entry.reachedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
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
                {item.modifiers && item.modifiers.length > 0 ? (
                  <p className="muted">{item.modifiers.join(' · ')}</p>
                ) : null}
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

        <section className="panel stack">
          <span className="eyebrow">Split the bill</span>
          <p className="helper-text">
            Divide the total equally between everyone, or assign each item to a guest. Splits are calculated on your
            device — no account needed.
          </p>

          <div className="pill-row">
            <button
              className={splitMode === 'equal' ? 'button' : 'button-secondary'}
              type="button"
              onClick={() => setSplitMode('equal')}
            >
              Equally
            </button>
            <button
              className={splitMode === 'items' ? 'button' : 'button-secondary'}
              type="button"
              onClick={() => setSplitMode('items')}
            >
              By items
            </button>
          </div>

          {splitMode === 'equal' ? (
            <div className="stack">
              <div className="field">
                <label htmlFor="splitPeopleCount">Number of people</label>
                <input
                  id="splitPeopleCount"
                  type="number"
                  min={1}
                  max={20}
                  value={peopleCount}
                  onChange={(event) => setPeopleCount(event.target.value)}
                />
              </div>
              <ul className="list">
                {equalShares.map((share, index) => (
                  <li key={`share-${index}`}>
                    <div className="cart-line-header">
                      <strong>Person {index + 1}</strong>
                      <span>{formatCurrency(share, data.order.currency)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {splitMode === 'items' ? (
            <div className="stack">
              <div className="field">
                <label htmlFor="splitItemsPeopleCount">Number of guests</label>
                <input
                  id="splitItemsPeopleCount"
                  type="number"
                  min={1}
                  max={20}
                  value={peopleCount}
                  onChange={(event) => setPeopleCount(event.target.value)}
                />
              </div>
              <ul className="list">
                {data.items.map((item) => (
                  <li key={item.id}>
                    <div className="cart-line-header">
                      <strong>{item.item_name}</strong>
                      <span>{formatCurrency(item.unit_price * item.quantity, data.order.currency)}</span>
                    </div>
                    <div className="field">
                      <label htmlFor={`guest-${item.id}`}>Guest</label>
                      <select
                        id={`guest-${item.id}`}
                        value={guestAssignments[item.id] ?? 0}
                        onChange={(event) =>
                          setGuestAssignments((current) => ({
                            ...current,
                            [item.id]: Number(event.target.value),
                          }))
                        }
                      >
                        {Array.from({ length: peopleCountParsed }, (_, index) => (
                          <option key={index} value={index}>
                            Guest {index + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
              <span className="eyebrow">Guest totals</span>
              <ul className="list">
                {Array.from({ length: peopleCountParsed }, (_, index) => (
                  <li key={`guest-total-${index}`}>
                    <div className="cart-line-header">
                      <strong>Guest {index + 1}</strong>
                      <span>{formatCurrency(guestTotals[index] || 0, data.order.currency)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}