import { useState } from 'react'

interface CrisisEvent {
  id: number
  name: string
  event_type: string
  start_date: string
  end_date: string | null
  is_ongoing: boolean
  severity_level: string
  description: string
  has_comparison: boolean
}

const TYPE_LABELS: Record<string, string> = {
  war: '전쟁',
  pandemic: '팬데믹',
  financial_crisis: '금융위기',
  natural_disaster: '자연재해',
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  moderate: 'text-yellow-400',
  low: 'text-green-400',
}

const FILTER_TABS = [
  { key: '', label: '전체' },
  { key: 'war', label: '전쟁' },
  { key: 'pandemic', label: '팬데믹' },
  { key: 'financial_crisis', label: '금융위기' },
  { key: 'natural_disaster', label: '자연재해' },
]

interface Props {
  events: CrisisEvent[]
  selectedId: number | null
  onSelect: (event: CrisisEvent) => void
  onFilterChange?: (type: string) => void
}

export default function CrisisEventList({ events, selectedId, onSelect, onFilterChange }: Props) {
  const [activeFilter, setActiveFilter] = useState('')

  const handleFilter = (key: string) => {
    setActiveFilter(key)
    onFilterChange?.(key)
  }

  return (
    <div className="flex flex-col h-full">
      {/* 유형 필터 탭 */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto shrink-0 scrollbar-none" style={{ touchAction: 'pan-x' }}>
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => handleFilter(tab.key)}
            className={`shrink-0 text-xs px-3 py-1 rounded-full border transition ${
              activeFilter === tab.key
                ? 'bg-[var(--gold)] text-black border-[var(--gold)] font-semibold'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 이벤트 목록 */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1.5">
        {events.length === 0 && (
          <div className="text-center py-10 text-[var(--muted)] text-sm">이벤트 없음</div>
        )}
        {events.map(event => {
          const isSelected = event.id === selectedId
          return (
            <button
              key={event.id}
              onClick={() => onSelect(event)}
              className={`w-full text-left rounded-lg p-3 border transition ${
                isSelected
                  ? 'bg-[var(--navy)] border-[var(--gold)]/60'
                  : 'bg-[var(--card)] border-[var(--border)] hover:border-[var(--gold)]/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {event.is_ongoing && (
                      <span className="text-[9px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold animate-pulse">진행중</span>
                    )}
                    <span className="text-xs font-semibold text-[var(--text)] truncate">{event.name}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-[var(--muted)]">{event.start_date.slice(0, 4)}</span>
                    <span className="text-[10px] text-[var(--muted)]">{TYPE_LABELS[event.event_type] || event.event_type}</span>
                    <span className={`text-[10px] font-semibold ${SEVERITY_COLORS[event.severity_level] || 'text-[var(--muted)]'}`}>
                      {event.severity_level.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
