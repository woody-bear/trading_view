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
import type { ChartData } from '../../types'

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
  realtimePrice?: RealtimePrice | null
  buyPoint?: BuyPoint | null
  onBuyMarkerClick?: (point: { price: number; markerTime: number }) => void
  scrapedDates?: Set<string>
  onScrapSave?: (markerTime: number, date: string) => void
  trendLines?: import('../../api/client').TrendLine[]
  shortTrendPivots?: import('../../api/client').TrendPeriodResult['swing_pivots']
  longTrendPivots?: import('../../api/client').TrendPeriodResult['swing_pivots']
  highlightedVolumeTimes?: number[]
  visibleFromTs?: number
}

export default function IndicatorChart({ data, realtimePrice, buyPoint, onBuyMarkerClick, scrapedDates, onScrapSave, trendLines, shortTrendPivots, longTrendPivots, highlightedVolumeTimes, visibleFromTs }: Props) {
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
  const [emaCollapsed, setEmaCollapsed] = useState(false)
  const [shortCollapsed, setShortCollapsed] = useState(false)
  const [longCollapsed, setLongCollapsed] = useState(false)
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
    // SQZ Terminal 라이트 테마 — lightweight-charts는 CSS var를 못 읽으므로 hex 근사값 사용
    const chartOpts = {
      width,
      layout: { background: { type: ColorType.Solid as const, color: '#ffffff' }, textColor: '#6b7280' },
      grid: { vertLines: { color: 'rgba(0,0,0,0.04)' }, horzLines: { color: 'rgba(0,0,0,0.06)' } },
      crosshair: { mode: 0 as const },
      rightPriceScale: { borderColor: '#e5e7eb' },
      localization: { locale: 'en-US' },
      timeScale: {
        timeVisible: false,
        secondsVisible: false,
        borderColor: '#e5e7eb',
        tickMarkFormatter,
      },
    }

    // === MAIN CHART ===
    const mainChart = createChart(el, { ...chartOpts, height: 450 })
    mainChartRef.current = mainChart

    // 캔들스틱 — SQZ Terminal 색상 시맨틱: 상승 초록(--up) / 하락 빨강(--down)
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: '#16a34a', downColor: '#dc2626',
      wickUpColor: '#16a34a', wickDownColor: '#dc2626',
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
    addLine('ema_60',  '#a855f7', 1)        // 중기 (보라)
    addLine('ema_120', '#ec4899', 2)        // 장기 (핑크, 2px 강조)
    // EMA 50 제거 — SQZ Terminal 디자인 단순화 (#028 Phase 12)

    // ── EMA 정배열/역배열 말풍선 ───────────────────────────────────────────
    // 호버된 날짜에 ema_5 > ema_20 > ema_60 > ema_120 (또는 전부 <) 일 때만 표시
    // (EMA 50은 SQZ Terminal 단순화로 제외)
    {
      const emaKeys = ['ema_5', 'ema_20', 'ema_60', 'ema_120'] as const
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
        const e60 = emaByTime.ema_60.get(time)
        const e120 = emaByTime.ema_120.get(time)
        if (e5 == null || e20 == null || e60 == null || e120 == null) return null
        if (e5 > e20 && e20 > e60 && e60 > e120) return 'up'
        if (e5 < e20 && e20 < e60 && e60 < e120) return 'down'
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
          const e60 = emaByTime.ema_60.get(param.time)!
          const e120 = emaByTime.ema_120.get(param.time)!
          const label = kind === 'up' ? '📈 정배열' : '📉 역배열'
          const headClass = kind === 'up' ? 'color:#4ade80' : 'color:#f87171'
          bubble.innerHTML =
            `<div style="font-weight:600;${headClass};font-size:11px">${label}</div>` +
            `<div style="font-family:monospace;color:#ffffff;font-size:10px;margin-top:2px;line-height:1.35">` +
            `5:${e5.toFixed(1)} · 20:${e20.toFixed(1)}<br/>` +
            `60:${e60.toFixed(1)} · 120:${e120.toFixed(1)}` +
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
      addHLine(70, 'rgba(220,38,38,0.35)')
      addHLine(30, 'rgba(22,163,74,0.35)')
      addHLine(50, 'rgba(107,114,128,0.2)')
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
        color: p.value >= 0 ? 'rgba(22,163,74,0.7)' : 'rgba(220,38,38,0.7)',
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

    // 실시간 가격 업데이트는 SSE(realtimePrice prop) 경로로 일원화 — 아래 useEffect 참조.
    // WebSocket onPriceUpdate 이중 업데이트 경로 제거(#028 성능 개선).

    const resizeObs = new ResizeObserver(() => { mainChart.applyOptions({ width: el.clientWidth }) })
    resizeObs.observe(el)
    return () => {
      resizeObs.disconnect()
      mainChart.remove()
    }
  }, [data])

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
      const openPrice = realtimePrice.open > 0 ? realtimePrice.open : price
      const newCandle = { time: todayTs as any, open: openPrice, high: Math.max(openPrice, realtimePrice.high > 0 ? realtimePrice.high : price), low: Math.min(openPrice, realtimePrice.low > 0 ? realtimePrice.low : price), close: price }
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

  // 추세선 오버레이 (024)
  useEffect(() => {
    const chart = mainChartRef.current
    if (!chart) return
    const prev: any[] = (chart as any).__trendLineSeries ?? []
    for (const s of prev) { try { chart.removeSeries(s) } catch {} }
    const series: any[] = []
    for (const line of trendLines ?? []) {
      try {
        // 평행선 제외
        if (line.kind?.endsWith('_parallel')) continue
        const colorMap: Record<string, string> = {
          hh_main: '#15803d', hl_main: '#000000',
          lh_main: '#b8860b', ll_main: '#b91c1c',
        }
        const lineColor = colorMap[(line as any).kind] ?? '#000000'
        const s = chart.addSeries(LineSeries, {
          color: lineColor,
          lineWidth: 1.5 as any,
          lineStyle: 0,
          lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
        })
        s.setData([
          { time: line.start.time as any, value: line.start.price },
          { time: line.end.time   as any, value: line.end.price   },
        ])
        series.push(s)
      } catch {}
    }
    ;(chart as any).__trendLineSeries = series
  }, [trendLines])

  // 볼륨 바 하이라이트 (033) — 추세 변곡점 타임스탬프에 노란색 적용
  useEffect(() => {
    const volSeries = volSeriesRef.current
    if (!volSeries || !data.candles?.length) return
    const highlightSet = new Set(highlightedVolumeTimes ?? [])
    volSeries.setData(data.candles.map(c => ({
      time: c.time as any,
      value: c.volume,
      color: highlightSet.has(c.time as number)
        ? 'rgba(251,191,36,0.8)'
        : c.close >= c.open ? 'rgba(255,75,106,0.30)' : 'rgba(66,133,244,0.28)',
    })))
  }, [highlightedVolumeTimes, data.candles])

  // 차트 시간 범위 설정 (033) — 기간 탭 전환 시 가시 범위 변경
  useEffect(() => {
    const chart = mainChartRef.current
    if (!chart || !visibleFromTs) return
    try {
      chart.timeScale().setVisibleRange({
        from: visibleFromTs as any,
        to: Math.floor(Date.now() / 1000) as any,
      })
    } catch {}
  }, [visibleFromTs])

  return (
    <div>
      <div className="relative">
        <div ref={mainRef} className="w-full rounded-t-lg overflow-hidden border border-[var(--border)]" />
        {/* EMA 정배열/역배열 말풍선 — 호버 시에만 나타남 */}
        <div
          ref={alignmentRef}
          className="absolute z-30 px-2 py-1.5 rounded bg-black/85 backdrop-blur-sm border border-[var(--border)] pointer-events-none shadow-lg"
          style={{ display: 'none', minWidth: 120 }}
        />
        {/* 좌상단 범례 그룹 — EMA + 추세선 (탭으로 접기/펼치기) */}
        <div className="absolute top-2 left-2 z-40 flex gap-1.5 items-start" style={{ pointerEvents: 'none' }}>
          {/* EMA 범례 */}
          <div
            className="backdrop-blur-sm rounded"
            style={{
              lineHeight: 1.3,
              background: 'color-mix(in oklch, var(--bg-1), transparent 10%)',
              border: '1px solid var(--border)',
              pointerEvents: 'auto',
              cursor: 'pointer',
              userSelect: 'none',
            }}
            onClick={() => setEmaCollapsed(c => !c)}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: emaCollapsed ? '4px 8px' : '4px 8px 2px' }}>
              <span className="text-[10px]" style={{ color: 'var(--fg-3)' }}>EMA</span>
              <span style={{ fontSize: 8, color: 'var(--fg-4)', lineHeight: 1 }}>{emaCollapsed ? '▶' : '▼'}</span>
            </div>
            {!emaCollapsed && (
              <div style={{ padding: '0 8px 6px' }}>
                {[
                  { label: '5',   color: '#06b6d4', width: 1 },
                  { label: '20',  color: '#3b82f6', width: 1 },
                  { label: '60',  color: '#a855f7', width: 1 },
                  { label: '120', color: '#ec4899', width: 2 },
                ].map((e) => (
                  <div key={e.label} className="flex items-center gap-1.5">
                    <div style={{ width: 18, height: e.width, background: e.color }} />
                    <span className="font-mono text-[11px]" style={{ color: 'var(--fg-1)' }}>{e.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 추세선 범례 — 단기(3m) / 장기(12m) */}
          {(shortTrendPivots || longTrendPivots) && (() => {
            const rowStyle = (color: string, active: boolean) => ({
              color: active ? color : 'var(--fg-4)',
              fontFamily: 'monospace',
              fontSize: 10,
            })
            const fmtPrice = (p: number) =>
              p >= 10000 ? `${Math.round(p).toLocaleString()}` : p.toLocaleString()

            const Section = ({
              label, direction, count, points, lineColor,
            }: {
              label: string
              direction: string
              count: number
              points: Array<{ date: string; price: number }>
              lineColor: string
            }) => {
              const isUp = direction === 'up'
              const isDown = direction === 'down'
              const active = isUp || isDown
              const arrow = isUp ? '↑' : isDown ? '↓' : '—'
              const dirLabel = isUp ? '높아짐' : isDown ? '낮아짐' : '—'
              return (
                <div style={{ marginBottom: 5 }}>
                  <div className="flex items-center gap-1" style={{ marginBottom: 2 }}>
                    <div style={{ width: 14, height: 1.5, background: active ? lineColor : 'var(--fg-4)', flexShrink: 0 }} />
                    <span style={rowStyle(lineColor, active)}>
                      {label} {count}개
                    </span>
                  </div>
                  <div style={{ paddingLeft: 6 }}>
                    <div style={{ ...rowStyle(lineColor, active), marginBottom: 1 }}>
                      {arrow} {label} {dirLabel}
                    </div>
                    {points.map((pt, i) => (
                      <div key={i} style={{ ...rowStyle('var(--fg-1)', active), paddingLeft: 8, lineHeight: 1.6 }}>
                        {pt.date}  {fmtPrice(pt.price)}
                      </div>
                    ))}
                  </div>
                </div>
              )
            }

            const TrendBox = ({
              title, pivots, useOverall, collapsed, onToggle,
            }: {
              title: string
              pivots: typeof shortTrendPivots
              useOverall?: boolean
              collapsed: boolean
              onToggle: () => void
            }) => {
              if (!pivots) return null
              const { high, low } = pivots
              const hDir = useOverall ? high.overall_direction : high.direction
              const lDir = useOverall ? low.overall_direction : low.direction
              const hPts = useOverall ? high.overall_points : high.points
              const lPts = useOverall ? low.overall_points : low.points
              return (
                <div
                  className="backdrop-blur-sm rounded"
                  style={{
                    lineHeight: 1.4,
                    background: 'color-mix(in oklch, var(--bg-1), transparent 10%)',
                    border: '1px solid var(--border)',
                    minWidth: collapsed ? 0 : 140,
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={onToggle}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: collapsed ? '4px 8px' : '4px 8px 2px' }}>
                    <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>{title}</span>
                    <span style={{ fontSize: 8, color: 'var(--fg-4)', lineHeight: 1 }}>{collapsed ? '▶' : '▼'}</span>
                  </div>
                  {!collapsed && (
                    <div style={{ padding: '0 8px 6px' }}>
                      <Section
                        label="고점" direction={hDir}
                        count={high.count} points={hPts}
                        lineColor={hDir === 'up' ? '#15803d' : '#b8860b'}
                      />
                      <Section
                        label="저점" direction={lDir}
                        count={low.count} points={lPts}
                        lineColor={lDir === 'up' ? '#000000' : '#b91c1c'}
                      />
                    </div>
                  )}
                </div>
              )
            }

            return (
              <>
                <TrendBox
                  title="단기 추세선" pivots={shortTrendPivots} useOverall={false}
                  collapsed={shortCollapsed} onToggle={() => setShortCollapsed(c => !c)}
                />
                <TrendBox
                  title="장기 추세선" pivots={longTrendPivots} useOverall={true}
                  collapsed={longCollapsed} onToggle={() => setLongCollapsed(c => !c)}
                />
              </>
            )
          })()}
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
            className="rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg whitespace-nowrap transition-colors"
            style={{ background: 'var(--up-bg)', border: '1px solid var(--up)', color: 'var(--up)' }}
          >
            이 BUY 사례 저장
          </button>
          <div
            data-scrap-saved
            style={{ display: 'none', background: 'var(--warn-bg)', border: '1px solid var(--warn)', color: 'var(--warn)' }}
            className="rounded-lg px-3 py-1.5 text-xs font-medium shadow-lg whitespace-nowrap"
          >
            저장됨 ✓
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 px-3 py-1 border-x border-b border-[var(--border)]" style={{ background: 'var(--bg-2)' }}>
        <span className="text-caption" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>RSI (14)</span>
      </div>
      <div ref={rsiRef} className="w-full overflow-hidden border-x border-[var(--border)]" />
      <div className="flex items-center gap-2 px-3 py-1 border-x border-b border-[var(--border)]" style={{ background: 'var(--bg-2)' }}>
        <span className="text-caption" style={{ color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>MACD (12,26,9)</span>
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
