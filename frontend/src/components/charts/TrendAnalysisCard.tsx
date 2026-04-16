import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  ColorType,
  createChart,
  LineSeries,
} from 'lightweight-charts'
import type { TrendType, TradingSignal, TrendLine, TrendAnalysisResponse } from '../../api/client'
import { useTrendAnalysis } from '../../hooks/useTrendAnalysis'
import { useTrendOverlayStore } from '../../stores/trendOverlayStore'
import type { ChartData } from '../../types'

interface Props {
  symbol: string
  market: string
  chartData?: ChartData
  onLinesChange?: (lines: TrendLine[]) => void
}

const TREND_LABEL: Record<TrendType, { icon: string; label: string; color: string; bg: string }> = {
  uptrend:   { icon: '📈', label: '상승추세', color: 'text-[var(--buy)]', bg: 'bg-green-500/10' },
  downtrend: { icon: '📉', label: '하락추세', color: 'text-[var(--sell)]', bg: 'bg-red-500/10' },
  sideways:  { icon: '↔',  label: '평행(보합)', color: 'text-blue-400', bg: 'bg-blue-500/10' },
  triangle:  { icon: '▶',  label: '삼각수렴', color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
  unknown:   { icon: '❓', label: '분류 불가', color: 'text-[var(--muted)]', bg: '' },
  insufficient_data: { icon: '📊', label: '데이터 부족', color: 'text-[var(--muted)]', bg: '' },
}

/** 현재가와 시그널 가격 관계에 따라 조건 문구를 동적 조정.
 *  distance_pct > 0  = 시그널이 현재가보다 위 (아직 도달 전)
 *  distance_pct < 0  = 시그널이 현재가보다 아래 (이미 통과)
 */
function adjustCondition(s: TradingSignal): { text: string; passedSuffix: string | null } {
  const d = s.distance_pct
  if (d == null) return { text: s.condition, passedSuffix: null }

  // "저항선 돌파 시 추가 매수"류 — 저항을 이미 넘었으면 돌파 완료
  if (s.kind === 'buy_candidate' && s.condition.includes('돌파 시') && d < -0.5) {
    return {
      text: '저항선 돌파 완료 — 재테스트(되돌림) 시 재진입 검토',
      passedSuffix: '✅ 돌파 확정',
    }
  }
  // "저항선 반락 시 1차 매도" — 저항 위면 반락 미발생
  if (s.kind === 'sell_candidate_1' && s.condition.includes('저항선 반락') && d < -0.5) {
    return {
      text: '저항선 돌파 유지 — 반락 매도 신호 미도래',
      passedSuffix: '↗ 유지 중',
    }
  }
  // "지지선 근처 반등 매수" — 이미 지지선 아래면 이탈
  if (s.kind === 'buy_candidate' && s.condition.includes('지지선 근처') && d > 0.5) {
    return {
      text: '지지선 이탈 — 추세 붕괴 관찰 필요, 신규 매수 보류',
      passedSuffix: '⚠ 이탈',
    }
  }
  // "지지선 하향 이탈 시 강한 매도" — 이미 이탈했으면 신호 발생
  if (s.kind === 'sell_candidate_2' && s.condition.includes('지지선 하향 이탈') && d > 0.5) {
    return {
      text: '지지선 이미 이탈 — 강한 매도 시점 도래',
      passedSuffix: '🔴 발생',
    }
  }
  // "박스 상단 돌파 시 매수" — 이미 위
  if (s.kind === 'buy_candidate' && s.condition.includes('박스 상단 돌파') && d < -0.5) {
    return {
      text: '박스 상단 돌파 완료 — 재테스트 시 재진입',
      passedSuffix: '✅ 돌파',
    }
  }
  // "박스 하단 이탈 시 강한 매도" — 이미 아래
  if (s.kind === 'sell_candidate_2' && s.condition.includes('박스 하단 이탈') && d > 0.5) {
    return {
      text: '박스 하단 이미 이탈 — 강한 매도 시점 도래',
      passedSuffix: '🔴 발생',
    }
  }
  return { text: s.condition, passedSuffix: null }
}

function SignalRow({ s, type, isNearest }: { s: TradingSignal; type: 'buy' | 'sell'; isNearest: boolean }) {
  const icon = s.kind === 'watch' ? '🟡' : type === 'buy' ? '📍' : '⚠️'
  const color = s.kind === 'watch' ? 'text-yellow-400' : type === 'buy' ? 'text-[var(--buy)]' : 'text-[var(--sell)]'
  const bg = isNearest
    ? (type === 'buy' ? 'bg-green-500/20 border border-green-500/60' : 'bg-red-500/20 border border-red-500/60')
    : s.is_near ? (type === 'buy' ? 'bg-green-500/10' : 'bg-red-500/10') : ''
  const { text: conditionText, passedSuffix } = adjustCondition(s)
  return (
    <div className={`flex items-start gap-2 py-1.5 px-2 rounded ${bg}`}>
      <span className="text-sm shrink-0">{isNearest ? '⭐' : icon}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-xs font-medium ${color}`}>
          {conditionText}
          {passedSuffix && <span className="ml-1.5 text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">{passedSuffix}</span>}
          {isNearest && !passedSuffix && <span className="ml-1.5 text-[9px] bg-white/10 px-1.5 py-0.5 rounded text-white font-bold">가장 가까움</span>}
        </div>
        {s.price != null && (
          <div className="text-[10px] text-[var(--muted)] font-mono mt-0.5">
            기준가 {s.price.toLocaleString()}
            {s.distance_pct != null && (
              <span className={`ml-1 ${Math.abs(s.distance_pct) <= 2 ? 'text-yellow-400 font-bold' : ''}`}>
                (현재가 대비 {s.distance_pct > 0 ? '+' : ''}{s.distance_pct}%)
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function TrendMiniChart({ chartData, trendData }: { chartData: ChartData; trendData: TrendAnalysisResponse }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el || !chartData?.candles?.length) return

    const width = el.clientWidth || 400
    const chart = createChart(el, {
      width,
      height: 200,
      layout: { background: { type: ColorType.Solid, color: '#000000' }, textColor: '#64748b' },
      grid: { vertLines: { color: '#1e293b' }, horzLines: { color: '#1e293b' } },
      rightPriceScale: { borderColor: '#334155', scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: '#334155', timeVisible: false },
      crosshair: { mode: 0 },
    })

    // 최근 120봉만 표시
    const n = Math.min(chartData.candles.length, 120)
    const candles = chartData.candles.slice(-n)

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#ff4b6a', downColor: '#4285f4',
      wickUpColor: '#ff4b6a', wickDownColor: '#4285f4',
      borderVisible: false,
    })
    candleSeries.setData(candles.map((c: any) => ({
      time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
    })))

    // 추세선 오버레이
    for (const line of trendData.lines) {
      try {
        const s = chart.addSeries(LineSeries, {
          color: line.style.color,
          lineWidth: 2 as any,
          lineStyle: line.style.dashed ? 2 : 0,
          lastValueVisible: false,
          priceLineVisible: false,
          crosshairMarkerVisible: false,
        })
        s.setData([
          { time: line.start.time as any, value: line.start.price },
          { time: line.end.time as any, value: line.end.price },
        ])
      } catch {}
    }

    // 현재가 기준선 — 가장 두껍고 눈에 띄게
    const currentPrice = trendData.current_price
    if (currentPrice != null) {
      try {
        candleSeries.createPriceLine({
          price: currentPrice,
          color: '#ffffff',
          lineWidth: 2 as any,
          lineStyle: 0, // Solid
          axisLabelVisible: true,
          title: '💰 현재가',
        })
      } catch {}
    }

    // 매수·매도 후보 — createPriceLine으로 정확한 가격축 레이블 + 제목 표기
    // 가장 가까운 시그널은 굵게(3px), 나머지는 2px
    const SIGNAL_STYLE: Record<string, { color: string; title: string }> = {
      buy_candidate:    { color: '#22c55e', title: '📍 매수' },
      watch:            { color: '#eab308', title: '🟡 관망' },
      sell_candidate_1: { color: '#f97316', title: '⚠️ 1차 매도' },
      sell_candidate_2: { color: '#ef4444', title: '🔴 강한 매도' },
    }
    const allSignals = [...trendData.buy_signals, ...trendData.sell_signals]
    // 가장 가까운 시그널의 price 식별
    let nearestPrice: number | null = null
    let minDist = Infinity
    for (const sig of allSignals) {
      if (sig.price == null || sig.distance_pct == null) continue
      const d = Math.abs(sig.distance_pct)
      if (d < minDist) { minDist = d; nearestPrice = sig.price }
    }
    for (const sig of allSignals) {
      if (sig.price == null) continue
      const style = SIGNAL_STYLE[sig.kind] || SIGNAL_STYLE.watch
      const isNearest = sig.price === nearestPrice
      try {
        candleSeries.createPriceLine({
          price: sig.price,
          color: style.color,
          lineWidth: (isNearest ? 3 : 1) as any,
          lineStyle: isNearest ? 0 : 2, // 가장 가까운 건 실선, 나머지는 Dashed
          axisLabelVisible: true,
          title: isNearest ? `★ ${style.title}` : style.title,
        })
      } catch {}
    }

    chart.timeScale().fitContent()

    const onResize = () => { if (el) chart.applyOptions({ width: el.clientWidth }) }
    window.addEventListener('resize', onResize)
    return () => { window.removeEventListener('resize', onResize); chart.remove() }
  }, [chartData, trendData])

  return (
    <div ref={containerRef} className="w-full rounded-lg overflow-hidden border border-[var(--border)]" />
  )
}

export default function TrendAnalysisCard({ symbol, market, chartData, onLinesChange }: Props) {
  const { data, isLoading, isError } = useTrendAnalysis(symbol, market)
  const showLines = useTrendOverlayStore((s) => s.showLines)
  const toggle = useTrendOverlayStore((s) => s.toggle)

  const lines = data?.lines ?? []
  if (onLinesChange) {
    setTimeout(() => onLinesChange(showLines ? lines : []), 0)
  }

  if (isLoading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 mt-3 animate-pulse">
        <div className="h-4 bg-[var(--border)] rounded w-32 mb-3" />
        <div className="h-[200px] bg-[var(--border)] rounded" />
      </div>
    )
  }

  if (isError || !data) return null

  const cls = data.classification
  const trendMeta = TREND_LABEL[cls.type] || TREND_LABEL.unknown
  const noSignals = cls.type === 'unknown' || cls.type === 'insufficient_data'

  // 분기점 감지 — 같은 가격대(±0.5%)에 매수·매도 시그널이 동시에 존재하면 "돌파 vs 반락" 분기
  const decisionPoints: number[] = []
  for (const b of data.buy_signals) {
    if (b.price == null) continue
    for (const s of data.sell_signals) {
      if (s.price == null) continue
      const diff = Math.abs(b.price - s.price) / b.price
      if (diff < 0.005 && !decisionPoints.includes(b.price)) {
        decisionPoints.push(b.price)
      }
    }
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 mt-3">
      {/* 헤더: 추세 라벨 + 토글 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`${trendMeta.bg} rounded-lg px-2.5 py-1 flex items-center gap-1.5`}>
            <span className="text-base">{trendMeta.icon}</span>
            <span className={`text-sm font-bold ${trendMeta.color}`}>{trendMeta.label}</span>
          </div>
          {cls.confidence != null && cls.confidence > 0 && (
            <span className="text-[10px] text-[var(--muted)]">신뢰도 {Math.round(cls.confidence * 100)}%</span>
          )}
        </div>
        {!noSignals && lines.length > 0 && (
          <button
            onClick={toggle}
            className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
              showLines
                ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                : 'bg-[var(--bg)] border-[var(--border)] text-[var(--muted)]'
            }`}
          >
            메인 차트 추세선 {showLines ? 'ON' : 'OFF'}
          </button>
        )}
      </div>

      {/* 포지션 상태 배지 — 현재가가 모든 시그널보다 위/아래인 경우 */}
      {!noSignals && data.current_price != null && (() => {
        const all = [...data.buy_signals, ...data.sell_signals].filter(s => s.price != null && s.distance_pct != null)
        if (all.length === 0) return null
        const allDist = all.map(s => s.distance_pct!)
        const minDist = Math.min(...allDist)  // 가장 위쪽 시그널 (현재가 대비 +)
        const maxDist = Math.max(...allDist)  // 가장 아래 시그널 (현재가 대비 -)
        // 모든 시그널이 현재가보다 아래(음수) + 가장 가까운 시그널도 -3% 이하 → 돌파 후 상승
        if (maxDist < -3) {
          return (
            <div className="mb-3 px-3 py-2 rounded bg-emerald-500/15 border border-emerald-500/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">🚀</span>
                <span className="text-xs font-bold text-emerald-400">저항선 돌파 후 상승 중</span>
              </div>
              <div className="text-[10px] text-[var(--muted)] leading-relaxed">
                현재가가 감지된 모든 저항·매매 구간 위에 있습니다. 신규 매수는 <b>저항선 재테스트(되돌림)</b> 대기를 권장합니다.
                보유자는 저항선 아래로 이탈 시 <b>1차 매도</b> 시점 도래.
              </div>
            </div>
          )
        }
        // 모든 시그널이 현재가보다 위(양수) + 가장 가까운 것도 +3% 이상 → 지지선 이탈
        if (minDist > 3) {
          return (
            <div className="mb-3 px-3 py-2 rounded bg-rose-500/15 border border-rose-500/40">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">⚠️</span>
                <span className="text-xs font-bold text-rose-400">지지선 이탈 — 추세 전환 가능성</span>
              </div>
              <div className="text-[10px] text-[var(--muted)] leading-relaxed">
                현재가가 감지된 모든 지지·매매 구간 아래에 있습니다. <b>추세가 하향으로 전환</b>되고 있을 가능성이 있으니
                신규 매수는 <b>지지선 재구축 확인</b> 후 검토하세요.
              </div>
            </div>
          )
        }
        return null
      })()}

      {/* 분기점 안내 — 매수·매도 시그널 가격이 겹칠 때 */}
      {decisionPoints.length > 0 && (
        <div className="mb-3 px-3 py-2 rounded bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm">🔀</span>
            <span className="text-xs font-bold text-amber-400">분기점 구간 — 돌파/반락 관찰 필요</span>
          </div>
          <div className="text-[10px] text-[var(--muted)] leading-relaxed">
            {decisionPoints.map(p => p.toLocaleString()).join(', ')}원은 <b className="text-white">매수·매도 분기점</b>입니다.
            <br />
            · <b className="text-[var(--buy)]">장대양봉 + 거래량↑로 돌파</b> → 추가 매수 진입
            <br />
            · <b className="text-[var(--sell)]">음봉 + 저항 받고 반락</b> → 1차 매도 익절
            <br />
            같은 가격에서 <b>봉 모양과 거래량</b>이 방향을 결정합니다.
          </div>
        </div>
      )}

      {/* 안내 문구 */}
      {cls.type === 'insufficient_data' && (
        <div className="text-xs text-[var(--muted)] py-4 text-center">분석을 위한 데이터가 부족합니다 (120봉 미만)</div>
      )}
      {cls.type === 'unknown' && (
        <div className="text-xs text-[var(--muted)] py-4 text-center">명확한 추세 없음 — 매매 시점을 표시하지 않습니다</div>
      )}

      {/* 미니 차트 — 추세선 + 매수·매도 수평선 시각화 */}
      {!noSignals && chartData && (
        <div className="mb-3">
          <TrendMiniChart chartData={chartData} trendData={data} />
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 px-1">
            <div className="flex items-center gap-1 text-[9px] text-[var(--muted)]">
              <div className="w-3 h-[2px] rounded" style={{ background: '#22c55e' }} /> 매수 적합
            </div>
            <div className="flex items-center gap-1 text-[9px] text-[var(--muted)]">
              <div className="w-3 h-[2px] rounded" style={{ background: '#f97316' }} /> 1차 매도
            </div>
            <div className="flex items-center gap-1 text-[9px] text-[var(--muted)]">
              <div className="w-3 h-[2px] rounded" style={{ background: '#ef4444' }} /> 강한 매도
            </div>
            {data.lines.length > 0 && (
              <div className="flex items-center gap-1 text-[9px] text-[var(--muted)]">
                <div className="w-3 h-[2px] rounded" style={{ background: data.lines[0].style.color, opacity: 0.7 }} /> 추세선
              </div>
            )}
          </div>
        </div>
      )}

      {/* 현재가 요약 — 가장 가까운 시그널까지 거리 강조 */}
      {!noSignals && data.current_price != null && (() => {
        const all = [...data.buy_signals, ...data.sell_signals].filter(s => s.price != null && s.distance_pct != null)
        if (all.length === 0) return null
        const nearest = all.reduce((a, b) => Math.abs(a.distance_pct!) < Math.abs(b.distance_pct!) ? a : b)
        const isBuy = nearest.kind === 'buy_candidate'
        const dirColor = isBuy ? 'text-[var(--buy)]' : 'text-[var(--sell)]'
        const dirBg = isBuy ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'
        return (
          <div className={`mb-3 px-3 py-2 rounded border ${dirBg}`}>
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[var(--muted)]">현재가</span>
                <span className="text-sm font-mono font-bold text-white">
                  {data.current_price.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[var(--muted)]">가장 가까운 구간</span>
                <span className={`text-xs font-bold ${dirColor}`}>
                  {isBuy ? '📍' : '⚠️'} {nearest.price?.toLocaleString()}
                </span>
                <span className={`text-[10px] font-mono font-bold ${Math.abs(nearest.distance_pct!) <= 2 ? 'text-yellow-400' : 'text-[var(--muted)]'}`}>
                  ({nearest.distance_pct! > 0 ? '+' : ''}{nearest.distance_pct}%)
                </span>
              </div>
            </div>
          </div>
        )
      })()}

      {/* 매수·매도 시그널 텍스트 — 차트 아래 compact하게 (가장 가까운 시그널 ★ 강조) */}
      {!noSignals && (data.buy_signals.length > 0 || data.sell_signals.length > 0) && (() => {
        const all = [...data.buy_signals, ...data.sell_signals].filter(s => s.price != null && s.distance_pct != null)
        const nearestPrice = all.length > 0
          ? all.reduce((a, b) => Math.abs(a.distance_pct!) < Math.abs(b.distance_pct!) ? a : b).price
          : null
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {data.buy_signals.length > 0 && (
              <div>
                <div className="text-[10px] text-[var(--muted)] mb-1 font-medium">매수 후보 구간</div>
                {data.buy_signals
                  .slice()
                  .sort((a, b) => Math.abs(a.distance_pct ?? 999) - Math.abs(b.distance_pct ?? 999))
                  .map((s, i) => <SignalRow key={i} s={s} type="buy" isNearest={s.price === nearestPrice} />)}
              </div>
            )}
            {data.sell_signals.length > 0 && (
              <div>
                <div className="text-[10px] text-[var(--muted)] mb-1 font-medium">매도 후보 구간</div>
                {data.sell_signals
                  .slice()
                  .sort((a, b) => Math.abs(a.distance_pct ?? 999) - Math.abs(b.distance_pct ?? 999))
                  .map((s, i) => <SignalRow key={i} s={s} type="sell" isNearest={s.price === nearestPrice} />)}
              </div>
            )}
          </div>
        )
      })()}

      {/* 면책 */}
      <div className="text-[9px] text-[var(--muted)] opacity-50 mt-3 border-t border-[var(--border)] pt-2">
        {data.disclaimer}
      </div>
    </div>
  )
}
