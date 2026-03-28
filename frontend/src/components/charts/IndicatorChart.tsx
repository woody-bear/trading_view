import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  TickMarkType,
} from 'lightweight-charts'
import { useEffect, useRef, useState } from 'react'
import { onPriceUpdate } from '../../hooks/useWebSocket'
import type { PriceUpdate } from '../../stores/signalStore'
import type { ChartData } from '../../types'
import SignalGuide from './SignalGuide'
import SqueezeGuide from './SqueezeGuide'
import UBBPanel from './UBBPanel'

interface RealtimePrice {
  price: number
  open: number
  high: number
  low: number
  volume: number
  change_pct: number
}

interface BuyPoint {
  symbol: string
  price: number
  date: string
  markerTime: number
}

interface Props {
  data: ChartData
  watchlistId?: number
  realtimePrice?: RealtimePrice | null
  buyPoint?: BuyPoint | null
  onBuyMarkerClick?: (point: { price: number; markerTime: number }) => void
}

export default function IndicatorChart({ data, watchlistId, realtimePrice, buyPoint, onBuyMarkerClick }: Props) {
  const mainRef = useRef<HTMLDivElement>(null)
  const rsiRef = useRef<HTMLDivElement>(null)
  const macdRef = useRef<HTMLDivElement>(null)
  // 실시간 업데이트를 위한 series ref
  const candleSeriesRef = useRef<any>(null)
  const volSeriesRef = useRef<any>(null)
  const lastCandleRef = useRef<any>(null)
  const todayCandleCreatedRef = useRef(false)
  const priceLineRef = useRef<any>(null)
  const onBuyMarkerClickRef = useRef(onBuyMarkerClick)
  onBuyMarkerClickRef.current = onBuyMarkerClick
  const [markerWarning, setMarkerWarning] = useState(false)

  useEffect(() => {
    if (!mainRef.current || !data.candles?.length) return
    todayCandleCreatedRef.current = false
    setMarkerWarning(false)
    const el = mainRef.current
    el.innerHTML = ''
    if (rsiRef.current) rsiRef.current.innerHTML = ''
    if (macdRef.current) macdRef.current.innerHTML = ''

    const width = el.clientWidth
    const tickMarkFormatter = (time: number, tickMarkType: TickMarkType) => {
      const d = new Date(time * 1000)
      const m = d.getUTCMonth() + 1
      const day = d.getUTCDate()
      if (tickMarkType === TickMarkType.Year) return `${d.getUTCFullYear()}년`
      if (tickMarkType === TickMarkType.Month) return `${m}월`
      return `${m}/${day}`
    }
    const chartOpts = {
      width,
      layout: { background: { type: ColorType.Solid as const, color: '#1e293b' }, textColor: '#94a3b8' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#262f3d' } },
      crosshair: { mode: 0 as const },
      rightPriceScale: { borderColor: '#334155' },
      localization: { locale: 'en-US' },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
        borderColor: '#334155',
        tickMarkFormatter,
      },
    }

    // === MAIN CHART ===
    const mainChart = createChart(el, { ...chartOpts, height: 450 })

    // 캔들스틱
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#26a69a', downColor: '#ef5350',
      wickUpColor: '#26a69a', wickDownColor: '#ef5350',
      borderVisible: false,
    })
    const candleData = data.candles.map(c => ({
      time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
    }))
    candleSeries.setData(candleData)
    candleSeriesRef.current = candleSeries

    // 마지막 캔들 저장 (실시간 업데이트용)
    const lastCandle = data.candles[data.candles.length - 1]
    lastCandleRef.current = { ...lastCandle }

    // BB 밴드 라인 (시안)
    const addLine = (key: string, color: string, lw: number = 1, ls?: number) => {
      const pts = (data.indicators as any)[key]
      if (!pts?.length) return
      const s = mainChart.addSeries(LineSeries, {
        color, lineWidth: lw as any,
        ...(ls !== undefined ? { lineStyle: ls } : {}),
        lastValueVisible: false, priceLineVisible: false,
      })
      s.setData(pts.map((p: any) => ({ time: p.time, value: p.value })))
    }

    addLine('bb_upper', 'rgba(0, 188, 212, 0.6)', 1)
    addLine('bb_middle', 'rgba(156, 163, 175, 0.4)', 1, 2)
    addLine('bb_lower', 'rgba(0, 188, 212, 0.6)', 1)
    addLine('ema_20', '#f59e0b', 1)
    addLine('ema_50', '#8b5cf6', 1)
    addLine('ema_200', '#ef4444', 1, 2)

    // BUY/SELL 마커
    if (data.markers?.length) {
      try {
        const markersWithIds = data.markers.map(m => ({
          time: m.time as any,
          position: m.position as any,
          color: m.color,
          shape: m.shape as any,
          text: m.text,
          size: 2,
          id: `${m.position}-${m.time}`,
        }))
        const markersPlugin = createSeriesMarkers(candleSeries, markersWithIds)

        // 마커 호버 색상 강조 (PC 전용)
        const hasHover = window.matchMedia('(hover: hover)').matches
        if (hasHover) {
          const originalColors = new Map(markersWithIds.map(m => [m.id, m.color]))
          const highlightColors: Record<string, string> = { '#22c55e': '#4ade80', '#ef4444': '#f87171' }
          mainChart.subscribeCrosshairMove((param: any) => {
            if (!param.time) {
              markersPlugin.setMarkers(markersWithIds.map(m => ({ ...m, color: originalColors.get(m.id) || m.color })))
              return
            }
            const matched = markersWithIds.find(m => m.time === param.time)
            if (matched) {
              markersPlugin.setMarkers(markersWithIds.map(m =>
                m.id === matched.id
                  ? { ...m, color: highlightColors[originalColors.get(m.id) || ''] || m.color }
                  : { ...m, color: originalColors.get(m.id) || m.color }
              ))
            } else {
              markersPlugin.setMarkers(markersWithIds.map(m => ({ ...m, color: originalColors.get(m.id) || m.color })))
            }
          })
        }
      } catch (e) {
        console.error('[IndicatorChart] 마커 렌더링 실패:', e)
        setMarkerWarning(true)
      }
    }

    // 스퀴즈 도트
    if (data.squeeze_dots?.length) {
      const colorGroups: Record<string, any[]> = {}
      for (const dot of data.squeeze_dots) {
        const c = (dot as any).color || '#64748b'
        if (!colorGroups[c]) colorGroups[c] = []
        colorGroups[c].push({ time: dot.time as any, value: dot.value })
      }
      for (const [color, points] of Object.entries(colorGroups)) {
        const s = mainChart.addSeries(LineSeries, {
          color,
          lineWidth: 0 as any,
          lastValueVisible: false,
          priceLineVisible: false,
          pointMarkersVisible: true,
          pointMarkersRadius: 3,
        })
        s.setData(points)
      }
    }

    // BUY 마커 클릭 → 매수지점 기록 (ref로 최신 콜백 참조)
    mainChart.subscribeClick((param: any) => {
      if (!param.time || !onBuyMarkerClickRef.current) return
      // BUY 마커와 시간 매칭 (SQZ BUY 포함)
      const clickedBuy = data.markers?.find(
        (m: any) => m.time === param.time && (m.text === 'BUY' || m.text === 'SQZ BUY')
      )
      if (clickedBuy) {
        const candle = data.candles.find((c: any) => c.time === param.time)
        if (candle) {
          onBuyMarkerClickRef.current({ price: candle.close, markerTime: clickedBuy.time })
        }
      }
    })

    // 거래량 (하단 오버레이)
    const volSeries = mainChart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol',
      lastValueVisible: false, priceLineVisible: false,
    })
    mainChart.priceScale('vol').applyOptions({ scaleMargins: { top: 0.88, bottom: 0 } })
    volSeries.setData(data.candles.map(c => ({
      time: c.time as any,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)',
    })))
    volSeriesRef.current = volSeries

    mainChart.timeScale().fitContent()

    // === RSI 서브차트 ===
    if (rsiRef.current && (data.indicators as any).rsi?.length) {
      const rsiChart = createChart(rsiRef.current, { ...chartOpts, height: 110 })
      const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#a78bfa', lineWidth: 2 as any })
      rsiSeries.setData((data.indicators as any).rsi.map((p: any) => ({ time: p.time, value: p.value })))

      const addHLine = (val: number, color: string) => {
        const pts = (data.indicators as any).rsi
        if (pts.length >= 2) {
          const hl = rsiChart.addSeries(LineSeries, { color, lineWidth: 1 as any, lineStyle: 2, lastValueVisible: false, priceLineVisible: false })
          hl.setData([{ time: pts[0].time, value: val }, { time: pts[pts.length - 1].time, value: val }])
        }
      }
      addHLine(70, 'rgba(239,68,68,0.4)')
      addHLine(30, 'rgba(34,197,94,0.4)')
      addHLine(50, 'rgba(100,116,139,0.2)')
      rsiChart.timeScale().fitContent()
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r) rsiChart.timeScale().setVisibleLogicalRange(r) })
      rsiChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r) mainChart.timeScale().setVisibleLogicalRange(r) })
    }

    // === MACD 서브차트 ===
    if (macdRef.current && (data.indicators as any).macd_hist?.length) {
      const macdChart = createChart(macdRef.current, { ...chartOpts, height: 110 })
      const histSeries = macdChart.addSeries(HistogramSeries, { lastValueVisible: false, priceLineVisible: false })
      histSeries.setData((data.indicators as any).macd_hist.map((p: any) => ({
        time: p.time, value: p.value,
        color: p.value >= 0 ? 'rgba(38,166,154,0.6)' : 'rgba(239,83,80,0.6)',
      })))
      if ((data.indicators as any).macd_line?.length) {
        const ml = macdChart.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 1 as any, lastValueVisible: false, priceLineVisible: false })
        ml.setData((data.indicators as any).macd_line.map((p: any) => ({ time: p.time, value: p.value })))
      }
      if ((data.indicators as any).macd_signal?.length) {
        const ms = macdChart.addSeries(LineSeries, { color: '#f97316', lineWidth: 1 as any, lastValueVisible: false, priceLineVisible: false })
        ms.setData((data.indicators as any).macd_signal.map((p: any) => ({ time: p.time, value: p.value })))
      }
      macdChart.timeScale().fitContent()
      mainChart.timeScale().subscribeVisibleLogicalRangeChange((r) => { if (r) macdChart.timeScale().setVisibleLogicalRange(r) })
    }

    // 실시간 가격 업데이트 구독
    let unsubPrice: (() => void) | undefined
    if (watchlistId) {
      unsubPrice = onPriceUpdate((updates: PriceUpdate[]) => {
        const u = updates.find(p => p.watchlist_id === watchlistId)
        if (!u || !candleSeriesRef.current || !lastCandleRef.current) return

        const lc = lastCandleRef.current
        const updated = {
          time: lc.time as any,
          open: lc.open,
          high: Math.max(lc.high, u.price),
          low: Math.min(lc.low, u.price),
          close: u.price,
        }
        candleSeriesRef.current.update(updated)
        lastCandleRef.current = { ...lc, high: updated.high, low: updated.low, close: u.price }

        // 거래량도 업데이트
        if (volSeriesRef.current && u.volume > 0) {
          volSeriesRef.current.update({
            time: lc.time as any,
            value: u.volume,
            color: u.price >= lc.open ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)',
          })
        }
      })
    }

    const resizeObs = new ResizeObserver(() => { mainChart.applyOptions({ width: el.clientWidth }) })
    resizeObs.observe(el)
    return () => {
      unsubPrice?.()
      resizeObs.disconnect()
      mainChart.remove()
    }
  }, [data, watchlistId])

  // 매수지점 가격선 — buyPoint 변경 시 priceLine 생성/제거
  useEffect(() => {
    const series = candleSeriesRef.current
    if (!series) return

    // 기존 priceLine 제거
    if (priceLineRef.current) {
      try { series.removePriceLine(priceLineRef.current) } catch {}
      priceLineRef.current = null
    }

    // 새 priceLine 생성
    if (buyPoint) {
      priceLineRef.current = series.createPriceLine({
        price: buyPoint.price,
        color: '#22c55e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: `매수 ${buyPoint.price.toLocaleString()}`,
      })
    }
  }, [buyPoint])

  // 매수지점 수익률 라벨 실시간 업데이트
  useEffect(() => {
    if (!buyPoint || !realtimePrice || !priceLineRef.current) return
    const pct = ((realtimePrice.price - buyPoint.price) / buyPoint.price * 100).toFixed(1)
    const sign = Number(pct) >= 0 ? '+' : ''
    priceLineRef.current.applyOptions({
      title: `매수 ${buyPoint.price.toLocaleString()} (${sign}${pct}%)`,
    })
  }, [realtimePrice, buyPoint])

  // SSE 실시간 가격으로 차트 마지막 캔들 업데이트 (1초 간격)
  useEffect(() => {
    if (!realtimePrice || !candleSeriesRef.current || !lastCandleRef.current) return

    const marketOpen = (data as any).market_open
    const price = realtimePrice.price

    // market_open=true이고 아직 당일 캔들을 생성하지 않았으면 새 캔들 추가
    if (marketOpen && !todayCandleCreatedRef.current) {
      const todayTs = Math.floor(Date.now() / 1000 / 86400) * 86400  // UTC 자정 기준 timestamp
      const newCandle = { time: todayTs as any, open: price, high: price, low: price, close: price }
      candleSeriesRef.current.update(newCandle)
      lastCandleRef.current = { ...newCandle, volume: realtimePrice.volume || 0 }
      todayCandleCreatedRef.current = true

      if (volSeriesRef.current) {
        volSeriesRef.current.update({
          time: todayTs as any,
          value: realtimePrice.volume || 0,
          color: 'rgba(38,166,154,0.12)',
        })
      }
      return
    }

    const lc = lastCandleRef.current
    const updated = {
      time: lc.time as any,
      open: lc.open,
      high: Math.max(lc.high, price),
      low: Math.min(lc.low, price),
      close: price,
    }
    candleSeriesRef.current.update(updated)
    lastCandleRef.current = { ...lc, high: updated.high, low: updated.low, close: price }

    if (volSeriesRef.current && realtimePrice.volume > 0) {
      volSeriesRef.current.update({
        time: lc.time as any,
        value: realtimePrice.volume,
        color: price >= lc.open ? 'rgba(38,166,154,0.12)' : 'rgba(239,83,80,0.12)',
      })
    }
  }, [realtimePrice])

  return (
    <div>
      <SqueezeGuide />
      <SignalGuide />
      {(data as any).current && <UBBPanel data={data} />}
      <div ref={mainRef} className="w-full rounded-t-lg overflow-hidden border border-[var(--border)]" />
      <div className="flex items-center gap-2 px-3 py-1 bg-[#1e293b] border-x border-[var(--border)]">
        <span className="text-[10px] text-[var(--muted)]">RSI (14)</span>
      </div>
      <div ref={rsiRef} className="w-full overflow-hidden border-x border-[var(--border)]" />
      <div className="flex items-center gap-2 px-3 py-1 bg-[#1e293b] border-x border-[var(--border)]">
        <span className="text-[10px] text-[var(--muted)]">MACD (12,26,9)</span>
      </div>
      <div ref={macdRef} className="w-full rounded-b-lg overflow-hidden border border-[var(--border)] border-t-0" />
      {markerWarning && (
        <div className="px-3 py-1.5 bg-yellow-900/30 border border-yellow-700/50 rounded text-yellow-400 text-xs mt-1">
          시그널 마커를 표시할 수 없습니다
        </div>
      )}
    </div>
  )
}
