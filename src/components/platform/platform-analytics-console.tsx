'use client'

import { useEffect, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import { getPlatformAnalytics, type PlatformAnalyticsMetrics } from '@/lib/analytics/platform'
import { exportToPDF, exportToCSV } from '@/lib/export/analytics-export'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

export function PlatformAnalyticsConsole() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<PlatformAnalyticsMetrics | null>(null)
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

        if (!context.isPlatformAdmin) {
          setError('You need platform admin access to view platform analytics.')
          setLoading(false)
          return
        }

        const analyticsData = await getPlatformAnalytics()
        setMetrics(analyticsData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load platform analytics')
        console.error('Platform analytics load error:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadAnalytics()
  }, [])

  const handleExportPDF = async () => {
    try {
      setExporting(true)
      await exportToPDF('platform-analytics-content', 'platform-analytics')
    } catch (err) {
      console.error('PDF export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      setExporting(true)
      const csvData = metrics?.topRestaurants.map((restaurant) => ({
        Restaurant: restaurant.name,
        Orders: restaurant.orders,
        'Total Value': restaurant.value,
      })) || []
      await exportToCSV(csvData, 'platform-analytics-restaurants')
    } catch (err) {
      console.error('CSV export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <section className="panel stack">
        <span className="eyebrow">Platform Analytics</span>
        <h1 className="section-title">Loading platform analytics...</h1>
      </section>
    )
  }

  if (error || !metrics) {
    return (
      <section className="panel stack">
        <span className="eyebrow">Platform Analytics</span>
        <h1 className="section-title">Platform Overview</h1>
        {error ? <div className="error-box">{error}</div> : null}
      </section>
    )
  }

  return (
    <>
      <section className="panel stack">
        <span className="eyebrow">Platform Analytics</span>
        <h1 className="section-title">Platform Overview (SUPER_ADMIN)</h1>
        <p className="lead">View platform-wide metrics and restaurant performance rankings.</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          <button type="button" className="button-secondary" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export as PDF'}
          </button>
          <button type="button" className="button-secondary" onClick={handleExportCSV} disabled={exporting}>
            {exporting ? 'Exporting...' : 'Export as CSV'}
          </button>
        </div>
      </section>

      <section className="panel stack" id="platform-analytics-content">
        <span className="eyebrow">Restaurants</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>Total restaurants</strong>
              <span className="badge">{metrics.totalRestaurants}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>Active restaurants (30d)</strong>
              <span className="badge">{metrics.activeRestaurants}</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Infrastructure</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>Total tables</strong>
              <span className="badge">{metrics.totalTables}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>Tables per restaurant</strong>
              <span className="badge">
                {metrics.totalRestaurants > 0 ? (metrics.totalTables / metrics.totalRestaurants).toFixed(1) : 0}
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Orders</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>Total orders (30d)</strong>
              <span className="badge">{metrics.totalOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>Orders today</strong>
              <span className="badge">{metrics.todayOrders}</span>
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
        <span className="eyebrow">Revenue</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>Total order value (30d)</strong>
              <span className="badge">{formatCurrency(metrics.totalOrderValue)}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>Average per restaurant</strong>
              <span className="badge">
                {formatCurrency(metrics.totalRestaurants > 0 ? metrics.totalOrderValue / metrics.totalRestaurants : 0)}
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">Top Restaurants by Orders</span>
        {metrics.topRestaurants.length === 0 ? (
          <p className="muted">No restaurant data available yet.</p>
        ) : (
          <ol className="list">
            {metrics.topRestaurants.map((restaurant, index) => (
              <li key={restaurant.name}>
                <div className="cart-line-header">
                  <div>
                    <strong>
                      {index + 1}. {restaurant.name}
                    </strong>
                    <p className="muted">{restaurant.orders} orders</p>
                  </div>
                  <span>{formatCurrency(restaurant.value)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>
    </>
  )
}
