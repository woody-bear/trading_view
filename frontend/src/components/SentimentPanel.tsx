import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, BarChart3, Minus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchSentiment, fetchSentimentHistory } from '../api/client'

// 지표 이름 → 차트 조회용 심볼 매핑
const INDEX_SYMBOLS: Record<string, { symbol: string; market: string }> = {
  'VIX': { symbol: '^VIX', market: 'US' },
  '코스피': { symbol: '^KS11', market: 'KR' },
  'S&P 500': { symbol: '^GSPC', market: 'US' },
  '나스닥': { symbol: '^IXIC', market: 'US' },
  'USD/KRW': { symbol: 'USDKRW=X', market: 'US' },
}

interface MarketIndex {
  name: string
  value: number
  change: number
  change_pct: number
  direction: 'up' | 'down' | 'flat'
}

interface SentimentData {
  fear_greed: number
  fear_greed_label: string
  sentiment_summary: string
  vix: MarketIndex
  kospi: MarketIndex
  sp500: MarketIndex
  nasdaq: MarketIndex
  usdkrw: MarketIndex
  updated_at: string
}

const labelKo: Record<string, string> = {
  'Extreme Fear': '극도의 공포',
  'Fear': '공포',
  'Neutral': '중립',
  'Greed': '탐욕',
  'Extreme Greed': '극도의 탐욕',
}

const summaryColors: Record<string, string> = {
  '위험 회피 분위기': 'text-red-400 bg-red-500/10',
  '낙관적 분위기': 'text-green-400 bg-green-500/10',
  '혼조세': 'text-gray-400 bg-gray-500/10',
}

function FearGreedGauge({ score, label }: { score: number; label: string }) {
  // 반원형 게이지 — SVG
  const angle = (score / 100) * 180 // 0~180도
  const rad = ((180 - angle) * Math.PI) / 180
  const r = 80
  const cx = 100
  const cy = 90
  const x = cx + r * Math.cos(rad)
  const y = cy - r * Math.sin(rad)

  // 색상 그라디언트
  const getColor = (s: number) => {
    if (s <= 20) return '#ef4444'
    if (s <= 40) return '#f97316'
    if (s <= 60) return '#a3a3a3'
    if (s <= 80) return '#22c55e'
    return '#16a34a'
  }

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-32 md:w-40">
        {/* 배경 호 */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke="#1e293b"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* 그라디언트 구간들 */}
        {[0, 20, 40, 60, 80].map((start, i) => {
          const colors = ['#ef4444', '#f97316', '#a3a3a3', '#22c55e', '#16a34a']
          const a1 = ((180 - (start / 100) * 180) * Math.PI) / 180
          const a2 = ((180 - (Math.min(start + 20, 100) / 100) * 180) * Math.PI) / 180
          return (
            <path
              key={i}
              d={`M ${cx + r * Math.cos(a1)} ${cy - r * Math.sin(a1)} A ${r} ${r} 0 0 1 ${cx + r * Math.cos(a2)} ${cy - r * Math.sin(a2)}`}
              fill="none"
              stroke={colors[i]}
              strokeWidth="12"
              strokeLinecap="round"
              opacity={0.3}
            />
          )
        })}
        {/* 현재값 바늘 */}
        <line
          x1={cx}
          y1={cy}
          x2={x}
          y2={y}
          stroke={getColor(score)}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill={getColor(score)} />
        {/* 점수 텍스트 */}
        <text x={cx} y={cy - 20} textAnchor="middle" fill="white" fontSize="28" fontWeight="bold">
          {Math.round(score)}
        </text>
        <text x={cx} y={cy - 2} textAnchor="middle" fill={getColor(score)} fontSize="11" fontWeight="600">
          {labelKo[label] || label}
        </text>
      </svg>
      <p className="text-[10px] text-[var(--muted)] -mt-1">Fear & Greed Index</p>
    </div>
  )
}

