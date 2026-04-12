import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchAlertHistory } from '../api/client'

interface AlertItem {
  id: number
  sent_at: string
  alert_type: string
  success: boolean
  error_message: string | null
  message: string | null
  symbol_count: number | null
}

export default function AlertHistory() {
  const nav = useNavigate()
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alert-history'],
    queryFn: () => fetchAlertHistory('scheduled_buy', 50),
  })

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="p-3 md:p-6 max-w-2xl mx-auto">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => nav(-1)} className="text-[var(--muted)] hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-white">BUY 신호 알림 이력</h1>
      </div>

      {isLoading && <p className="text-[var(--muted)] text-sm">로딩 중...</p>}

      {!isLoading && alerts.length === 0 && (
        <div className="text-center py-12 text-[var(--muted)]">
          <p className="text-sm">아직 발송된 알림이 없습니다</p>
        </div>
      )}

      <div className="flex flex-col gap-2">
        {(alerts as AlertItem[]).map((a) => (
          <div key={a.id} className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
            <button
              onClick={() => setExpanded(expanded === a.id ? null : a.id)}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--bg)] transition-colors"
            >
              {a.success ? (
                <CheckCircle size={16} className="text-green-400 shrink-0" />
              ) : (
                <XCircle size={16} className="text-red-400 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white">{fmtTime(a.sent_at)}</span>
                  <span className={`text-caption px-1.5 py-0.5 rounded ${a.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {a.success ? '성공' : '실패'}
                  </span>
                </div>
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {a.symbol_count != null ? `${a.symbol_count}종목 전송` : ''}
                  {!a.success && a.error_message && (
                    <span className="text-red-400 ml-2">{a.error_message}</span>
                  )}
                </div>
              </div>
              {expanded === a.id ? <ChevronUp size={14} className="text-[var(--muted)]" /> : <ChevronDown size={14} className="text-[var(--muted)]" />}
            </button>

            {expanded === a.id && a.message && (
              <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg)]">
                <pre className="text-xs text-[var(--muted)] whitespace-pre-wrap font-mono leading-relaxed">
                  {a.message.replace(/<[^>]*>/g, '')}
                </pre>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
