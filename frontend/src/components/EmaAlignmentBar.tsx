import type { EmaAlignmentStats } from '../api/client'

interface Props {
  market: string
  data: EmaAlignmentStats | null | undefined
  loading: boolean
}

const MARKET_LABEL: Record<string, string> = {
  KR: '🇰🇷 국내',
  US: '🇺🇸 미국',
  CRYPTO: '₿ 크립토',
}

export default function EmaAlignmentBar({ market, data, loading }: Props) {
  const label = MARKET_LABEL[market] ?? market

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-xs text-[var(--muted)] w-16 shrink-0">{label}</span>
        <div className="flex-1 h-5 bg-[var(--border)] rounded animate-pulse" />
      </div>
    )
  }

  if (!data || data.total === 0) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-xs text-[var(--muted)] w-16 shrink-0">{label}</span>
        <span className="text-xs text-[var(--muted)]">데이터 없음</span>
      </div>
    )
  }

  const segments = [
    { key: 'golden', pct: data.golden_pct, count: data.golden, color: '#22c55e', title: '정배열' },
    { key: 'death',  pct: data.death_pct,  count: data.death,  color: '#ef4444', title: '역배열' },
    { key: 'other',  pct: data.other_pct,  count: data.other,  color: '#6b7280', title: '기타' },
  ]

  return (
    <div className="flex items-center gap-2 py-1">
      <span className="text-xs text-[var(--muted)] w-16 shrink-0">{label}</span>
      <div className="flex flex-1 h-5 rounded overflow-hidden">
        {segments.map(seg =>
          seg.pct > 0 ? (
            <div
              key={seg.key}
              className="relative flex items-center justify-center overflow-hidden"
              style={{ width: `${seg.pct}%`, backgroundColor: seg.color }}
              title={`${seg.title}: ${seg.count}종목 (${seg.pct}%)`}
            >
              {seg.pct >= 8 && (
                <span className="text-[10px] font-mono text-white leading-none select-none whitespace-nowrap px-0.5">
                  {seg.count} <span className="opacity-75">({seg.pct}%)</span>
                </span>
              )}
            </div>
          ) : null
        )}
      </div>
    </div>
  )
}
