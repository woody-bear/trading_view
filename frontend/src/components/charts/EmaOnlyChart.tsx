import {
  ColorType,
  createChart,
  LineSeries,
  TickMarkType,
} from 'lightweight-charts'
import { useEffect, useRef } from 'react'
import type { ChartData } from '../../types'

interface Props {
  data: ChartData
}

const EMA_CONFIG = [
  { key: 'ema_5',   label: '5',   color: '#06b6d4' },   // 시안
  { key: 'ema_20',  label: '20',  color: '#3b82f6' },   // 파랑
  { key: 'ema_60',  label: '60',  color: '#a855f7' },   // 보라
  { key: 'ema_120', label: '120', color: '#ec4899' },   // 핑크
] as const

export default function EmaOnlyChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const width = el.clientWidth || 800

    const tickMarkFormatter = (time: number, tickMarkType: TickMarkType) => {
      const d = new Date(time * 1000)
      const m = d.getUTCMonth() + 1
      const day = d.getUTCDate()
      if (tickMarkType === TickMarkType.Year) return `${d.getUTCFullYear()}년`
      if (tickMarkType === TickMarkType.Month) return `${m}월`
      return `${m}/${day}`
    }

    const chart = createChart(el, {
      width,
      height: 220,
      layout: {
        background: { type: ColorType.Solid as const, color: '#ffffff' },
        textColor: '#6b7280',
      },
      grid: {
        vertLines: { color: 'rgba(0,0,0,0.04)' },
        horzLines: { color: 'rgba(0,0,0,0.06)' },
      },
      crosshair: { mode: 0 as const },
      rightPriceScale: { borderColor: '#e5e7eb' },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
        borderColor: '#e5e7eb',
        tickMarkFormatter,
      },
    })

    // EMA 4종만 그리기 (일봉 기준, 캔들/BB/볼륨/마커 없음)
    for (const { key, color } of EMA_CONFIG) {
      const pts = (data.indicators as any)[key]
      if (!pts?.length) continue
      const s = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2 as any,
        lastValueVisible: true,
        priceLineVisible: false,
      })
      s.setData(pts.map((p: any) => ({ time: p.time, value: p.value })))
    }

    chart.timeScale().fitContent()

    // 리사이즈 대응
    const onResize = () => {
      if (!el) return
      chart.applyOptions({ width: el.clientWidth || 800 })
    }
    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      chart.remove()
    }
  }, [data])

  return (
    <div className="relative mt-3">
      <div
        className="flex items-center gap-3 px-3 py-1 rounded-t-lg text-xs"
        style={{ background: 'var(--bg-1)', border: '1px solid var(--border)' }}
      >
        <span style={{ color: 'var(--fg-3)' }}>EMA 추이 (일봉)</span>
        {EMA_CONFIG.map((e) => (
          <div key={e.key} className="flex items-center gap-1">
            <div style={{ width: 14, height: 2, background: e.color }} />
            <span className="font-mono text-[11px]" style={{ color: 'var(--fg-1)' }}>{e.label}</span>
          </div>
        ))}
      </div>
      <div
        ref={containerRef}
        className="w-full rounded-b-lg overflow-hidden border-t-0"
        style={{ border: '1px solid var(--border)', borderTop: 'none' }}
      />
    </div>
  )
}
