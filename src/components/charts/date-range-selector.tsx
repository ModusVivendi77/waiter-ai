'use client'

type DateRange = 'today' | 'week' | 'month' | 'custom'

type Props = {
  selectedRange: DateRange
  onRangeChange: (range: DateRange) => void
  onCustomDateChange?: (startDate: string, endDate: string) => void
}

export function DateRangeSelector({ selectedRange, onRangeChange, onCustomDateChange }: Props) {
  const ranges: { value: DateRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'Last 30 Days' },
    { value: 'custom', label: 'Custom Range' },
  ]

  const handleCustomDates = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const startDate = formData.get('startDate') as string
    const endDate = formData.get('endDate') as string

    if (startDate && endDate && onCustomDateChange) {
      onCustomDateChange(startDate, endDate)
    }
  }

  return (
    <div className="field">
      <label>Date Range</label>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        {ranges.map((range) => (
          <button
            key={range.value}
            type="button"
            className={selectedRange === range.value ? 'button' : 'button-secondary'}
            onClick={() => onRangeChange(range.value)}
          >
            {range.label}
          </button>
        ))}
      </div>

      {selectedRange === 'custom' && (
        <form onSubmit={handleCustomDates} style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="startDate">Start Date</label>
            <input type="date" id="startDate" name="startDate" required />
          </div>
          <div className="field" style={{ flex: 1, marginBottom: 0 }}>
            <label htmlFor="endDate">End Date</label>
            <input type="date" id="endDate" name="endDate" required />
          </div>
          <button type="submit" className="button-secondary">
            Apply
          </button>
        </form>
      )}
    </div>
  )
}
