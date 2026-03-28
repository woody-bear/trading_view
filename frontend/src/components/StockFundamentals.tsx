import { useQuery } from '@tanstack/react-query'
import { fetchStockDetail } from '../api/client'

interface Props {
  symbol: string
  market: string  // KR, KOSPI, KOSDAQ, US, CRYPTO
}

function fmtNum(n: number | null | undefined, dec: number = 0): string {
  if (n == null || n === 0) return '-'
  if (Math.abs(n) >= 1_0000_0000_0000) return `${(n / 1_0000_0000_0000).toFixed(1)}조`
  if (Math.abs(n) >= 1_0000_0000) return `${(n / 1_0000_0000).toFixed(0)}억`
  return n.toLocaleString('ko-KR', { maximumFractionDigits: dec })
}

function fmtPrice(n: number | null | undefined): string {
  if (n == null || n === 0) return '-'
  return n.toLocaleString('ko-KR')
}

export default function StockFundamentals({ symbol, market }: Props) {
  const isKR = market === 'KR' || market === 'KOSPI' || market === 'KOSDAQ'
  const isUS = market === 'US'
  const showDetail = isKR || isUS

  const { data, isLoading } = useQuery({
    queryKey: ['stock-detail', symbol],
    queryFn: () => fetchStockDetail(symbol, market),
    enabled: showDetail,
    staleTime: 300000, // 5분
  })

  if (!showDetail) return null
  if (isLoading) return <div className="text-xs text-[var(--muted)] py-2">투자지표 로딩 중...</div>
  if (!data || data.status === 'unavailable') return null

  const w52Pos = data.week52_position ?? 50
  const isNearLow = w52Pos <= 20
  const isNearHigh = w52Pos >= 80

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 md:p-3 mb-4">
      {/* 업종 + 시가총액 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {data.sector_name && (
            <span className="text-[10px] text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded">{data.sector_name}</span>
          )}
        </div>
        <span className="text-xs text-[var(--muted)]">시가총액 <span className="text-white font-mono">{fmtNum(data.market_cap)}</span></span>
      </div>

      {/* PER / PBR / EPS / BPS 카드 */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <MetricCard label="PER" value={data.per} suffix="배" highlight={data.per > 0 && data.per < 10 ? 'low' : data.per > 30 ? 'high' : undefined} />
        <MetricCard label="PBR" value={data.pbr} suffix="배" highlight={data.pbr > 0 && data.pbr < 1 ? 'low' : data.pbr > 3 ? 'high' : undefined} />
        <MetricCard label="EPS" value={data.eps} suffix={isKR ? '원' : '$'} />
        <MetricCard label="BPS" value={data.bps} suffix={isKR ? '원' : '$'} />
      </div>

      {/* 52주 범위 */}
      {(data.week52_high > 0 || data.week52_low > 0) && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-[var(--muted)] mb-1">
            <span>52주 최저 <span className="text-blue-400 font-mono">{fmtPrice(data.week52_low)}</span></span>
            <span>52주 최고 <span className="text-red-400 font-mono">{fmtPrice(data.week52_high)}</span></span>
          </div>
          <div className="relative w-full h-2 bg-[var(--bg)] rounded-full">
            <div
              className="absolute h-2 bg-gradient-to-r from-blue-500 to-red-500 rounded-full opacity-30"
              style={{ width: '100%' }}
            />
            <div
              className="absolute top-[-2px] w-3 h-3 bg-white rounded-full border-2 border-yellow-400 shadow"
              style={{ left: `calc(${Math.min(Math.max(w52Pos, 2), 98)}% - 6px)` }}
            />
          </div>
          <div className="flex items-center justify-between mt-1">
            <span className="text-[9px] text-[var(--muted)]">
              {data.week52_low_date}
            </span>
            {isNearLow && <span className="text-[10px] text-blue-400 font-bold">52주 저점 근처</span>}
            {isNearHigh && <span className="text-[10px] text-red-400 font-bold">52주 고점 근처</span>}
            <span className="text-[9px] text-[var(--muted)]">
              {data.week52_high_date}
            </span>
          </div>
        </div>
      )}

      {/* 가격제한 (한국만) */}
      {isKR && data.base_price > 0 && (
        <div className="flex items-center gap-3 text-[10px] text-[var(--muted)] pt-2 border-t border-[var(--border)]">
          <span>기준가 <span className="text-white font-mono">{fmtPrice(data.base_price)}</span></span>
          <span>상한가 <span className="text-red-400 font-mono">{fmtPrice(data.high_limit)}</span></span>
          <span>하한가 <span className="text-blue-400 font-mono">{fmtPrice(data.low_limit)}</span></span>
          {data.price > 0 && data.high_limit > 0 && data.price >= data.high_limit * 0.9 && (
            <span className="text-red-400 font-bold">상한가 근접</span>
          )}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, suffix = '', highlight }: {
  label: string; value: number; suffix?: string;
  highlight?: 'low' | 'high'
}) {
  const color = highlight === 'low' ? 'text-blue-400' : highlight === 'high' ? 'text-red-400' : 'text-white'
  const bg = highlight === 'low' ? 'bg-blue-500/10' : highlight === 'high' ? 'bg-red-500/10' : 'bg-[var(--bg)]'
  const hint = highlight === 'low' ? '저평가' : highlight === 'high' ? '고평가' : null

  return (
    <div className={`${bg} rounded-lg p-2 text-center`}>
      <div className="text-[10px] text-[var(--muted)] mb-0.5">{label}</div>
      <div className={`text-sm font-mono font-bold ${color}`}>
        {value ? value.toLocaleString('ko-KR', { maximumFractionDigits: 2 }) : '-'}
      </div>
      {suffix && value > 0 && <div className="text-[9px] text-[var(--muted)]">{suffix}</div>}
      {hint && <div className={`text-[9px] font-bold ${color} mt-0.5`}>{hint}</div>}
    </div>
  )
}
