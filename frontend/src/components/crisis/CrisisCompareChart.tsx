import { ColorType, createChart, LineSeries } from 'lightweight-charts'
import { useEffect, useRef } from 'react'

interface CompareDataPoint {
  day_offset: number
  change_pct: number
}

interface CompareSeries {
  event_id: number | string
  event_name: string
  is_ongoing: boolean
  data_points: CompareDataPoint[]
}

interface Props {
  series: CompareSeries[]
  indicatorName: string
  loading?: boolean
}

const SERIES_COLORS = ['#f59e0b', '#60a5fa', '#34d399', '#f87171', '#a78bfa']

// day_offset → synthetic UTCTimestamp
const BASE_TS = 946684800
const dayOffsetToTime = (offset: number): number => BASE_TS + offset * 86400

export default function CrisisCompareChart({ series, indicatorName, loading }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!chartRef.current || loading || series.length === 0) return

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
      height: el.clientHeight || 280,
    })

    // Day 0 수직선 — autoscaleInfoProvider: () => null 로 Y축 스케일 계산에서 제외
    const zeroSeries = chart.addSeries(LineSeries, {
      color: 'rgba(245,158,11,0.6)',
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

    series.forEach((s, i) => {
      if (!s.data_points || s.data_points.length === 0) return

      const lineSeries = chart.addSeries(LineSeries, {
        color: SERIES_COLORS[i % SERIES_COLORS.length],
        lineWidth: s.is_ongoing ? 2 : 2,
        lineStyle: 0,
        title: s.event_name,
        priceLineVisible: false,
        crosshairMarkerRadius: 4,
        lastValueVisible: s.is_ongoing,
      })

      lineSeries.setData(
        s.data_points.map(d => ({
          time: dayOffsetToTime(d.day_offset) as any,
          value: d.change_pct,
        }))
      )
    })

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(() => {
      if (el.clientWidth > 0) chart.applyOptions({ width: el.clientWidth })
    })
    ro.observe(el)

    return () => {
      ro.disconnect()
      chart.remove()
    }
  }, [series, loading])

  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1 shrink-0">
        <span className="text-xs font-semibold text-[var(--text)]">{indicatorName} 비교</span>
        <span className="text-[10px] text-[var(--muted)]">변동률 (%)</span>
      </div>

      {/* 범례 */}
      {series.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 pb-1 shrink-0">
          {series.map((s, i) => (
            <div key={String(s.event_id)} className="flex items-center gap-1">
              <div
                className="w-3 h-0.5 rounded"
                style={{ backgroundColor: SERIES_COLORS[i % SERIES_COLORS.length] }}
              />
              <span className="text-[9px] text-[var(--muted)]">
                {s.event_name}
                {s.is_ongoing && (
                  <span className="ml-1 text-[8px] bg-red-500 text-white px-0.5 rounded">진행중</span>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* 차트 */}
      <div className="flex-1 relative min-h-0">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!loading && series.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-[var(--muted)]">비교 데이터 없음</span>
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
