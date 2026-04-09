import { useQuery } from '@tanstack/react-query'
import { fetchCompanyInfo, type RevenueSegment } from '../api/client'

interface Props {
  symbol: string
  market: string
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#84cc16']

function DonutChart({ segments }: { segments: RevenueSegment[] }) {
  const radius = 35
  const circumference = 2 * Math.PI * radius
  let offset = 0

  const slices = segments.map((seg, i) => {
    const dash = (seg.percentage / 100) * circumference
    const gap = circumference - dash
    const slice = (
      <circle
        key={i}
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke={COLORS[i % COLORS.length]}
        strokeWidth="12"
        strokeDasharray={`${dash} ${gap}`}
        strokeDashoffset={-offset}
        transform="rotate(-90 50 50)"
        style={{ transition: 'stroke-dashoffset 0.3s ease' }}
      />
    )
    offset += dash
    return slice
  })

  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24 flex-shrink-0">
      {/* 배경 원 */}
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--border)" strokeWidth="12" />
      {slices}
    </svg>
  )
}

function Legend({ segments }: { segments: RevenueSegment[] }) {
  return (
    <div className="flex-1 grid grid-cols-1 gap-1 min-w-0">
      {segments.map((seg, i) => (
        <div key={i} className="flex items-center gap-1.5 min-w-0">
          <div
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: COLORS[i % COLORS.length] }}
          />
          <span className="text-[11px] text-[var(--muted)] truncate">{seg.name}</span>
          <span className="text-[11px] text-white font-mono ml-auto flex-shrink-0">{seg.percentage.toFixed(1)}%</span>
        </div>
      ))}
    </div>
  )
}

export default function RevenueSegmentChart({ symbol, market }: Props) {
  const isCrypto = market === 'CRYPTO'

  const { data, isLoading } = useQuery({
    queryKey: ['company-info', symbol, market],
    queryFn: () => fetchCompanyInfo(symbol, market),
    enabled: !isCrypto,
    staleTime: 3600000,
    retry: 1,
  })

  if (isCrypto) return null

  if (isLoading || !data?.revenue_segments || data.revenue_segments.length === 0) return null

  const segments = data.revenue_segments
  const period = segments[0]?.period
    ? segments[0].period.replace('-', '.')
    : null

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4">
      <div className="text-xs text-[var(--muted)] mb-3 font-medium">
        매출 구성{period && <span className="ml-1 text-[9px]">({period} 기준)</span>}
      </div>
      <div className="flex items-center gap-4">
        <DonutChart segments={segments} />
        <Legend segments={segments} />
      </div>
    </div>
  )
}
