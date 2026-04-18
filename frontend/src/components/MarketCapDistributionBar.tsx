import type { MarketCapDistribution } from '../api/client'

interface Props {
  title: string
  titleColor: string
  data: MarketCapDistribution | undefined | null
  loading?: boolean
}

// 시가총액을 간결한 한/영 표기로 변환
function formatCap(value: number, currency: 'KRW' | 'USD'): string {
  if (!value) return '-'
  if (currency === 'KRW') {
    if (value >= 1e12) return `${(value / 1e12).toFixed(1)}조`
    if (value >= 1e8) return `${(value / 1e8).toFixed(0)}억`
    if (value >= 1e4) return `${(value / 1e4).toFixed(0)}만`
    return value.toLocaleString()
  }
  // USD
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`
  return `$${value.toLocaleString()}`
}

// 바 색상 (1분위: 진한 메가캡, 2분위: 중형, 3분위: 소형)
const TERTILE_COLORS = [
  'bg-indigo-500',
  'bg-blue-500',
  'bg-sky-500',
]
const TERTILE_LABELS = ['1분위', '2분위', '3분위']

export default function MarketCapDistributionBar({ title, titleColor, data, loading }: Props) {
  if (loading || !data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-caption font-semibold ${titleColor}`}>{title}</span>
          <span className="text-caption text-[var(--muted)]">
            {loading ? '불러오는 중...' : '시총 데이터 없음'}
          </span>
        </div>
        <div className="h-[6px] rounded-full bg-white/5" />
      </div>
    )
  }

  if (data.total_count === 0) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className={`text-caption font-semibold ${titleColor}`}>{title}</span>
          <span className="text-caption text-[var(--muted)]">시총 데이터 미수집</span>
        </div>
        <div className="h-[6px] rounded-full bg-white/5" />
      </div>
    )
  }

  const medianPct = data.median_position_pct

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg px-3 py-2">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <span className={`text-caption font-semibold ${titleColor}`}>
          {title} · <span className="font-mono text-white/90">{data.total_count.toLocaleString()}종목</span>
        </span>
        <span className="text-caption text-[var(--muted)]">
          총 <span className="font-mono text-white/70">{formatCap(data.total_market_cap, data.currency)}</span>
        </span>
      </div>

      {/* 3등분 바 */}
      <div className="relative">
        {/* 중앙값 역세모 마커 — 경계선보다 눈에 덜 띄게 (작고 옅음) */}
        <div
          className="absolute -top-[7px] z-10"
          style={{ left: `${medianPct}%`, transform: 'translateX(-50%)' }}
          title={`중앙값(시총 누적 50%): ${medianPct.toFixed(1)}%`}
        >
          <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-white/30" />
        </div>
        {/* 3등분 색상 바 */}
        <div className="flex h-[6px] rounded-full overflow-hidden gap-[2px]">
          {data.tertiles.map((t, i) => (
            <div
              key={t.rank}
              className={`${TERTILE_COLORS[i]} ${i === 0 ? 'rounded-l-full' : ''} ${i === 2 ? 'rounded-r-full' : ''}`}
              style={{ width: '33.333%' }}
            />
          ))}
        </div>
      </div>

      {/* 분위 라벨 */}
      <div className="grid grid-cols-3 gap-1 mt-1.5">
        {data.tertiles.map((t, i) => (
          <div key={t.rank} className="text-center">
            <div className={`text-micro font-semibold ${
              i === 0 ? 'text-indigo-300' : i === 1 ? 'text-blue-300' : 'text-sky-300'
            }`}>
              {TERTILE_LABELS[i]}
            </div>
            <div className="text-caption font-mono text-white/80 leading-tight">
              {formatCap(t.market_cap_sum, data.currency)}
            </div>
            <div className="text-micro text-[var(--muted)]">({t.count}종목)</div>
          </div>
        ))}
      </div>
    </div>
  )
}
