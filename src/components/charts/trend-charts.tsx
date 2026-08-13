'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts'

type TrendDataPoint = {
  date: string
  orderCount: number
  orderValue: number
}

type Props = {
  data: TrendDataPoint[]
  title: string
  height?: number
}

function formatDate(dateString: string): string {
  const date = new Date(dateString + 'T00:00:00')
  return date.toLocaleDateString('en-GB', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatCurrency(value: number): string {
  return `€${(value / 1000).toFixed(1)}k`
}

export function OrderTrendChart({ data, title, height = 300 }: Props) {
  const chartData = data.map((point) => ({
    ...point,
    dateLabel: formatDate(point.date),
  }))

  return (
    <div style={{ width: '100%', marginTop: '12px' }}>
      <span className="eyebrow">{title}</span>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="dateLabel" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" />
          <Tooltip
            formatter={(value: any, name: any) => {
              if (name === 'orderCount') return [value, 'Orders']
              if (name === 'orderValue') return [formatCurrency(value), 'Value']
              return [value, name]
            }}
          />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="orderCount" stroke="#8884d8" name="Orders" />
          <Line yAxisId="right" type="monotone" dataKey="orderValue" stroke="#82ca9d" name="Order Value" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OrderCountChart({ data, title, height = 300 }: Props) {
  const chartData = data.map((point) => ({
    ...point,
    dateLabel: formatDate(point.date),
  }))

  return (
    <div style={{ width: '100%', marginTop: '12px' }}>
      <span className="eyebrow">{title}</span>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="dateLabel" />
          <YAxis />
          <Tooltip formatter={(value: any) => [value, 'Orders']} />
          <Bar dataKey="orderCount" fill="#8884d8" name="Orders" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function OrderValueChart({ data, title, height = 300 }: Props) {
  const chartData = data.map((point) => ({
    ...point,
    dateLabel: formatDate(point.date),
  }))

  return (
    <div style={{ width: '100%', marginTop: '12px' }}>
      <span className="eyebrow">{title}</span>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="dateLabel" />
          <YAxis />
          <Tooltip formatter={(value: any) => [formatCurrency(value), 'Value']} />
          <Bar dataKey="orderValue" fill="#82ca9d" name="Order Value" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
