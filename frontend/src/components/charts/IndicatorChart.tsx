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

interface OverlayState {
  visible: boolean
  x: number
  y: number
  markerTime: number
  date: string
  isScraped: boolean
}

interface Props {
  data: ChartData
  watchlistId?: number
  realtimePrice?: RealtimePrice | null
  buyPoint?: BuyPoint | null
  onBuyMarkerClick?: (point: { price: number; markerTime: number }) => void
  scrapedDates?: Set<string>
  onScrapSave?: (markerTime: number, date: string) => void
  trendLines?: import('../../api/client').TrendLine[]
}

export default function IndicatorChart({ data, watchlistId, realtimePrice, buyPoint, onBuyMarkerClick, scrapedDates, onScrapSave, trendLines }: Props) {
  const mainRef = useRef<HTMLDivElement>(null)
  const mainChartRef = useRef<any>(null)
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
  const onScrapSaveRef = useRef(onScrapSave)
  onScrapSaveRef.current = onScrapSave
  const scrapedDatesRef = useRef(scrapedDates)
  scrapedDatesRef.current = scrapedDates
  const [markerWarning, setMarkerWarning] = useState(false)
  const overlayRef = useRef<HTMLDivElement>(null)
  const alignmentRef = useRef<HTMLDivElement>(null)
  const overlayStateRef = useRef<OverlayState>({ visible: false, x: 0, y: 0, markerTime: 0, date: '', isScraped: false })
  const overlayHoveredRef = useRef(false)

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
      layout: { background: { type: ColorType.Solid as const, color: '#000000' }, textColor: '#8e8e93' },
      grid: { vertLines: { color: '#2c2c2e' }, horzLines: { color: 'rgba(44,44,46,0.5)' } },
      crosshair: { mode: 0 as const },
      rightPriceScale: { borderColor: '#2c2c2e' },
      localization: { locale: 'en-US' },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
        borderColor: '#2c2c2e',
        tickMarkFormatter,
      },
    }

    // === MAIN CHART ===
    const mainChart = createChart(el, { ...chartOpts, height: 450 })
    mainChartRef.current = mainChart

    // 캔들스틱
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#ff4b6a', downColor: '#4285f4',
      wickUpColor: '#ff4b6a', wickDownColor: '#4285f4',
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
    addLine('ema_5',   '#06b6d4', 1)        // 단기 (시안)
    addLine('ema_20',  '#3b82f6', 1)        // 중단기 (파랑)
    addLine('ema_50',  '#f59e0b', 1)        // 기존 주황 (내부 판정선)
    addLine('ema_60',  '#a855f7', 1)        // 중기 (보라)
    addLine('ema_120', '#ec4899', 2)        // 장기 (핑크, 2px 강조)

    // ── EMA 정배열/역배열 말풍선 ───────────────────────────────────────────
    // 호버된 날짜에 ema_5 > ema_20 > ema_50 > ema_60 > ema_120 (또는 전부 <) 일 때만 표시
    {
      const emaKeys = ['ema_5', 'ema_20', 'ema_50', 'ema_60', 'ema_120'] as const
      const emaByTime: Record<string, Map<number, number>> = {}
      for (const k of emaKeys) {
        const m = new Map<number, number>()
        for (const p of ((data.indicators as any)[k] || [])) m.set(p.time, p.value)
        emaByTime[k] = m
      }
      const candleHighByTime = new Map<number, number>()
      for (const c of data.candles) candleHighByTime.set(c.time as number, c.high)

      const classify = (time: number): 'up' | 'down' | null => {
        const e5 = emaByTime.ema_5.get(time)
        const e20 = emaByTime.ema_20.get(time)
        const e50 = emaByTime.ema_50.get(time)
        const e60 = emaByTime.ema_60.get(time)
        const e120 = emaByTime.ema_120.get(time)
        if (e5 == null || e20 == null || e50 == null || e60 == null || e120 == null) return null
        if (e5 > e20 && e20 > e50 && e50 > e60 && e60 > e120) return 'up'
        if (e5 < e20 && e20 < e50 && e50 < e60 && e60 < e120) return 'down'
        return null
      }

      let lastTimeShown: number | null = null
      mainChart.subscribeCrosshairMove((param: any) => {
        const bubble = alignmentRef.current
        if (!bubble) return
        if (!param.time || !param.point) {
          bubble.style.display = 'none'
          lastTimeShown = null
          return
        }
        const kind = classify(param.time)
        if (!kind) {
          bubble.style.display = 'none'
          lastTimeShown = null
          return
        }
        const high = candleHighByTime.get(param.time)
        if (high == null) { bubble.style.display = 'none'; return }

        // 내용 갱신 (같은 날짜면 스킵)
        if (lastTimeShown !== param.time) {
          const e5 = emaByTime.ema_5.get(param.time)!
          const e20 = emaByTime.ema_20.get(param.time)!
          const e50 = emaByTime.ema_50.get(param.time)!
          const e60 = emaByTime.ema_60.get(param.time)!
          const e120 = emaByTime.ema_120.get(param.time)!
          const label = kind === 'up' ? '📈 정배열' : '📉 역배열'
          const headClass = kind === 'up' ? 'color:#4ade80' : 'color:#f87171'
          bubble.innerHTML =
            `<div style="font-weight:600;${headClass};font-size:11px">${label}</div>` +
            `<div style="font-family:monospace;color:#fff;font-size:10px;margin-top:2px;line-height:1.35">` +
            `5:${e5.toFixed(1)} · 20:${e20.toFixed(1)}<br/>` +
            `50:${e50.toFixed(1)} · 60:${e60.toFixed(1)}<br/>` +
            `120:${e120.toFixed(1)}` +
            `</div>`
          lastTimeShown = param.time
        }

        // 위치: 캔들 high 바로 위, 수평은 커서 기준
        bubble.style.display = 'block'
        const bw = bubble.offsetWidth || 130
        const bh = bubble.offsetHeight || 64
        const x = param.point.x as number
        const yHigh = (candleSeries as any).priceToCoordinate(high) ?? 0
        let left = x - bw / 2
        let top = yHigh - bh - 10
        if (top < 0) top = yHigh + 10  // 위로 삐져나가면 아래로 flip
        // 차트 가로 경계 클램프
        left = Math.max(4, Math.min(el.clientWidth - bw - 4, left))
        bubble.style.left = `${left}px`
        bubble.style.top = `${top}px`
      })
    }

    // BUY/SELL 마커
    if (data.markers?.length) {
      try {
        const markersWithIds = data.markers.map(m => {
          const isBuyMarker = m.text === 'BUY' || m.text === 'SQZ BUY'
          const markerDate = new Date(m.time * 1000).toISOString().slice(0, 10)
          const isScraped = isBuyMarker && (scrapedDatesRef.current?.has(markerDate) ?? false)
          return {
            time: m.time as any,
            position: m.position as any,
            color: isScraped ? '#f59e0b' : m.color,
            shape: m.shape as any,
            text: m.text,
            size: 2,
            id: `${m.position}-${m.time}`,
          }
        })
        const markersPlugin = createSeriesMarkers(candleSeries, markersWithIds)

        // 마커 호버 색상 강조 (PC 전용)
        const hasHover = window.matchMedia('(hover: hover)').matches

        const showOverlay = (x: number, y: number, markerTime: number, date: string, isScraped: boolean) => {
            const div = overlayRef.current
            if (!div) return
            // 이미 같은 마커 표시 중이면 위치 업데이트 안 함 (버튼 클릭 가능하도록)
            if (overlayStateRef.current.visible && overlayStateRef.current.markerTime === markerTime) return
            overlayStateRef.current = { visible: true, x, y, markerTime, date, isScraped }
            const left = Math.max(4, Math.min(x - 60, el.clientWidth - 140))
            const top = Math.max(4, y - 44)
            div.style.left = `${left}px`
            div.style.top = `${top}px`
            div.style.display = 'block'
            // 버튼/텍스트 업데이트
            const btn = div.querySelector('[data-scrap-btn]') as HTMLButtonElement | null
            const saved = div.querySelector('[data-scrap-saved]') as HTMLElement | null
            if (btn) btn.style.display = isScraped ? 'none' : 'block'
            if (saved) saved.style.display = isScraped ? 'block' : 'none'
            // 버튼 클릭 핸들러 교체
            if (btn && !isScraped) {
              btn.onclick = () => {
                onScrapSaveRef.current?.(markerTime, date)
                if (div) div.style.display = 'none'
              }
            }
          }
          const hideOverlay = () => {
            if (overlayHoveredRef.current) return  // 버튼 위에 마우스 있으면 숨기지 않음
            const div = overlayRef.current
            if (div) div.style.display = 'none'
            overlayStateRef.current.visible = false
          }

        if (hasHover) {
          const originalColors = new Map(markersWithIds.map(m => [m.id, m.color]))
          const highlightColors: Record<string, string> = { '#22c55e': '#4ade80', '#ef4444': '#f87171', '#f59e0b': '#fbbf24' }
          mainChart.subscribeCrosshairMove((param: any) => {
            if (!param.time) {
              markersPlugin.setMarkers(markersWithIds.map(m => ({ ...m, color: originalColors.get(m.id) || m.color })))
              hideOverlay()
              return
            }
            const matched = markersWithIds.find(m => m.time === param.time)
            if (matched) {
              markersPlugin.setMarkers(markersWithIds.map(m =>
                m.id === matched.id
                  ? { ...m, color: highlightColors[originalColors.get(m.id) || ''] || m.color }
                  : { ...m, color: originalColors.get(m.id) || m.color }
              ))
              const isBuy = matched.text === 'BUY' || matched.text === 'SQZ BUY'
              if (isBuy && onScrapSaveRef.current) {
                const markerDate = new Date(matched.time * 1000).toISOString().slice(0, 10)
                const isScraped = scrapedDatesRef.current?.has(markerDate) ?? false
                showOverlay(param.point?.x ?? el.clientWidth / 2, param.point?.y ?? 60, matched.time, markerDate, isScraped)
              } else {
                hideOverlay()
              }
            } else {
              markersPlugin.setMarkers(markersWithIds.map(m => ({ ...m, color: originalColors.get(m.id) || m.color })))
              hideOverlay()
            }
          })
        }

        // 모바일 BUY 마커 탭 → 스크랩 오버레이 2초 표시 (T008)
        if (!hasHover) {
          let hideTimer: ReturnType<typeof setTimeout>
          mainChart.subscribeClick((param: any) => {
            if (!param.time || !onScrapSaveRef.current) return
            const clickedBuy = markersWithIds.find(
              m => m.time === param.time && (m.text === 'BUY' || m.text === 'SQZ BUY')
            )
            if (clickedBuy) {
              const markerDate = new Date(clickedBuy.time * 1000).toISOString().slice(0, 10)
              const isScraped = scrapedDatesRef.current?.has(markerDate) ?? false
              showOverlay(param.point?.x ?? el.clientWidth / 2, param.point?.y ?? 60, clickedBuy.time, markerDate, isScraped)
              clearTimeout(hideTimer)
              hideTimer = setTimeout(() => hideOverlay(), 2000)
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
      color: c.close >= c.open ? 'rgba(255,75,106,0.30)' : 'rgba(66,133,244,0.28)',
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
      addHLine(70, 'rgba(66,133,244,0.4)')
      addHLine(30, 'rgba(255,75,106,0.4)')
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
        color: p.value >= 0 ? 'rgba(255,75,106,0.6)' : 'rgba(66,133,244,0.6)',
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
            color: u.price >= lc.open ? 'rgba(255,75,106,0.12)' : 'rgba(66,133,244,0.12)',
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

    // market_open=true이고 아직 당일 캔들을 생성하지 않았으면 새 캔들 추가.
    // today_ts는 백엔드(시장 시간대 기준)에서 받음 — US는 ET midnight UTC, KR은 KST midnight UTC.
    // 누락 시 UTC midnight로 폴백 (KR은 정확, US는 약 4시간 차이 허용).
    if (marketOpen && !todayCandleCreatedRef.current) {
      const lastCandleTs = lastCandleRef.current?.time as number | undefined
      const fallbackTs = Math.floor(Date.now() / 1000 / 86400) * 86400
      let todayTs = ((data as any).today_ts as number | undefined) ?? fallbackTs
      // 기존 마지막 캔들과 시각이 같으면 새로 만들지 말고 그 캔들을 업데이트 모드로
      if (lastCandleTs && todayTs <= lastCandleTs) {
        todayCandleCreatedRef.current = true
        return
      }
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
        color: price >= lc.open ? 'rgba(255,75,106,0.12)' : 'rgba(66,133,244,0.12)',
      })
    }
  }, [realtimePrice])

  // 추세선 오버레이 (024) — trendLines prop이 비어있으면 아무것도 안 그림
  useEffect(() => {
    const chart = mainChartRef.current
    if (!chart) return
    // 이전 추세선 시리즈 제거
    const prev = (chart as any).__trendLineSeries as any[] | undefined
    if (prev) {
      for (const s of prev) { try { chart.removeSeries(s) } catch {} }
    }
    const series: any[] = []
    if (trendLines && trendLines.length > 0) {
      for (const line of trendLines) {
        try {
          const s = chart.addSeries(LineSeries, {
            color: line.style.color,
            lineWidth: 1 as any,
            lineStyle: line.style.dashed ? 2 : 0,
            lastValueVisible: false,
            priceLineVisible: false,
            crosshairMarkerVisible: false,
          })
          s.setData([
            { time: line.start.time as any, value: line.start.price },
            { time: line.end.time as any, value: line.end.price },
          ])
          series.push(s)
        } catch {}
      }
    }
    ;(chart as any).__trendLineSeries = series
  }, [trendLines])

  return (
    <div>
      <SqueezeGuide />
      <SignalGuide />
      {(data as any).current && <UBBPanel data={data} />}
      <div className="relative">
        <div ref={mainRef} className="w-full rounded-t-lg overflow-hidden border border-[var(--border)]" />
        {/* EMA 정배열/역배열 말풍선 — 호버 시에만 나타남 */}
        <div
          ref={alignmentRef}
          className="absolute z-30 px-2 py-1.5 rounded bg-black/85 backdrop-blur-sm border border-[var(--border)] pointer-events-none shadow-lg"
          style={{ display: 'none', minWidth: 120 }}
        />
        {/* EMA 범례 — 메인 차트 좌상단 오버레이 */}
        <div
          className="absolute top-2 left-2 z-40 bg-black/60 backdrop-blur-sm border border-[var(--border)] rounded px-2 py-1.5 text-xs pointer-events-none"
          style={{ lineHeight: 1.3 }}
        >
          <div className="text-[10px] text-[var(--muted)] mb-1">EMA</div>
          {[
            { label: '5',   color: '#06b6d4', width: 1 },
            { label: '20',  color: '#3b82f6', width: 1 },
            { label: '50',  color: '#f59e0b', width: 1 },
            { label: '60',  color: '#a855f7', width: 1 },
            { label: '120', color: '#ec4899', width: 2 },
          ].map((e) => (
            <div key={e.label} className="flex items-center gap-1.5">
              <div style={{ width: 18, height: e.width, background: e.color }} />
              <span className="font-mono text-white text-[11px]">{e.label}</span>
            </div>
          ))}
        </div>
        {/* 스크랩 오버레이 — DOM ref로 직접 제어 (React re-render 우회) */}
        <div
          ref={overlayRef}
          style={{ position: 'absolute', display: 'none', pointerEvents: 'auto', zIndex: 50 }}
          onMouseEnter={() => { overlayHoveredRef.current = true }}
          onMouseLeave={() => {
            overlayHoveredRef.current = false
            const div = overlayRef.current
            if (div) div.style.display = 'none'
            overlayStateRef.current.visible = false
          }}
        >
          <button
            data-scrap-btn
            className="bg-green-900/90 border border-green-600/60 rounded-lg px-3 py-1.5 text-green-300 text-xs font-medium shadow-lg whitespace-nowrap hover:bg-green-800/90 transition-colors"
          >
            이 BUY 사례 저장
          </button>
          <div
            data-scrap-saved
            style={{ display: 'none' }}
            className="bg-yellow-900/90 border border-yellow-600/60 rounded-lg px-3 py-1.5 text-yellow-300 text-xs font-medium shadow-lg whitespace-nowrap"
          >
            저장됨 ✓
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-1 bg-black border-x border-[var(--border)]">
        <span className="text-caption text-[var(--muted)]">RSI (14)</span>
      </div>
      <div ref={rsiRef} className="w-full overflow-hidden border-x border-[var(--border)]" />
      <div className="flex items-center gap-2 px-3 py-1 bg-black border-x border-[var(--border)]">
        <span className="text-caption text-[var(--muted)]">MACD (12,26,9)</span>
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
