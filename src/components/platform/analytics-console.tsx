'use client'

import { useEffect, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import { getRestaurantAnalytics, type AnalyticsMetrics } from '@/lib/analytics/restaurant'
import { OrderTrendChart, OrderCountChart, OrderValueChart } from '@/components/charts/trend-charts'
import { DateRangeSelector } from '@/components/charts/date-range-selector'
import { exportToPDF, exportToCSV } from '@/lib/export/analytics-export'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function AnalyticsConsole() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month')
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const context = await getClientUserContext()

        if (!context.user) {
          setError('Auth session missing!')
          setLoading(false)
          return
        }

        const membership = context.memberships.find((m) => ['OWNER', 'MANAGER'].includes(m.role))
        if (!membership) {
          setError('You need restaurant access to view analytics.')
          setLoading(false)
          return
        }

        setRestaurantName(membership.restaurantName)

        const analyticsData = await getRestaurantAnalytics(membership.restaurantId)
        setMetrics(analyticsData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
        console.error('Analytics load error:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadAnalytics()
  }, [])

  const handleExportPDF = async () => {
    try {
      setExporting(true)
      await exportToPDF('analytics-content', `analytics-${restaurantName}`)
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      setExporting(true)
      const csvData = metrics?.lastSevenDays.map((day) => ({
        Date: day.date,
        Orders: day.orderCount,
        'Order Value': day.orderValue,
      })) || []
      await exportToCSV(csvData, `daily-analytics-${restaurantName}`)
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <section className="panel stack">
        <span className="eyebrow">Analytics</span>
        <h1 className="section-title">Loading restaurant analytics...</h1>
      </section>
    )
  }

  if (error || !metrics) {
    return (
      <section className="panel stack">
        <span className="eyebrow">Analytics</span>
        <h1 className="section-title">Analytics for {restaurantName || 'your restaurant'}</h1>
        {error ? <div className="error-box">{error}</div> : null}
      </section>
    )
  }

  return (
    <>
      <section className="panel stack">
        <span className="eyebrow">Analytics</span>
        <h1 className="section-title">Analytics for {restaurantName}</h1>
        <p className="lead">View order trends, revenue insights, and popular items for your restaurant.</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          <button type="button" className="button-secondary" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export as PDF'}
          </button>
          <button type="button" className="button-secondary" onClick={handleExportCSV} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export as CSV'}
          </button>
        </div>
      </section>

      <section className="panel stack" id="analytics-content">
        <DateRangeSelector selectedRange={dateRange} onRangeChange={setDateRange} />
      </section>

      <section className="panel stack">
        <span className="eyebrow">Today</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>Orders</strong>
              <span className="badge">{metrics.todayOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>Order value</strong>
              <span className="badge">{formatCurrency(metrics.todayValue)}</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">This Week</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>Orders</strong>
              <span className="badge">{metrics.weekOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>Order value</strong>
              <span className="badge">{formatCurrency(metrics.weekValue)}</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Last 30 Days</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>Orders</strong>
              <span className="badge">{metrics.monthOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>Order value</strong>
              <span className="badge">{formatCurrency(metrics.monthValue)}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>Average order value</strong>
              <span className="badge">{formatCurrency(metrics.averageOrderValue)}</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <OrderTrendChart data={metrics.lastSevenDays} title="Orders & Revenue Trend (7 Days)" height={350} />
      </section>

      <section className="panel stack">
        <OrderCountChart data={metrics.lastSevenDays} title="Daily Order Volume (7 Days)" height={300} />
      </section>

      <section className="panel stack">
        <OrderValueChart data={metrics.lastSevenDays} title="Daily Revenue (7 Days)" height={300} />
      </section>

      <section className="panel stack">
        <span className="eyebrow">Top Products</span>
        {metrics.topProducts.length === 0 ? (
          <p className="muted">No products sold yet in the last 30 days.</p>
        ) : (
          <ol className="list">
            {metrics.topProducts.map((product, index) => (
              <li key={product.itemName}>
                <div className="cart-line-header">
                  <div>
                    <strong>
                      {index + 1}. {product.itemName}
                    </strong>
                    <p className="muted">Sold {product.quantity} times</p>
                  </div>
                  <span>{formatCurrency(product.value)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel stack">
        <span className="eyebrow">Daily Trend (Last 7 Days)</span>
        <ul className="list">
          {metrics.lastSevenDays.map((day) => (
            <li key={day.date}>
              <div className="cart-line-header">
                <div>
                  <strong>{formatDate(day.date)}</strong>
                  <p className="muted">{day.orderCount} orders</p>
                </div>
                <span>{formatCurrency(day.orderValue)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
