import type { ChartData } from '../../types'

const sqColors: Record<string, string> = {
  'NO SQ': '#22c55e',
  'LOW SQ': '#eab308',
  'MID SQ': '#f97316',
  'MAX SQ': '#ef4444',
}

export default function UBBPanel({ data }: { data: ChartData }) {
  const c = (data as any).current
  if (!c) return null

  const trendColor = c.trend === 'BULL' ? '#22c55e' : '#ef4444'
  const trendIcon = c.trend === 'BULL' ? '\u2191' : '\u2193'

  return (
    <div className="bg-[#0f172a] border border-[var(--border)] rounded-lg p-3 mb-3 inline-block">
      <div className="text-xs font-bold text-white mb-2">
        UBB Pro&nbsp;
        <span className="text-[var(--muted)] font-normal">{data.symbol} {data.timeframe}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
        <Row label="%B" value={c.pct_b != null ? `${c.pct_b.toFixed(1)}%` : '—'} />
        <Row label="BandWidth" value={c.bandwidth != null ? `${c.bandwidth.toFixed(2)}%` : '—'} />
        <Row label="RSI" value={c.rsi != null ? c.rsi.toFixed(1) : '—'} />
        <Row
          label="Squeeze"
          value={
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: sqColors[c.squeeze] || '#64748b' }} />
              <span style={{ color: sqColors[c.squeeze] || '#94a3b8' }}>{c.squeeze}</span>
            </span>
          }
        />
        <Row
          label="Trend"
          value={
            <span style={{ color: trendColor }}>
              {trendIcon} {c.trend}
            </span>
          }
        />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="text-white font-mono">{value}</span>
    </div>
  )
}
