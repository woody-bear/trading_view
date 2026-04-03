import { useState } from 'react'

interface Props {
  onAdd: (startDate: string) => void
  loading?: boolean
}

export default function CrisisCustomBaseline({ onAdd, loading }: Props) {
  const [date, setDate] = useState('')
  const [error, setError] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  const handleSubmit = () => {
    setError('')
    if (!date) {
      setError('날짜를 입력하세요')
      return
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('형식: YYYY-MM-DD')
      return
    }
    if (date >= today) {
      setError('오늘 이전 날짜를 입력하세요')
      return
    }
    onAdd(date)
  }

  return (
    <div className="px-3 py-2 border-t border-[var(--border)]">
      <div className="text-[10px] text-[var(--muted)] mb-1.5 font-semibold">커스텀 기준선 추가</div>
      <div className="flex items-center gap-2">
        <input
          type="date"
          value={date}
          max={today}
          onChange={e => { setDate(e.target.value); setError('') }}
          className="flex-1 text-xs bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1.5 text-[var(--text)] focus:outline-none focus:border-[var(--gold)]/60"
        />
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="shrink-0 text-xs px-3 py-1.5 rounded bg-[var(--gold)]/10 border border-[var(--gold)]/40 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition disabled:opacity-50"
        >
          {loading ? '로딩...' : '비교 추가'}
        </button>
      </div>
      {error && <div className="text-[10px] text-red-400 mt-1">{error}</div>}
    </div>
  )
}
