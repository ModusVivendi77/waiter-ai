'use client'

import { useEffect, useMemo, useState } from 'react'

import { getClientUserContext } from '@/lib/auth/client'
import { createClient } from '@/lib/supabase/client'
import { getRestaurantAnalytics, type AnalyticsMetrics, type AnalyticsRange } from '@/lib/analytics/restaurant'
import { getStaffPerformanceAnalytics, type StaffPerformanceMetrics } from '@/lib/analytics/staff'
import { listTeamMembers } from '@/lib/auth/team-actions'
import { OrderTrendChart, OrderCountChart, OrderValueChart } from '@/components/charts/trend-charts'
import { DateRangeSelector } from '@/components/charts/date-range-selector'
import { exportToPDF, exportToCSV } from '@/lib/export/analytics-export'
import { useLanguage } from '@/components/app/language-provider'
import { LoadingBar } from '@/components/app/loading-bar'

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

function formatChangePct(value: number): { label: string; className: string } {
  if (value > 0) return { label: `▲ ${value}%`, className: 'badge' }
  if (value < 0) return { label: `▼ ${Math.abs(value)}%`, className: 'badge' }
  return { label: '0%', className: 'badge' }
}

export function AnalyticsConsole() {
  const supabase = useMemo(() => createClient(), [])
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restaurantName, setRestaurantName] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null)
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month')
  const [customRange, setCustomRange] = useState<AnalyticsRange | null>(null)
  const [exporting, setExporting] = useState(false)
  const [restaurantOptions, setRestaurantOptions] = useState<Array<{ id: string; name: string }>>([])
  const [selectedRestaurantId, setSelectedRestaurantId] = useState('')
  const [staffMetrics, setStaffMetrics] = useState<StaffPerformanceMetrics | null>(null)
  const [staffEmailMap, setStaffEmailMap] = useState<Record<string, string>>({})

  async function loadAnalytics(range?: AnalyticsRange, restaurantOverrideId?: string) {
    try {
      const context = await getClientUserContext()

      if (!context.user) {
        setError('Auth session missing!')
        setLoading(false)
        return
      }

      const savedRestaurantId = typeof window !== 'undefined' ? localStorage.getItem('staffAnalyticsRestaurantId') || '' : ''

      let targetRestaurantId: string
      let targetRestaurantName: string

      if (context.isPlatformAdmin) {
        // SUPER_ADMIN can view analytics for any restaurant.
        const { data: restaurants, error: restaurantsError } = await supabase.from('restaurants').select('id, name').order('name')

        if (restaurantsError || !restaurants || restaurants.length === 0) {
          setError(restaurantsError?.message || 'No restaurants found for platform administration.')
          setLoading(false)
          return
        }

        const typedRestaurants = (restaurants as Array<{ id: string; name: string }>) || []
        const candidateId = restaurantOverrideId || selectedRestaurantId || savedRestaurantId
        const selected = typedRestaurants.find((r) => r.id === candidateId) ?? typedRestaurants[0]

        setRestaurantOptions(typedRestaurants)
        setSelectedRestaurantId(selected.id)
        if (typeof window !== 'undefined') {
          localStorage.setItem('staffAnalyticsRestaurantId', selected.id)
        }
        targetRestaurantId = selected.id
        targetRestaurantName = selected.name
      } else {
        const memberships = context.memberships.filter((m) => ['OWNER', 'MANAGER'].includes(m.role))
        if (memberships.length === 0) {
          setError('You need restaurant access to view analytics.')
          setLoading(false)
          return
        }

        const candidateId = restaurantOverrideId || selectedRestaurantId || savedRestaurantId
        const membership = memberships.find((m) => m.restaurantId === candidateId) ?? memberships[0]

        if (memberships.length > 1) {
          setRestaurantOptions(memberships.map((m) => ({ id: m.restaurantId, name: m.restaurantName })))
          setSelectedRestaurantId(membership.restaurantId)
          if (typeof window !== 'undefined') {
            localStorage.setItem('staffAnalyticsRestaurantId', membership.restaurantId)
          }
        } else {
          setRestaurantOptions([])
        }

        targetRestaurantId = membership.restaurantId
        targetRestaurantName = membership.restaurantName
      }

      setRestaurantName(targetRestaurantName)

      const [analyticsData, staffData, teamResult] = await Promise.all([
        getRestaurantAnalytics(targetRestaurantId, range),
        getStaffPerformanceAnalytics(targetRestaurantId, range),
        listTeamMembers(targetRestaurantId).catch(() => ({ error: undefined, members: undefined })),
      ])
      setMetrics(analyticsData)
      setStaffMetrics(staffData)
      setStaffEmailMap(
        Object.fromEntries((teamResult.members || []).map((member) => [member.userId, member.email]))
      )
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics')
      console.error('Analytics load error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadAnalytics()
  }, [])

  function handleCustomRange(from: string, to: string) {
    setLoading(true)
    setCustomRange({ from, to })
    void loadAnalytics({ from, to })
  }

  function handleRestaurantSelection(nextRestaurantId: string) {
    setLoading(true)
    setSelectedRestaurantId(nextRestaurantId)
    const range = dateRange === 'custom' && customRange ? customRange : undefined
    void loadAnalytics(range, nextRestaurantId)
  }

  function handleRangeChange(range: 'today' | 'week' | 'month' | 'custom') {
    setDateRange(range)
    if (range !== 'custom') {
      setCustomRange(null)
    }
  }

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
        <LoadingBar />
      </section>
    )
  }

  if (error || !metrics) {
    return (
      <section className="panel stack">
        <span className="eyebrow">{t('analytics.eyebrow')}</span>
        <h1 className="section-title">{t('analytics.title', { restaurant: restaurantName || t('settings.yourRestaurant') })}</h1>
        {error ? <div className="error-box">{error}</div> : null}
      </section>
    )
  }

  return (
    <>
      <section className="panel stack">
        <span className="eyebrow">{t('analytics.eyebrow')}</span>
        <h1 className="section-title">{t('analytics.title', { restaurant: restaurantName ?? '' })}</h1>
        <p className="lead">{t('analytics.lead')}</p>
        {restaurantOptions.length > 0 ? (
          <div className="field">
            <label htmlFor="analyticsRestaurantSelector">{t('analytics.restaurantContext')}</label>
            <select
              id="analyticsRestaurantSelector"
              value={selectedRestaurantId}
              onChange={(event) => handleRestaurantSelection(event.target.value)}
              disabled={loading}
            >
              {restaurantOptions.map((restaurant) => (
                <option key={restaurant.id} value={restaurant.id}>
                  {restaurant.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
          <button type="button" className="button-secondary" onClick={handleExportPDF} disabled={exporting}>
            {exporting ? t('analytics.exporting') : t('analytics.exportPdf')}
          </button>
          <button type="button" className="button-secondary" onClick={handleExportCSV} disabled={exporting}>
            {exporting ? t('analytics.exporting') : t('analytics.exportCsv')}
          </button>
        </div>
      </section>

      <section className="panel stack" id="analytics-content">
        <DateRangeSelector
          selectedRange={dateRange}
          onRangeChange={handleRangeChange}
          onCustomDateChange={handleCustomRange}
        />
      </section>

      {dateRange === 'custom' && customRange ? (
        <section className="panel stack">
          <span className="eyebrow">{t('analytics.customRange')}</span>
          <p className="helper-text">
            {customRange.from} → {customRange.to}
          </p>
          <ul className="list">
            <li>
              <div className="cart-line-header">
                <strong>{t('analytics.orders')}</strong>
                <span className="badge">{metrics.rangeOrders}</span>
              </div>
            </li>
            <li>
              <div className="cart-line-header">
                <strong>{t('analytics.orderValue')}</strong>
                <span className="badge">{formatCurrency(metrics.rangeValue)}</span>
              </div>
            </li>
            <li>
              <div className="cart-line-header">
                <strong>{t('analytics.averageOrderValue')}</strong>
                <span className="badge">{formatCurrency(metrics.rangeAverageOrderValue)}</span>
              </div>
            </li>
          </ul>

          <span className="eyebrow" style={{ marginTop: '12px' }}>{t('analytics.dailyTrendCustom')}</span>
          <ul className="list">
            {metrics.rangeDaily.map((day) => (
              <li key={day.date}>
                <div className="cart-line-header">
                  <div>
                    <strong>{formatDate(day.date)}</strong>
                    <p className="muted">{t('analytics.ordersCount', { count: day.orderCount })}</p>
                  </div>
                  <span>{formatCurrency(day.orderValue)}</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="panel stack">
        <span className="eyebrow">{t('analytics.today')}</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.orders')}</strong>
              <span className="badge">{metrics.todayOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.orderValue')}</strong>
              <span className="badge">{formatCurrency(metrics.todayValue)}</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('analytics.thisWeek')}</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.orders')}</strong>
              <span className="badge">{metrics.weekOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.orderValue')}</strong>
              <span className="badge">{formatCurrency(metrics.weekValue)}</span>
            </div>
          </li>
        </ul>

        <span className="eyebrow" style={{ marginTop: '12px' }}>{t('analytics.weekComparison')}</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.ordersVsPrevWeek')}</strong>
              <span className={formatChangePct(metrics.weekOrdersChangePct).className}>
                {formatChangePct(metrics.weekOrdersChangePct).label}
                <span className="muted"> ({metrics.weekOrders} vs {metrics.previousWeekOrders})</span>
              </span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.valueVsPrevWeek')}</strong>
              <span className={formatChangePct(metrics.weekValueChangePct).className}>
                {formatChangePct(metrics.weekValueChangePct).label}
                <span className="muted"> ({formatCurrency(metrics.weekValue)} vs {formatCurrency(metrics.previousWeekValue)})</span>
              </span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('analytics.last30Days')}</span>
        <ul className="list">
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.orders')}</strong>
              <span className="badge">{metrics.monthOrders}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.orderValue')}</strong>
              <span className="badge">{formatCurrency(metrics.monthValue)}</span>
            </div>
          </li>
          <li>
            <div className="cart-line-header">
              <strong>{t('analytics.averageOrderValue')}</strong>
              <span className="badge">{formatCurrency(metrics.averageOrderValue)}</span>
            </div>
          </li>
        </ul>
      </section>

      <section className="panel stack">
        <OrderTrendChart data={metrics.lastSevenDays} title={t('analytics.trendChartTitle')} height={350} />
      </section>

      <section className="panel stack">
        <OrderCountChart data={metrics.lastSevenDays} title={t('analytics.countChartTitle')} height={300} />
      </section>

      <section className="panel stack">
        <OrderValueChart data={metrics.lastSevenDays} title={t('analytics.valueChartTitle')} height={300} />
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('analytics.statusFunnel')}</span>
        <p className="helper-text">{t('analytics.statusFunnelHelper')}</p>
        {metrics.statusFunnel.every((entry) => entry.count === 0) ? (
          <p className="muted">{t('analytics.noOrders30d')}</p>
        ) : (
          <ul className="list">
            {metrics.statusFunnel.map((entry, index) => (
              <li key={entry.status}>
                <div className="cart-line-header">
                  <div>
                    <strong>{entry.status}</strong>
                    <p className="muted">
                      {t('analytics.stepOf', { step: index + 1, total: metrics.statusFunnel.length })}
                    </p>
                  </div>
                  <span className="badge">{entry.count}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('analytics.topProducts')}</span>
        {metrics.topProducts.length === 0 ? (
          <p className="muted">{t('analytics.noProducts30d')}</p>
        ) : (
          <ol className="list">
            {metrics.topProducts.map((product, index) => (
              <li key={product.itemName}>
                <div className="cart-line-header">
                  <div>
                    <strong>
                      {index + 1}. {product.itemName}
                    </strong>
                    <p className="muted">{t('analytics.soldTimes', { count: product.quantity })}</p>
                  </div>
                  <span>{formatCurrency(product.value)}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('analytics.dailyTrend7')}</span>
        <ul className="list">
          {metrics.lastSevenDays.map((day) => (
            <li key={day.date}>
              <div className="cart-line-header">
                <div>
                  <strong>{formatDate(day.date)}</strong>
                  <p className="muted">{t('analytics.ordersCount', { count: day.orderCount })}</p>
                </div>
                <span>{formatCurrency(day.orderValue)}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel stack">
        <span className="eyebrow">{t('analytics.staffPerformance')}</span>
        <p className="helper-text">{t('analytics.staffHelper')}</p>

        {staffMetrics && staffMetrics.staff.length > 0 ? (
          <>
            <ul className="list">
              <li>
                <div className="cart-line-header">
                  <strong>{t('analytics.activeStaff')}</strong>
                  <span className="badge">{staffMetrics.activeStaffCount}</span>
                </div>
              </li>
              <li>
                <div className="cart-line-header">
                  <strong>{t('analytics.ordersHandled')}</strong>
                  <span className="badge">{staffMetrics.totalOrdersHandled}</span>
                </div>
              </li>
              <li>
                <div className="cart-line-header">
                  <strong>{t('analytics.revenueServed')}</strong>
                  <span>{formatCurrency(staffMetrics.totalRevenueHandled)}</span>
                </div>
              </li>
            </ul>

            <span className="eyebrow" style={{ marginTop: '12px' }}>{t('analytics.byStaffMember')}</span>
            <ul className="list">
              {staffMetrics.staff.map((entry) => (
                <li key={entry.staffId}>
                  <div className="cart-line-header">
                    <div>
                      <strong>{staffEmailMap[entry.staffId] ?? t('orders.staffMember')}</strong>
                      <p className="muted">
                        {t('analytics.staffLine', {
                          orders: entry.ordersHandled,
                          tables: entry.tablesServed,
                          avg: formatCurrency(entry.averageOrderValue),
                        })}
                      </p>
                    </div>
                    <span>{formatCurrency(entry.revenueHandled)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">{t('analytics.noStaffData')}</p>
        )}
      </section>
    </>
  )
}
