import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Ban, Flame, ShieldCheck } from 'lucide-react'
import { fetchStockDetail } from '../api/client'

interface Props {
  symbol: string
  market: string
}

const RISK_CONFIG: Record<string, { label: string; color: string; bg: string; icon: typeof AlertTriangle }> = {
  risk: { label: '투자위험', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/40', icon: AlertTriangle },
  warning: { label: '투자경고', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/40', icon: AlertTriangle },
  caution: { label: '투자주의', color: 'text-yellow-400', bg: 'bg-yellow-500/15 border-yellow-500/40', icon: AlertTriangle },
}

export default function RiskWarningBanner({ symbol, market }: Props) {
  const isKR = market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ'

  const { data } = useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: () => fetchStockDetail(symbol, market),
    enabled: isKR,
    staleTime: 300000,
  })

  if (!isKR || !data || data.status === 'unavailable') return null

  const warnings: { label: string; color: string; bg: string; icon: typeof AlertTriangle }[] = []

  if (data.halt) {
    warnings.push({ label: '매매정지', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/40', icon: Ban })
  }
  if (data.overbought) {
    warnings.push({ label: '과열종목', color: 'text-orange-400', bg: 'bg-orange-500/15 border-orange-500/40', icon: Flame })
  }
  if (data.risk && data.risk !== 'none' && RISK_CONFIG[data.risk]) {
    warnings.push(RISK_CONFIG[data.risk])
  }

  // 정상 종목이면 "안전" 표시
  if (warnings.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-green-500/10 border-green-500/30 mb-3">
        <ShieldCheck size={14} className="text-green-400" />
        <span className="text-xs font-semibold text-green-400">정상 — 매매정지·과열·투자경고 없음</span>
      </div>
    )
  }

  return (
    <div className="space-y-1.5 mb-3">
      {warnings.map(w => (
        <div key={w.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${w.bg}`}>
          <w.icon size={16} className={w.color} />
          <span className={`text-sm font-bold ${w.color}`}>{w.label}</span>
        </div>
      ))}
    </div>
  )
}
