'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { usePublicOrderStatus } from '@/lib/hooks/use-public-order-status'
import { useLanguage } from '@/components/app/language-provider'
import { LanguageToggle } from '@/components/app/language-toggle'
import { clearStoredOrder } from '@/lib/utils/order-storage'

type OrderStatusPayload = {
  order: {
    id: string
    orderNumber?: number | null
    status: string
    total: number
    currency: string
    customer_note: string | null
    created_at: string
  }
  table: {
    name: string
    qrToken?: string | null
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
  tableQrToken?: string | null
  initialOrder: OrderStatusPayload
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
  const date = new Date(value)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${String(date.getFullYear()).slice(-2)} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`
}

export function OrderStatusView({ trackingToken, tableQrToken, initialOrder }: Props) {
  const { t } = useLanguage()
  const router = useRouter()
  const [data, setData] = useState(initialOrder)
  const [currentTableQrToken, setCurrentTableQrToken] = useState<string | null>(tableQrToken ?? null)
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
    if (next.table?.qrToken) {
      setCurrentTableQrToken(next.table.qrToken)
    }
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
      <LanguageToggle style={{ position: 'fixed', top: 14, right: 18, zIndex: 30 }} />
      <div className="page-grid">
        <section className="hero-card">
          <span className="eyebrow">{t('track.eyebrow')}</span>
          <h1 className="hero-title">{data.restaurant.name}</h1>
          <p className="lead">
            {t('track.currently', {
              id: data.order.orderNumber != null ? String(data.order.orderNumber) : data.order.id.slice(0, 8),
              table: data.table.name,
              status: t(`status.${data.order.status}`),
            })}
          </p>
          <div className="pill-row">
            <span className="badge">{data.table.name}</span>
            <span className="badge">
              {t('track.lastUpdated')}: {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button-secondary"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
            >
              {isRefreshing ? t('track.refreshing') : t('track.refreshNow')}
            </button>
            {currentTableQrToken ? (
              <button
                type="button"
                className="button"
                onClick={() => {
                  // Clear the remembered order for this table so the menu page
                  // does not redirect straight back to this tracking view.
                  clearStoredOrder(currentTableQrToken)
                  router.push(`/t/${currentTableQrToken}`)
                }}
              >
                {t('track.newOrder')}
              </button>
            ) : null}
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('track.statusTimeline')}</span>
          {isTerminal ? (
            <div className="message">
              {currentStatus === 'SERVED'
                ? t('track.servedMessage')
                : t('track.terminalMessage', { status: t(`statusLabel.${currentStatus}`) })}
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
                      {t(`statusLabel.${status}`) ?? status}
                      {isCurrent ? (
                        <span style={{ marginLeft: 8, fontSize: 12, color: '#16a34a' }}>● {t('track.current')}</span>
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
              <span className="eyebrow">{t('track.history')}</span>
              <ul className="list">
                {timelineEntries.map((entry) => (
                  <li key={entry.key}>
                    <div className="cart-line-header">
                      <strong>{t(`statusLabel.${entry.status}`) ?? entry.status}</strong>
                      <span>{formatTime(entry.reachedAt)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('track.summary')}</span>
          {error ? <div className="error-box">{error}</div> : null}
          <ul className="list">
            {data.items.map((item) => (
              <li key={item.id}>
                <div className="cart-line-header">
                  <strong>{item.item_name}</strong>
                  <span>{formatCurrency(item.unit_price * item.quantity, data.order.currency)}</span>
                </div>
                <p className="muted">
                  {t('track.quantity')}: {item.quantity}
                </p>
                {item.modifiers && item.modifiers.length > 0 ? (
                  <p className="muted">{item.modifiers.join(' · ')}</p>
                ) : null}
                {item.notes ? (
                  <p className="muted">
                    {t('track.note')}: {item.notes}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          {data.order.customer_note ? <div className="message">{t('track.orderNote')}: {data.order.customer_note}</div> : null}
          <div className="cart-summary">
            <strong>{t('track.total')}</strong>
            <strong>{formatCurrency(data.order.total, data.order.currency)}</strong>
          </div>
        </section>

        <section className="panel stack">
          <span className="eyebrow">{t('track.splitBill')}</span>
          <p className="helper-text">{t('track.splitHelper')}</p>

          <div className="pill-row">
            <button
              className={splitMode === 'equal' ? 'button' : 'button-secondary'}
              type="button"
              onClick={() => setSplitMode('equal')}
            >
              {t('track.equal')}
            </button>
            <button
              className={splitMode === 'items' ? 'button' : 'button-secondary'}
              type="button"
              onClick={() => setSplitMode('items')}
            >
              {t('track.byItems')}
            </button>
          </div>

          {splitMode === 'equal' ? (
            <div className="stack">
              <div className="field">
                <label htmlFor="splitPeopleCount">{t('track.numberPeople')}</label>
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
                      <strong>
                        {t('track.person')} {index + 1}
                      </strong>
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
                <label htmlFor="splitItemsPeopleCount">{t('track.numberGuests')}</label>
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
                      <label htmlFor={`guest-${item.id}`}>{t('track.guest')}</label>
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
                            {t('track.guest')} {index + 1}
                          </option>
                        ))}
                      </select>
                    </div>
                  </li>
                ))}
              </ul>
              <span className="eyebrow">{t('track.guestTotals')}</span>
              <ul className="list">
                {Array.from({ length: peopleCountParsed }, (_, index) => (
                  <li key={`guest-total-${index}`}>
                    <div className="cart-line-header">
                      <strong>
                        {t('track.guest')} {index + 1}
                      </strong>
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