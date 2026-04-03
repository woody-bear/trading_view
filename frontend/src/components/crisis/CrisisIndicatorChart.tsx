import { ColorType, createChart, LineSeries } from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'

interface DataPoint {
  day_offset: number
  date: string
  value: number
  change_pct: number
}

interface IndicatorSeries {
  id: number
  name: string
  category: string
  unit: string
  has_data: boolean
  no_data_reason?: string | null
  data_points: DataPoint[]
}

interface Props {
  indicators: IndicatorSeries[]
  loading?: boolean
}

const CATEGORY_LABELS: Record<string, string> = {
  equity: '주식',
  bond: '채권',
  commodity: '원자재',
  currency: '환율',
}

const CATEGORY_KEYS = ['equity', 'bond', 'commodity', 'currency']

const PERIOD_OPTIONS = [
  { label: '±30일', before: 30, after: 30 },
  { label: '±90일', before: 90, after: 90 },
  { label: '±180일', before: 180, after: 180 },
]

const LINE_COLORS = ['#f59e0b', '#60a5fa', '#34d399', '#f87171', '#a78bfa', '#fb923c', '#22d3ee', '#e879f9']

// day_offset → synthetic UTCTimestamp (seconds since epoch)
// base: 2000-01-01 UTC = 946684800
const BASE_TS = 946684800
const dayOffsetToTime = (offset: number): number => BASE_TS + offset * 86400

export default function CrisisIndicatorChart({ indicators, loading }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [activeCategory, setActiveCategory] = useState('equity')
  const [activePeriod, setActivePeriod] = useState(1) // index into PERIOD_OPTIONS

  const period = PERIOD_OPTIONS[activePeriod]
  const filtered = indicators.filter(ind => ind.category === activeCategory)

  useEffect(() => {
    if (!chartRef.current || loading) return

    const el = chartRef.current
    el.innerHTML = ''

    const chart = createChart(el, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#9ca3af',
        fontFamily: "'Pretendard', 'Inter', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)' },
        horzLines: { color: 'rgba(255,255,255,0.05)' },
      },
      rightPriceScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        ticksVisible: true,
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.1)',
        tickMarkFormatter: (time: number) => {
          const offset = Math.round((time - BASE_TS) / 86400)
          if (offset === 0) return 'Day 0'
          return offset > 0 ? `+${offset}d` : `${offset}d`
        },
        fixLeftEdge: true,
        fixRightEdge: true,
      },
      crosshair: {
        vertLine: { color: 'rgba(245,158,11,0.5)', width: 1, style: 1 },
        horzLine: { color: 'rgba(245,158,11,0.3)', width: 1, style: 1 },
      },
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true },
      handleScale: { mouseWheel: false, pinch: true },
      width: el.clientWidth,
      height: el.clientHeight || 260,
    })

    // Day 0 수직선 — autoscaleInfoProvider: () => null 로 Y축 스케일 계산에서 제외
    const zeroSeries = chart.addSeries(LineSeries, {
      color: 'rgba(245,158,11,0.7)',
      lineWidth: 1,
      lineStyle: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      autoscaleInfoProvider: () => null,
    } as any)
    zeroSeries.setData([
      { time: dayOffsetToTime(-1) as any, value: -9999 },
      { time: dayOffsetToTime(0) as any, value: 9999 },
    ])

    let hasAnyData = false

    filtered.forEach((ind, i) => {
      if (!ind.has_data || !ind.data_points || ind.data_points.length === 0) return

      const rangeData = ind.data_points.filter(
        d => d.day_offset >= -period.before && d.day_offset <= period.after
      )
      if (rangeData.length === 0) return

      hasAnyData = true
      const series = chart.addSeries(LineSeries, {
        color: LINE_COLORS[i % LINE_COLORS.length],
        lineWidth: 2,
        title: ind.name,
        priceLineVisible: false,
        crosshairMarkerRadius: 4,
      })

      series.setData(
        rangeData.map(d => ({
          time: dayOffsetToTime(d.day_offset) as any,
          value: d.change_pct,
        }))
      )
    })

    if (hasAnyData) {
      chart.timeScale().fitContent()
    }

    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) chart.applyOptions({ width: el.clientWidth })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [indicators, activeCategory, activePeriod, loading])

  const hasDataInCategory = filtered.some(ind => ind.has_data && ind.data_points?.length > 0)

  return (
    <div className="flex flex-col h-full">
      {/* 카테고리 탭 */}
      <div className="flex gap-1 px-3 pt-2 shrink-0">
        {CATEGORY_KEYS.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              activeCategory === cat
                ? 'bg-[var(--gold)] text-black border-[var(--gold)] font-semibold'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* 기간 선택 */}
      <div className="flex gap-1 px-3 pt-1.5 shrink-0">
        {PERIOD_OPTIONS.map((opt, i) => (
          <button
            key={opt.label}
            onClick={() => setActivePeriod(i)}
            className={`text-[10px] px-2 py-0.5 rounded border transition ${
              activePeriod === i
                ? 'border-[var(--gold)]/60 text-[var(--gold)]'
                : 'border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]'
            }`}
          >
            {opt.label}
          </button>
        ))}
        <span className="text-[10px] text-[var(--muted)] ml-auto self-center pr-1">
          변동률 (%)
        </span>
      </div>

      {/* 범례 */}
      {!loading && hasDataInCategory && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 pt-1 shrink-0">
          {filtered.filter(ind => ind.has_data).map((ind, i) => (
            <div key={ind.id} className="flex items-center gap-1">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: LINE_COLORS[i % LINE_COLORS.length] }}
              />
              <span className="text-[9px] text-[var(--muted)]">{ind.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* 차트 영역 */}
      <div className="flex-1 relative min-h-0 mt-1.5">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && !hasDataInCategory && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
            <span className="text-2xl text-[var(--muted)] opacity-30">📊</span>
            <span className="text-xs text-[var(--muted)]">데이터 없음</span>
            {filtered[0]?.no_data_reason && (
              <span className="text-[9px] text-[var(--muted)] opacity-60">{filtered[0].no_data_reason}</span>
            )}
          </div>
        )}
        <div
          ref={chartRef}
          className="absolute inset-0"
          style={{ touchAction: 'manipulation' }}
        />
      </div>
    </div>
  )
}
