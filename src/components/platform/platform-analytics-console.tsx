'use client'

import { useEffect, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import { getPlatformAnalytics, type PlatformAnalyticsMetrics } from '@/lib/analytics/platform'
import { exportToPDF, exportToCSV } from '@/lib/export/analytics-export'
import { useLanguage } from '@/components/app/language-provider'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

export function PlatformAnalyticsConsole() {
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<PlatformAnalyticsMetrics | null>(null)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    async function loadAnalytics() {
      try {
        const context = await getClientUserContext()

        if (!context.user) {
          setError(t('platformAnalytics.authMissing'))
          setLoading(false)
          return
        }

        if (!context.isPlatformAdmin) {
          setError(t('platformAnalytics.noAccess'))
          setLoading(false)
          return
        }

        const analyticsData = await getPlatformAnalytics()
        setMetrics(analyticsData)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : t('platformAnalytics.loadError'))
        console.error('Platform analytics load error:', err)
      } finally {
        setLoading(false)
      }
    }

    void loadAnalytics()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <span className="eyebrow">{t('platformAnalytics.eyebrow')}</span>
        <h1 className="section-title">{t('platformAnalytics.loading')}</h1>
      </section>
    )
  }

  if (error || !metrics) {
    return (
      <section className="panel stack">
        <span className="eyebrow">{t('platformAnalytics.eyebrow')}</span>
        <h1 className="section-title">{t('platformAnalytics.title')}</h1>
        {error ? <div className="error-box">{error}</div> : null}
      </section>
    )
  }

  return (
    <>
      <section className="panel stack">
        <span className="eyebrow">{t('platformAnalytics.eyebrow')}</span>
        <h1 className="section-title">{t('platformAnalytics.title')}</h1>
        <p className="lead">{t('platformAnalytics.lead')}</p>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          <button type="button" className="button-secondary" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? t('analytics.exporting') : t('analytics.exportPdf')}
          </button>
          <button type="button" className="button-secondary" onClick={handleExportCSV} disabled={exporting}>
            {exporting ? t('analytics.exporting') : t('analytics.exportCsv')}
          </button>
        </div>
      </section>

      <section className="panel stack" id="platform-analytics-content">
        <span className="eyebrow">{t('platformAnalytics.restaurantsEyebrow')}</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.totalRestaurants')}</strong>
              <span className="badge">{metrics.totalRestaurants}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.activeRestaurants')}</strong>
              <span className="badge">{metrics.activeRestaurants}</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('platformAnalytics.infrastructureEyebrow')}</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.totalTables')}</strong>
              <span className="badge">{metrics.totalTables}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.tablesPerRestaurant')}</strong>
              <span className="badge">
                {metrics.totalRestaurants > 0 ? (metrics.totalTables / metrics.totalRestaurants).toFixed(1) : 0}
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('platformAnalytics.ordersEyebrow')}</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.totalOrders')}</strong>
              <span className="badge">{metrics.totalOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.ordersToday')}</strong>
              <span className="badge">{metrics.todayOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.averageOrderValue')}</strong>
              <span className="badge">{formatCurrency(metrics.averageOrderValue)}</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('platformAnalytics.revenueEyebrow')}</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.totalOrderValue')}</strong>
              <span className="badge">{formatCurrency(metrics.totalOrderValue)}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('platformAnalytics.averagePerRestaurant')}</strong>
              <span className="badge">
                {formatCurrency(metrics.totalRestaurants > 0 ? metrics.totalOrderValue / metrics.totalRestaurants : 0)}
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('platformAnalytics.topRestaurantsEyebrow')}</span>
        {metrics.topRestaurants.length === 0 ? (
          <p className="muted">{t('platformAnalytics.noRestaurantData')}</p>
        ) : (
          <ol className="list">
            {metrics.topRestaurants.map((restaurant, index) => (
              <li key={restaurant.name}>
                <div className="cart-line-header">
                  <div>
                    <strong>
                      {index + 1}. {restaurant.name}
                    </strong>
                    <p className="muted">{t('platformAnalytics.ordersCount', { count: restaurant.orders })}</p>
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
