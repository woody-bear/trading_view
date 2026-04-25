type Period = '1m' | '3m' | '6m' | '12m'

const PERIODS: { key: Period; label: string }[] = [
  { key: '1m', label: '1M' },
  { key: '3m', label: '3M' },
  { key: '6m', label: '6M' },
  { key: '12m', label: '12M' },
]

interface Props {
  selected: Period
  onChange: (p: Period) => void
}

export default function TrendPeriodTabs({ selected, onChange }: Props) {
  return (
    <div
      className="flex items-center gap-1 mb-2"
      style={{ padding: '4px 0' }}
    >
      {PERIODS.map(({ key, label }) => (
        <button
          key={key}
          onClick={() => onChange(key)}
          style={{
            padding: '3px 10px',
            borderRadius: 4,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-mono)',
            border: '1px solid var(--border)',
            cursor: 'pointer',
            background: selected === key ? 'var(--accent)' : 'var(--bg-2)',
            color: selected === key ? 'var(--bg-0)' : 'var(--fg-2)',
            transition: 'background 0.15s, color 0.15s',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
