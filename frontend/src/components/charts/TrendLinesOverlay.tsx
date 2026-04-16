import { useEffect, useRef } from 'react'
import { LineSeries } from 'lightweight-charts'
import type { TrendLine } from '../../api/client'

interface Props {
  chart: any  // IChartApi
  lines: TrendLine[]
}

export default function TrendLinesOverlay({ chart, lines }: Props) {
  const seriesRefs = useRef<any[]>([])

  useEffect(() => {
    if (!chart) return

    // 이전 시리즈 제거
    for (const s of seriesRefs.current) {
      try { chart.removeSeries(s) } catch {}
    }
    seriesRefs.current = []

    // 새 시리즈 추가
    for (const line of lines) {
      try {
        const s = chart.addSeries(LineSeries, {
          color: line.style.color,
          lineWidth: 1 as any,
          lineStyle: line.style.dashed ? 2 : 0,  // 2 = Dashed
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
        s.setData([
          { time: line.start.time as any, value: line.start.price },
          { time: line.end.time as any, value: line.end.price },
        ])
        seriesRefs.current.push(s)
      } catch {}
    }

    return () => {
      for (const s of seriesRefs.current) {
        try { chart.removeSeries(s) } catch {}
      }
      seriesRefs.current = []
    }
  }, [chart, lines])

  return null  // 렌더리스 컴포넌트 — 차트에 직접 시리즈 주입만
}
