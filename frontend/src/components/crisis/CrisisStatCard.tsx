interface StatItem {
  indicator_id: number
  indicator_name: string
  max_drawdown_pct: number | null
  max_gain_pct: number | null
  days_to_bottom: number | null
  recovery_days: number | null
}

interface Props {
  stats: StatItem[]
}

function fmt(val: number | null, suffix = '%'): string {
  if (val === null || val === undefined) return '—'
  const sign = val > 0 ? '+' : ''
  return `${sign}${val.toFixed(1)}${suffix}`
}

function fmtDays(val: number | null): string {
  if (val === null || val === undefined) return '—'
  return `${val}일`
}

export default function CrisisStatCard({ stats }: Props) {
  if (!stats || stats.length === 0) return null

  return (
    <div className="px-3 pb-3">
      <div className="text-[10px] text-[var(--muted)] font-semibold mb-1.5 uppercase tracking-wider">이벤트 영향 요약</div>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {stats.map(s => (
          <div key={s.indicator_id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2">
            <div className="text-[9px] text-[var(--muted)] truncate mb-1">{s.indicator_name}</div>
            <div className="flex justify-between items-end">
              <div>
                <div className={`text-sm font-bold ${s.max_drawdown_pct !== null && s.max_drawdown_pct < 0 ? 'text-red-400' : 'text-[var(--text)]'}`}>
                  {fmt(s.max_drawdown_pct)}
                </div>
                <div className="text-[9px] text-[var(--muted)]">MDD</div>
              </div>
              <div className="text-right">
                <div className={`text-xs font-semibold ${s.max_gain_pct !== null && s.max_gain_pct > 0 ? 'text-green-400' : 'text-[var(--text)]'}`}>
                  {fmt(s.max_gain_pct)}
                </div>
                <div className="text-[9px] text-[var(--muted)]">최대상승</div>
              </div>
            </div>
            <div className="mt-1.5 pt-1.5 border-t border-[var(--border)] flex justify-between">
              <div>
                <div className="text-[10px] font-medium text-[var(--text)]">{fmtDays(s.days_to_bottom)}</div>
                <div className="text-[9px] text-[var(--muted)]">바닥까지</div>
              </div>
              <div className="text-right">
                <div className={`text-[10px] font-medium ${s.recovery_days === null ? 'text-orange-400' : 'text-[var(--text)]'}`}>
                  {s.recovery_days === null ? '미회복' : fmtDays(s.recovery_days)}
                </div>
                <div className="text-[9px] text-[var(--muted)]">회복</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