function MiniCard({ index, onClick }: { index: MarketIndex; onClick?: () => void }) {
  const dirColor = index.direction === 'up' ? 'text-green-400' : index.direction === 'down' ? 'text-red-400' : 'text-gray-400'
  const DirIcon = index.direction === 'up' ? ArrowUp : index.direction === 'down' ? ArrowDown : Minus

  const fmtVal = (name: string, val: number) => {
    if (name === 'VIX') return val.toFixed(1)
    if (name === 'USD/KRW') return val.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
    if (name === '코스피') return val.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
    return val.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  return (
    <div onClick={onClick}
      className={`bg-[var(--bg)] border border-[var(--border)] rounded-lg px-3 py-2 min-w-0 ${onClick ? 'cursor-pointer hover:border-blue-500/50 transition active:scale-[0.98]' : ''}`}>
      <div className="text-[10px] text-[var(--muted)] truncate">{index.name}</div>
      <div className="text-sm font-mono font-semibold text-white mt-0.5">{fmtVal(index.name, index.value)}</div>
      <div className={`flex items-center gap-0.5 text-[10px] font-mono ${dirColor}`}>
        <DirIcon size={10} />
        <span>{index.change_pct >= 0 ? '+' : ''}{index.change_pct.toFixed(2)}%</span>
      </div>
    </div>
  )
}

function MiniTrendChart({ dates, values }: { dates: string[]; values: number[] }) {
  if (!dates.length || !values.length) return null

  const width = 300
  const height = 50
  const padding = 4
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * (width - padding * 2)
    const y = height - padding - ((v - min) / range) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  return (
    <div className="mt-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12">
        {/* 25 라인 (공포) */}
        <line x1={padding} y1={height - padding - ((25 - min) / range) * (height - padding * 2)} x2={width - padding} y2={height - padding - ((25 - min) / range) * (height - padding * 2)} stroke="#ef4444" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.3" />
        {/* 75 라인 (탐욕) */}
        <line x1={padding} y1={height - padding - ((75 - min) / range) * (height - padding * 2)} x2={width - padding} y2={height - padding - ((75 - min) / range) * (height - padding * 2)} stroke="#22c55e" strokeWidth="0.5" strokeDasharray="3,3" opacity="0.3" />
        <polyline points={points} fill="none" stroke="#60a5fa" strokeWidth="1.5" />
      </svg>
      <div className="flex justify-between text-[9px] text-[var(--muted)] px-1">
        <span>{dates[0]?.slice(5)}</span>
        <span>30일 추이</span>
        <span>{dates[dates.length - 1]?.slice(5)}</span>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      {/* 섹션 제목 */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 bg-blue-900/60 rounded" />
        <div className="w-16 h-4 bg-gray-800 rounded" />
      </div>
      {/* 반원 게이지 */}
      <div className="flex flex-col items-center mb-3">
        <div className="relative w-32 md:w-40 h-16 md:h-20">
          <div className="absolute bottom-0 left-0 right-0 h-full rounded-t-full bg-gray-800/70" style={{ borderRadius: '100px 100px 0 0' }} />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-5 bg-gray-700/60 rounded" />
        </div>
        <div className="w-20 h-3 bg-gray-800 rounded mt-2" />
      </div>
      {/* 분위기 뱃지 */}
      <div className="flex justify-center mb-3">
        <div className="w-24 h-6 bg-gray-800 rounded-full" />
      </div>
      {/* 추이 차트 */}
      <div className="w-full h-12 bg-gray-800/50 rounded mb-3" />
      {/* 지표 카드 5개 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-2">
            <div className="w-12 h-2.5 bg-gray-700 rounded mb-2" />
            <div className="w-16 h-4 bg-gray-700 rounded mb-1.5" />
            <div className="w-10 h-2.5 bg-gray-700/60 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function SentimentPanel() {
  const nav = useNavigate()
  const { data, isLoading, isError } = useQuery<SentimentData>({
    queryKey: ['sentiment'],
    queryFn: fetchSentiment,
    refetchInterval: 300000, // 5분
    staleTime: 60000,
  })

  const { data: history } = useQuery<{ dates: string[]; values: number[] }>({
    queryKey: ['sentiment-history'],
    queryFn: fetchSentimentHistory,
    refetchInterval: 300000,
    staleTime: 60000,
  })

  if (isLoading) return <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4"><Skeleton /></div>

  if (isError || !data) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4 text-center text-sm text-[var(--muted)]">
        시장 심리 데이터를 불러올 수 없습니다
      </div>
    )
  }

  const updatedAt = data.updated_at ? new Date(data.updated_at) : null
  const minutesAgo = updatedAt ? Math.floor((Date.now() - updatedAt.getTime()) / 60000) : null

  const indices = [data.vix, data.kospi, data.sp500, data.nasdaq, data.usdkrw]

  const handleIndexClick = (name: string) => {
    const info = INDEX_SYMBOLS[name]
    if (info) {
      nav(`/${encodeURIComponent(info.symbol)}?market=${info.market}`)
    }
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
      {/* 섹션 제목 */}
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 size={16} className="text-blue-400" />
        <h2 className="text-sm font-bold text-white">시장 지표</h2>
      </div>

      {/* Fear & Greed 게이지 */}
      <FearGreedGauge score={data.fear_greed} label={data.fear_greed_label} />

      {/* 시장 분위기 요약 */}
      <div className="flex justify-center mb-3">
        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${summaryColors[data.sentiment_summary] || 'text-gray-400 bg-gray-500/10'}`}>
          {data.sentiment_summary}
        </span>
      </div>

      {/* 30일 추이 미니 차트 */}
      {history && history.values?.length > 0 && (
        <MiniTrendChart dates={history.dates} values={history.values} />
      )}

      {/* 지표 미니카드 (클릭 시 차트) */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
        {indices.map((idx) => (
          <MiniCard key={idx.name} index={idx} onClick={() => handleIndexClick(idx.name)} />
        ))}
      </div>

      {/* 마지막 갱신 */}
      {minutesAgo !== null && (
        <div className="text-right mt-2">
          <span className="text-[9px] text-[var(--muted)]">
            마지막 갱신: {minutesAgo < 1 ? '방금' : `${minutesAgo}분 전`}
          </span>
        </div>
      )}
    </div>
  )
}
