import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { fetchFinancials } from '../../api/client'

interface Props {
  symbol: string
  market: string
}

export default function FinancialChart({ symbol, market }: Props) {
  const [period, setPeriod] = useState<'annual' | 'quarterly'>('annual')
  const [metric, setMetric] = useState<'revenue' | 'net_income'>('revenue')

  const { data, isLoading } = useQuery({
    queryKey: ['financials', symbol, market],
    queryFn: () => fetchFinancials(symbol, market),
    staleTime: 3600000, // 1시간 캐시
  })

  if (isLoading) return <div className="text-[var(--muted)] text-xs py-4 text-center">실적 로딩 중...</div>

  const items = period === 'annual' ? data?.annual : data?.quarterly
  if (!items || items.length === 0) return null

  const unitLabel = data?.unit_label || ''
  const values = items.map((d: any) => d[metric] ?? 0)
  const maxVal = Math.max(...values.filter((v: number) => v > 0), 1)

  const labelKey = period === 'annual' ? 'year' : 'quarter'
  const changeKey = metric === 'revenue' ? 'revenue_change' : 'net_income_change'

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mt-4 mb-4">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm md:text-base font-bold text-white">실적</span>
        <div className="flex gap-1 bg-[var(--bg)] rounded-md p-0.5">
          <button onClick={() => setPeriod('annual')}
            className={`px-2.5 py-1 rounded text-[11px] md:text-[10px] font-semibold transition ${period === 'annual' ? 'bg-[var(--card)] text-white' : 'text-[var(--muted)]'}`}>
            연간
          </button>
          <button onClick={() => setPeriod('quarterly')}
            className={`px-2.5 py-1 rounded text-[11px] md:text-[10px] font-semibold transition ${period === 'quarterly' ? 'bg-[var(--card)] text-white' : 'text-[var(--muted)]'}`}>
            분기
          </button>
        </div>
      </div>

      {/* 매출/순이익 토글 */}
      <div className="flex gap-1 mb-4 bg-[var(--bg)] rounded-lg p-1">
        <button onClick={() => setMetric('revenue')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${metric === 'revenue' ? 'bg-blue-600 text-white' : 'text-[var(--muted)]'}`}>
          매출
        </button>
        <button onClick={() => setMetric('net_income')}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition ${metric === 'net_income' ? 'bg-blue-600 text-white' : 'text-[var(--muted)]'}`}>
          순이익
        </button>
      </div>

      {/* 바 차트 */}
      <div className="flex items-end gap-2 md:gap-3 h-32 md:h-40 mb-2">
        {items.map((d: any) => {
          const val = d[metric] ?? 0
          const height = maxVal > 0 ? Math.max((val / maxVal) * 100, 2) : 2
          const isNegative = val < 0
          const change = period === 'annual' ? d[changeKey] : undefined

          return (
            <div key={d[labelKey]} className="flex-1 flex flex-col items-center justify-end h-full">
              {/* 바 */}
              <div className="w-full flex flex-col items-center justify-end flex-1">
                <div
                  className={`w-full max-w-10 rounded-t-md transition-all duration-300 ${isNegative ? 'bg-red-500/60' : 'bg-blue-500/70'}`}
                  style={{ height: `${Math.abs(height)}%` }}
                />
              </div>
              {/* 라벨 */}
              <div className="text-center mt-1.5">
                <div className="text-[11px] md:text-[10px] text-white font-semibold">
                  {period === 'annual' ? d.year : d.quarter?.split('-')[1]}
                </div>
                {change != null && (
                  <div className={`text-[10px] md:text-[9px] font-mono ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {change >= 0 ? '+' : ''}{change}%
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* 수치 표시 */}
      <div className="flex gap-2 md:gap-3 mt-1">
        {items.map((d: any) => {
          const val = d[metric]
          return (
            <div key={d[labelKey]} className="flex-1 text-center">
              <div className="text-[10px] md:text-[9px] text-[var(--muted)] font-mono">
                {val != null ? (market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ'
                  ? `${(val / 10000).toFixed(1)}조`
                  : `$${val.toFixed(1)}B`
                ) : '-'}
              </div>
            </div>
          )
        })}
      </div>

      {/* 단위 */}
      <div className="text-[9px] text-[var(--muted)] text-right mt-2 opacity-60">
        단위: {market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ' ? '조원' : `${unitLabel} USD`}
      </div>
    </div>
  )
}
