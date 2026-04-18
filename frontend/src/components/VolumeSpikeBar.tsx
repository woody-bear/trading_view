import type { VolumeSpikeStats } from '../api/client'

interface Props {
  market: string
  data: VolumeSpikeStats | null | undefined
  loading: boolean
}

const MARKET_LABEL: Record<string, string> = {
  KR: '🇰🇷 국내',
  US: '🇺🇸 미국',
  CRYPTO: '₿ 크립토',
}

export default function VolumeSpikeBar({ market, data, loading }: Props) {
  const label = MARKET_LABEL[market] ?? market

  if (loading) {
    return (
      <div className="space-y-1">
        {[20, 30, 60].map(p => (
          <div key={p} className="flex items-center gap-2 py-1">
            <span className="text-xs text-[var(--muted)] w-16 shrink-0">{label} {p}일</span>
            <div className="flex-1 h-5 bg-[var(--border)] rounded animate-pulse" />
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.periods.length === 0) {
    return (
      <div className="flex items-center gap-2 py-1">
        <span className="text-xs text-[var(--muted)] w-16 shrink-0">{label}</span>
        <span className="text-xs text-[var(--muted)]">데이터 없음</span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {data.periods.map(period => {
        const spikePct = period.total > 0 ? period.spike_pct : 0
        const restPct = 100 - spikePct

        return (
          <div key={period.period_days} className="flex items-center gap-2 py-0.5">
            <span className="text-xs text-[var(--muted)] w-16 shrink-0">
              {label} {period.period_days}일
            </span>
            <div className="flex flex-1 h-5 rounded overflow-hidden">
              {spikePct > 0 && (
                <div
                  className="relative flex items-center justify-center overflow-hidden"
                  style={{ width: `${spikePct}%`, backgroundColor: '#f97316' }}
                  title={`급등: ${period.spike_count}종목 (${spikePct}%)`}
                >
                  {spikePct >= 6 && (
                    <span className="text-[10px] font-mono text-white leading-none select-none whitespace-nowrap px-0.5">
                      {period.spike_count} <span className="opacity-75">({spikePct}%)</span>
                    </span>
                  )}
                </div>
              )}
              {restPct > 0 && (
                <div
                  className="flex-1 h-full"
                  style={{ backgroundColor: '#374151' }}
                />
              )}
            </div>
            {period.top_sector && period.spike_count > 0 && (
              <span className="text-[10px] text-orange-400 whitespace-nowrap shrink-0 max-w-[80px] truncate">
                {period.top_sector}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}
