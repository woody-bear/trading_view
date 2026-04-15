export type MetricHighlight = 'undervalued' | 'overvalued' | 'good' | 'income'

interface Props {
  label: string
  value: string | null
  unit?: string
  sublabel?: string
  highlight?: MetricHighlight
}

const COLOR: Record<MetricHighlight, string> = {
  undervalued: 'text-blue-400',
  overvalued: 'text-red-400',
  good: 'text-green-400',
  income: 'text-yellow-400',
}

const BG: Record<MetricHighlight, string> = {
  undervalued: 'bg-blue-500/10',
  overvalued: 'bg-red-500/10',
  good: 'bg-green-500/10',
  income: 'bg-yellow-500/10',
}

const HINT: Record<MetricHighlight, string> = {
  undervalued: '저평가',
  overvalued: '고평가',
  good: '우수',
  income: '고배당',
}

export default function MetricCard({ label, value, unit, sublabel, highlight }: Props) {
  const display = value == null ? '—' : unit ? `${value}${unit}` : value
  const isEmpty = value == null
  const color = highlight && !isEmpty ? COLOR[highlight] : 'text-white'
  const bg = highlight && !isEmpty ? BG[highlight] : 'bg-[var(--card)]'
  const hint = highlight && !isEmpty ? HINT[highlight] : null

  return (
    <div className={`value-tab-section ${bg} border border-[var(--border)] rounded-lg p-3 flex flex-col`}>
      <div className="text-xs text-[var(--muted)] mb-1">{label}</div>
      <div className={`text-base md:text-lg font-mono font-bold ${isEmpty ? 'text-[var(--muted)]' : color}`}>
        {display}
      </div>
      {sublabel && !isEmpty && (
        <div className="text-[10px] text-[var(--muted)] mt-0.5">{sublabel}</div>
      )}
      {hint && (
        <div className={`text-[10px] font-bold ${color} mt-0.5`}>{hint}</div>
      )}
    </div>
  )
}
