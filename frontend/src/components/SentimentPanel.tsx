import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { createChart, CrosshairMode, HistogramSeries, LineSeries, LineStyle } from 'lightweight-charts'
import { fetchSentiment, fetchSentimentHistory, fetchVIXHistory } from '../api/client'

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
  '위험 회피 분위기': 'text-[var(--sell)] bg-[var(--sell)]/10',
  '낙관적 분위기': 'text-[var(--buy)] bg-[var(--buy)]/10',
  '혼조세': 'text-[var(--muted)] bg-[var(--border)]/50',
}

const PERIOD_TABS = [
  { label: '1개월', days: 30 },
  { label: '3개월', days: 90 },
  { label: '1년', days: 365 },
] as const

function FearGreedGauge({ score, label }: { score: number; label: string }) {
  const angle = (score / 100) * 180
  const rad = ((180 - angle) * Math.PI) / 180
  const r = 80
  const cx = 100
  const cy = 90
  const x = cx + r * Math.cos(rad)
  const y = cy - r * Math.sin(rad)

  const getColor = (s: number) => {
    if (s <= 20) return '#4285f4'
    if (s <= 40) return '#8b9eff'
    if (s <= 60) return '#636366'
    if (s <= 80) return '#ff4b6a'
    return '#ff2d55'
  }

  const color = getColor(score)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-32 md:w-40">
        {/* 배경 호 */}
        <path
          d="M 20 90 A 80 80 0 0 1 180 90"
          fill="none"
          stroke="#1c1c1e"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* 그라디언트 구간들 */}
        {[0, 20, 40, 60, 80].map((start, i) => {
          const colors = ['#4285f4', '#8b9eff', '#636366', '#ff4b6a', '#ff2d55']
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
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r="4" fill={color} />
        {/* 점수 텍스트 */}
        <text x={cx} y={cy - 20} textAnchor="middle" fill={score <= 20 ? '#4285f4' : '#ffffff'} fontSize="28" fontWeight="bold">
          {Math.round(score)}
        </text>
        <text x={cx} y={cy - 2} textAnchor="middle" fill={color} fontSize="11" fontWeight="600">
          {labelKo[label] || label}
        </text>
      </svg>
      <p className="text-[15px] text-[var(--muted)] -mt-1">Fear & Greed Index</p>
    </div>
  )
}

function FearGreedChart({ days }: { days: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<{ dates: string[]; values: number[] }>({
    queryKey: ['sentiment-history', days],
    queryFn: () => fetchSentimentHistory(days),
    refetchInterval: 300000,
    staleTime: 60000,
  })

  useEffect(() => {
    if (!containerRef.current || !data || !data.dates.length) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Magnet,
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        scaleMargins: { top: 0.05, bottom: 0.05 },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    const series = chart.addSeries(LineSeries, {
      color: '#60a5fa',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
      // Y축 0~100 고정
      autoscaleInfoProvider: () => ({
        priceRange: { minValue: 0, maxValue: 100 },
      }),
    })

    const chartData = data.dates.map((d, i) => ({
      time: d as import('lightweight-charts').Time,
      value: data.values[i],
    }))
    series.setData(chartData)
    chart.timeScale().fitContent()

    // 툴팁
    const tooltip = tooltipRef.current
    chart.subscribeCrosshairMove((param) => {
      if (!tooltip) return
      if (!param.time || !param.point || param.point.x < 0 || param.point.y < 0) {
        tooltip.style.display = 'none'
        return
      }
      const val = param.seriesData.get(series) as { value: number } | undefined
      if (!val) { tooltip.style.display = 'none'; return }
      const score = Math.round(val.value)
      const lbl = score <= 20 ? '극도의 공포' : score <= 40 ? '공포' : score <= 60 ? '중립' : score <= 80 ? '탐욕' : '극도의 탐욕'
      const color = score <= 20 ? '#4285f4' : score <= 40 ? '#8b9eff' : score <= 60 ? '#636366' : '#ff4b6a'
      tooltip.innerHTML = `<span style="color:${color};font-weight:600">${lbl} ${score}</span><br/><span style="color:#64748b;font-size:10px">${param.time}</span>`
      tooltip.style.display = 'block'
      const left = Math.min(param.point.x + 12, containerRef.current!.clientWidth - 100)
      const top = Math.max(param.point.y - 40, 4)
      tooltip.style.left = `${left}px`
      tooltip.style.top = `${top}px`
    })

    return () => { chart.remove() }
  }, [data])

  if (isLoading) {
    return <div className="h-48 md:h-56 bg-[var(--bg)] rounded animate-pulse" />
  }

  if (!data || !data.dates.length) {
    return <div className="h-48 md:h-56 flex items-center justify-center text-xs text-[var(--muted)]">데이터 없음</div>
  }

  return (
    <div className="relative overflow-hidden rounded" style={{ height: undefined }}>
      {/* 색상 구간 오버레이 (Y축 0~100 기준) */}
      <div className="absolute inset-0 pointer-events-none z-0">
        {/* 탐욕 구간 75~100: 상단 25% */}
        <div className="absolute top-0 left-0 right-0" style={{ height: '25%', background: 'rgba(255,75,106,0.07)' }} />
        {/* 중립 구간 25~75: 중간 50% */}
        <div className="absolute left-0 right-0" style={{ top: '25%', height: '50%', background: 'rgba(99,99,102,0.04)' }} />
        {/* 공포 구간 0~25: 하단 25% */}
        <div className="absolute bottom-0 left-0 right-0" style={{ height: '25%', background: 'rgba(66,133,244,0.07)' }} />
      </div>
      {/* 차트 */}
      <div
        ref={containerRef}
        className="relative z-10 h-48 md:h-56"
        style={{ touchAction: 'pan-y' }}
      />
      {/* 툴팁 */}
      <div
        ref={tooltipRef}
        className="absolute z-20 bg-[var(--card)] border border-[var(--border)] rounded px-2 py-1 text-xs pointer-events-none"
        style={{ display: 'none' }}
      />
    </div>
  )
}

function VIXExpandChart({ days }: { days: number }) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { data, isLoading } = useQuery<{ dates: string[]; values: number[] }>({
    queryKey: ['vix-history', days],
    queryFn: () => fetchVIXHistory(days),
    refetchInterval: 300000,
    staleTime: 60000,
  })

  useEffect(() => {
    if (!containerRef.current || !data || !data.dates.length) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: { mode: CrosshairMode.Magnet },
      rightPriceScale: { borderColor: 'rgba(255,255,255,0.1)' },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    // VIX >30 구간 음영 (HistogramSeries)
    const histSeries = chart.addSeries(HistogramSeries, {
      priceScaleId: 'right',
      priceLineVisible: false,
      lastValueVisible: false,
    })
    const histData = data.dates.map((d, i) => ({
      time: d as import('lightweight-charts').Time,
      value: data.values[i],
      color: data.values[i] > 30 ? 'rgba(239,68,68,0.25)' : 'transparent',
    }))
    histSeries.setData(histData)

    // VIX 라인
    const lineSeries = chart.addSeries(LineSeries, {
      color: '#60a5fa',
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: true,
    })
    const lineData = data.dates.map((d, i) => ({
      time: d as import('lightweight-charts').Time,
      value: data.values[i],
    }))
    lineSeries.setData(lineData)

    // 기준선 20·30
    lineSeries.createPriceLine({
      price: 20,
      color: '#f97316',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'VIX 20',
    })
    lineSeries.createPriceLine({
      price: 30,
      color: '#ef4444',
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      axisLabelVisible: true,
      title: 'VIX 30',
    })

    chart.timeScale().fitContent()
    return () => { chart.remove() }
  }, [data])

  if (isLoading) {
    return <div className="h-48 md:h-56 bg-[var(--bg)] rounded animate-pulse mt-3" />
  }

  if (!data || !data.dates.length) {
    return <div className="h-48 md:h-56 flex items-center justify-center text-xs text-[var(--muted)] mt-3">데이터 없음</div>
  }

  return (
    <div
      ref={containerRef}
      className="h-48 md:h-56 mt-3"
      style={{ touchAction: 'pan-y' }}
    />
  )
}

function MiniCard({ index, onClick, active }: { index: MarketIndex; onClick?: () => void; active?: boolean }) {
  const dirColor = index.direction === 'up' ? 'text-[var(--buy)]' : index.direction === 'down' ? 'text-[var(--sell)]' : 'text-[var(--neutral)]'
  const DirIcon = index.direction === 'up' ? ArrowUp : index.direction === 'down' ? ArrowDown : Minus

  const fmtVal = (name: string, val: number) => {
    if (name === 'VIX') return val.toFixed(1)
    if (name === 'USD/KRW') return val.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
    if (name === '코스피') return val.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
    return val.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  return (
    <div onClick={onClick}
      className={`bg-[var(--card)] border rounded-xl px-3 py-2 min-w-0 transition ${
        onClick ? 'cursor-pointer active:scale-[0.98]' : ''
      } ${active ? 'border-blue-500/60' : 'border-[var(--border)] hover:border-blue-500/50'}`}>
      <div className="text-[18px] text-[var(--muted)] truncate">{index.name}</div>
      <div className="text-base font-mono font-bold text-[var(--text)] mt-0.5">{fmtVal(index.name, index.value)}</div>
      <div className={`flex items-center gap-0.5 text-xs font-mono font-semibold ${dirColor}`}>
        <DirIcon size={11} />
        <span>{index.change_pct >= 0 ? '+' : ''}{index.change_pct.toFixed(2)}%</span>
      </div>
    </div>
  )
}

function Skeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 bg-blue-900/60 rounded" />
        <div className="w-16 h-4 bg-gray-800 rounded" />
      </div>
      <div className="flex flex-col items-center mb-3">
        <div className="relative w-32 md:w-40 h-16 md:h-20">
          <div className="absolute bottom-0 left-0 right-0 h-full rounded-t-full bg-gray-800/70" style={{ borderRadius: '100px 100px 0 0' }} />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-5 bg-gray-700/60 rounded" />
        </div>
        <div className="w-20 h-3 bg-gray-800 rounded mt-2" />
      </div>
      <div className="flex justify-center mb-3">
        <div className="w-24 h-6 bg-gray-800 rounded-full" />
      </div>
      <div className="w-full h-48 bg-gray-800/50 rounded mb-3" />
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
  const [selectedDays, setSelectedDays] = useState<30 | 90 | 365>(30)
  const [vixExpanded, setVixExpanded] = useState(false)

  const { data, isLoading, isError } = useQuery<SentimentData>({
    queryKey: ['sentiment'],
    queryFn: fetchSentiment,
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

  const indices = [data.vix, data.kospi, data.sp500, data.nasdaq, data.usdkrw]

  const handleIndexClick = (name: string) => {
    if (name === 'VIX') {
      setVixExpanded(prev => !prev)
      return
    }
    const info = INDEX_SYMBOLS[name]
    if (info) nav(`/${encodeURIComponent(info.symbol)}?market=${info.market}`)
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 mb-4">
      {/* Fear & Greed 게이지 */}
      <FearGreedGauge score={data.fear_greed} label={data.fear_greed_label} />

      {/* 시장 분위기 요약 */}
      <div className="flex justify-center mb-3">
        <span className={`text-[18px] font-semibold px-3 py-1 rounded-full ${summaryColors[data.sentiment_summary] || 'text-gray-400 bg-gray-500/10'}`}>
          {data.sentiment_summary}
        </span>
      </div>

      {/* 기간 탭 */}
      <div className="flex gap-3 mb-2">
        {PERIOD_TABS.map(tab => (
          <button
            key={tab.days}
            onClick={() => setSelectedDays(tab.days)}
            className={`text-[18px] pb-1 transition ${
              selectedDays === tab.days
                ? 'text-[var(--buy)] border-b border-[var(--buy)] font-semibold'
                : 'text-[var(--muted)] hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Fear & Greed 히스토리 차트 */}
      <FearGreedChart days={selectedDays} />

      {/* 지표 미니카드 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
        {indices.map((idx) => (
          <MiniCard
            key={idx.name}
            index={idx}
            onClick={() => handleIndexClick(idx.name)}
            active={idx.name === 'VIX' && vixExpanded}
          />
        ))}
      </div>

      {/* VIX 확장 차트 */}
      {vixExpanded && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-blue-400">VIX 히스토리</span>
            <span className="text-[10px] text-[var(--muted)]">— 20: 공포 기준선 · 30: 패닉 기준선</span>
          </div>
          <VIXExpandChart days={selectedDays} />
        </div>
      )}

    </div>
  )
}
