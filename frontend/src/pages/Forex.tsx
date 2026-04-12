import { useQuery } from '@tanstack/react-query'
import { ColorType, createChart, LineSeries } from 'lightweight-charts'
import { DollarSign } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import api from '../api/client'

const fetchForex = (period: string) => api.get(`/forex/analysis?period=${period}`).then(r => r.data)
const fetchForexChart = () => api.get('/forex/chart').then(r => r.data)

interface Gauge { label: string; current: number; lower: number; center: number; upper: number; gap_lower_pct: number; gap_center_pct: number; gap_upper_pct: number; is_buy: boolean }

export default function Forex() {
  const [tab, setTab] = useState<'analysis' | 'chart'>('analysis')

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <DollarSign className="text-green-400" size={22} /> 환율전망
        </h1>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-6 bg-[var(--card)] rounded-lg p-1 w-fit border border-[var(--border)]">
        {[
          { key: 'analysis' as const, label: '적정환율' },
          { key: 'chart' as const, label: '환율추이' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-1.5 rounded-md text-sm ${tab === t.key ? 'bg-blue-600 text-white' : 'text-[var(--muted)] hover:text-white'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'analysis' && <AnalysisTab />}
      {tab === 'chart' && <ChartTab />}
    </div>
  )
}

/* ========== 적정환율 탭 ========== */
function AnalysisTab() {
  const [period, setPeriod] = useState('3M')
  const { data, isLoading } = useQuery({ queryKey: ['forex', period], queryFn: () => fetchForex(period) })

  if (isLoading) return <div className="text-[var(--muted)]">분석 중...</div>
  if (!data) return <div className="text-[var(--muted)]">데이터 없음</div>

  const vc = data.verdict === 'BUY' ? 'text-green-400' : data.verdict === 'SELL' ? 'text-red-400' : 'text-yellow-400'
  const vl = data.verdict === 'BUY' ? '달러 매수 적합' : data.verdict === 'SELL' ? '달러 매수 부적합' : '관망'

  return (
    <>
      {/* 기간 선택 */}
      <div className="flex gap-1 mb-4 bg-[var(--card)] rounded-lg p-1 w-fit border border-[var(--border)]">
        {['1M', '3M', '6M', '1Y'].map(p => (
          <button key={p} onClick={() => setPeriod(p)}
            className={`px-3 py-1 rounded-md text-xs ${period === p ? 'bg-blue-600 text-white' : 'text-[var(--muted)]'}`}>
            {p === '1M' ? '1개월' : p === '3M' ? '3개월' : p === '6M' ? '6개월' : '1년'}
          </button>
        ))}
      </div>

      {/* 요약 */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Box label="달러 지수" value={data.dxy.toFixed(2)} />
        <Box label="52주 달러 갭" value={`${data.dollar_gap_52w.toFixed(2)}%`} />
        <Box label="적정 환율" value={data.fair_value.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
      </div>

      {/* 매수 적정가 */}
      <div className="bg-blue-600/15 border border-blue-500/30 rounded-lg p-3 mb-4 text-center">
        <div className="text-xs text-blue-300 mb-0.5">다음 매수 적정가</div>
        <div className="text-xl font-bold text-white">{data.next_buy_price.toLocaleString(undefined, { maximumFractionDigits: 0 })}원</div>
        <div className="text-caption text-[var(--muted)]">
          현재 {data.usdkrw.toLocaleString(undefined, { maximumFractionDigits: 0 })}원 대비{' '}
          <span className="text-green-400">{((data.usdkrw - data.next_buy_price) / data.usdkrw * 100).toFixed(1)}% 하락 시</span>
        </div>
      </div>

      {/* 판정 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-white">달러 투자 적합성</span>
        <span className={`text-sm font-bold ${vc}`}>{vl} ({data.verdict_score}/4)</span>
      </div>

      {/* 게이지 */}
      <div className="space-y-4">
        <GaugeBar gauge={data.gauge_krw} unit="원" />
        <GaugeBar gauge={data.gauge_dxy} unit="" />
        <GaugeBar gauge={data.gauge_gap} unit="%" isGap />
        <GaugeBar gauge={data.gauge_fair} unit="원" />
      </div>
    </>
  )
}

/* ========== 환율추이 탭 ========== */
function ChartTab() {
  const [chartPeriod, setChartPeriod] = useState('3M')
  const { data, isLoading } = useQuery({ queryKey: ['forexChart'], queryFn: fetchForexChart })
  const krwRef = useRef<HTMLDivElement>(null)
  const dxyRef = useRef<HTMLDivElement>(null)
  const comboRef = useRef<HTMLDivElement>(null)

  const periodDays: Record<string, number> = { '1M': 22, '3M': 66, '6M': 132, '1Y': 252 }

  // 통계 계산 함수
  const calcStats = (pts: any[]) => {
    if (!pts.length) return { current: 0, change: 0, changePct: 0, high: 0, low: 0, avg: 0 }
    const values = pts.map((p: any) => p.value)
    const current = values[values.length - 1]
    const first = values[0]
    return {
      current,
      change: current - first,
      changePct: ((current - first) / first) * 100,
      high: Math.max(...values),
      low: Math.min(...values),
      avg: values.reduce((a: number, b: number) => a + b, 0) / values.length,
    }
  }

  // 상관계수 계산
  const calcCorrelation = (a: any[], b: any[]) => {
    if (a.length < 5 || b.length < 5) return 0
    // 공통 시간으로 매칭
    const bMap = new Map(b.map((p: any) => [p.time, p.value]))
    const pairs = a.filter((p: any) => bMap.has(p.time)).map((p: any) => [p.value, bMap.get(p.time)!])
    if (pairs.length < 5) return 0
    const n = pairs.length
    const avgA = pairs.reduce((s, p) => s + p[0], 0) / n
    const avgB = pairs.reduce((s, p) => s + p[1], 0) / n
    let cov = 0, varA = 0, varB = 0
    for (const [va, vb] of pairs) {
      cov += (va - avgA) * (vb - avgB)
      varA += (va - avgA) ** 2
      varB += (vb - avgB) ** 2
    }
    return varA && varB ? cov / Math.sqrt(varA * varB) : 0
  }

  useEffect(() => {
    if (!data) return

    const opts = {
      layout: { background: { type: ColorType.Solid as const, color: '#000000' }, textColor: '#8e8e93' },
      grid: { vertLines: { color: '#2c2c2e' }, horzLines: { color: 'rgba(44,44,46,0.5)' } },
      crosshair: { mode: 0 as const },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2c2c2e' },
      rightPriceScale: { borderColor: '#2c2c2e' },
    }

    const days = periodDays[chartPeriod] || 66
    const filterPts = (pts: any[]) => pts.slice(-days)

    // 1. USDKRW + 적정환율 밴드
    if (krwRef.current && data.krw?.length) {
      krwRef.current.innerHTML = ''
      const c = createChart(krwRef.current, { ...opts, width: krwRef.current.clientWidth, height: 280 })

      // 상한/하한 밴드 (반투명 영역)
      if (data.upper_line?.length) {
        const upper = c.addSeries(LineSeries, { color: 'rgba(239, 68, 68, 0.15)', lineWidth: 1 as any, lineStyle: 2 })
        upper.setData(filterPts(data.upper_line))
      }
      if (data.lower_line?.length) {
        const lower = c.addSeries(LineSeries, { color: 'rgba(34, 197, 94, 0.15)', lineWidth: 1 as any, lineStyle: 2 })
        lower.setData(filterPts(data.lower_line))
      }

      // 적정환율 라인
      if (data.fair_line?.length) {
        const f = c.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1 as any, lineStyle: 0 })
        f.setData(filterPts(data.fair_line))
      }

      // USDKRW 메인 라인
      const s = c.addSeries(LineSeries, { color: '#ef4444', lineWidth: 2 as any })
      s.setData(filterPts(data.krw))

      c.timeScale().fitContent()
    }

    // 2. DXY 라인 차트 + 이동평균
    if (dxyRef.current && data.dxy?.length) {
      dxyRef.current.innerHTML = ''
      const c = createChart(dxyRef.current, { ...opts, width: dxyRef.current.clientWidth, height: 220 })

      const pts = filterPts(data.dxy)
      // 20일 이동평균
      if (pts.length >= 20) {
        const ma20: any[] = []
        for (let i = 19; i < pts.length; i++) {
          const slice = pts.slice(i - 19, i + 1)
          const avg = slice.reduce((a: number, p: any) => a + p.value, 0) / 20
          ma20.push({ time: pts[i].time, value: avg })
        }
        const ma20Line = c.addSeries(LineSeries, { color: '#f59e0b', lineWidth: 1 as any, lineStyle: 0 })
        ma20Line.setData(ma20)
      }

      // 평균 수평선
      const avg = pts.reduce((a: number, p: any) => a + p.value, 0) / pts.length
      if (pts.length >= 2) {
        const avgLine = c.addSeries(LineSeries, { color: '#22c55e', lineWidth: 1 as any, lineStyle: 2 })
        avgLine.setData([{ time: pts[0].time, value: avg }, { time: pts[pts.length - 1].time, value: avg }])
      }

      // DXY 메인 라인
      const s = c.addSeries(LineSeries, { color: '#94a3b8', lineWidth: 2 as any })
      s.setData(pts)

      c.timeScale().fitContent()
    }

    // 3. 복합 차트 (USDKRW + DXY 이중 축)
    if (comboRef.current && data.krw?.length && data.dxy?.length) {
      comboRef.current.innerHTML = ''
      const c = createChart(comboRef.current, { ...opts, width: comboRef.current.clientWidth, height: 280 })

      const krwS = c.addSeries(LineSeries, { color: '#ef4444', lineWidth: 2 as any, priceScaleId: 'left' })
      krwS.setData(filterPts(data.krw))
      c.priceScale('left').applyOptions({ borderColor: '#ef4444' })

      const dxyS = c.addSeries(LineSeries, { color: '#3b82f6', lineWidth: 2 as any, priceScaleId: 'right' })
      dxyS.setData(filterPts(data.dxy))
      c.priceScale('right').applyOptions({ borderColor: '#3b82f6' })

      c.timeScale().fitContent()
    }
  }, [data, chartPeriod])

  if (isLoading) return <div className="text-[var(--muted)]">차트 로딩 중...</div>
  if (!data) return <div className="text-[var(--muted)]">데이터 없음</div>

  const days = periodDays[chartPeriod] || 66
  const krwPts = data.krw?.slice(-days) || []
  const dxyPts = data.dxy?.slice(-days) || []
  const krwStats = calcStats(krwPts)
  const dxyStats = calcStats(dxyPts)
  const corr = calcCorrelation(krwPts, dxyPts)

  // 추세 판정: 20일 MA 기울기 + 현재가 vs MA 비교
  const detectTrend = (pts: any[]) => {
    if (pts.length < 20) return { label: '데이터 부족', color: 'text-[var(--muted)]', bg: 'bg-slate-500/10', arrow: '' }
    const values = pts.map((p: any) => p.value)
    const last20 = values.slice(-20)
    const ma20 = last20.reduce((a: number, b: number) => a + b, 0) / 20
    const last5ma = values.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5
    const prev5ma = values.slice(-10, -5).reduce((a: number, b: number) => a + b, 0) / 5
    const current = values[values.length - 1]
    const slope = last5ma - prev5ma

    if (current > ma20 && slope > 0) return { label: '상승 추세', color: 'text-red-400', bg: 'bg-red-500/15', arrow: '↑' }
    if (current < ma20 && slope < 0) return { label: '하락 추세', color: 'text-green-400', bg: 'bg-green-500/15', arrow: '↓' }
    return { label: '횡보', color: 'text-yellow-400', bg: 'bg-yellow-500/15', arrow: '→' }
  }

  const krwTrend = detectTrend(krwPts)
  const dxyTrend = detectTrend(dxyPts)

  return (
    <>
      {/* 추세 표시 */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`${krwTrend.bg} border border-[var(--border)] rounded-lg p-3 flex items-center justify-between`}>
          <div>
            <div className="text-caption text-[var(--muted)] mb-0.5">원달러 환율 추세</div>
            <div className={`text-sm font-bold ${krwTrend.color}`}>{krwTrend.arrow} {krwTrend.label}</div>
          </div>
          <div className="text-right">
            <div className="text-white font-mono text-lg">{krwStats.current.toFixed(0)}<span className="text-xs text-[var(--muted)]">원</span></div>
            <div className={`text-caption font-mono ${krwStats.changePct >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {krwStats.changePct >= 0 ? '+' : ''}{krwStats.changePct.toFixed(2)}%
            </div>
          </div>
        </div>
        <div className={`${dxyTrend.bg} border border-[var(--border)] rounded-lg p-3 flex items-center justify-between`}>
          <div>
            <div className="text-caption text-[var(--muted)] mb-0.5">달러 인덱스 추세</div>
            <div className={`text-sm font-bold ${dxyTrend.color}`}>{dxyTrend.arrow} {dxyTrend.label}</div>
          </div>
          <div className="text-right">
            <div className="text-white font-mono text-lg">{dxyStats.current.toFixed(2)}</div>
            <div className={`text-caption font-mono ${dxyStats.changePct >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {dxyStats.changePct >= 0 ? '+' : ''}{dxyStats.changePct.toFixed(2)}%
            </div>
          </div>
        </div>
      </div>

      {/* 현재 상태 설명 */}
      <div className="text-xs text-[var(--muted)] bg-[var(--card)] border border-[var(--border)] rounded-lg px-4 py-2.5 mb-4">
        {(() => {
          const krwUp = krwTrend.label === '상승 추세'
          const dxyUp = dxyTrend.label === '상승 추세'
          if (krwUp && dxyUp) return '원달러 환율과 달러지수 모두 상승 중입니다. 달러 강세 구간으로 원화 가치가 하락하고 있어 달러 매수에 불리한 시점입니다.'
          if (krwUp && !dxyUp) return '달러지수는 약세이나 원달러 환율이 상승 중입니다. 원화 자체 약세가 진행되고 있으며, 환율 상단 부근에서의 추가 매수는 신중해야 합니다.'
          if (!krwUp && dxyUp) return '달러지수는 강세이나 원달러 환율이 하락 또는 횡보 중입니다. 원화 강세 흐름으로 달러 매수에 유리한 구간일 수 있습니다.'
          if (!krwUp && !dxyUp) return '원달러 환율과 달러지수 모두 하락 또는 횡보 중입니다. 달러 약세 구간으로 환율 하단에서 분할 매수를 고려해볼 수 있습니다.'
          return ''
        })()}
      </div>

      {/* 기간 버튼 */}
      <div className="flex gap-1 mb-4 bg-[var(--card)] rounded-lg p-1 w-fit border border-[var(--border)]">
        {['1M', '3M', '6M', '1Y'].map(p => (
          <button key={p} onClick={() => setChartPeriod(p)}
            className={`px-3 py-1 rounded-md text-xs ${chartPeriod === p ? 'bg-red-600 text-white' : 'text-[var(--muted)]'}`}>
            {p === '1M' ? '1개월' : p === '3M' ? '3개월' : p === '6M' ? '6개월' : '1년'}
          </button>
        ))}
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <StatCard label="원달러 현재" value={`${krwStats.current.toFixed(0)}원`}
          change={krwStats.changePct} />
        <StatCard label="달러지수 현재" value={dxyStats.current.toFixed(2)}
          change={dxyStats.changePct} />
        <StatCard label="상관계수" value={corr.toFixed(3)}
          sub={corr > 0.7 ? '강한 양의 상관' : corr > 0.3 ? '약한 양의 상관' : corr > -0.3 ? '상관 없음' : '음의 상관'} />
        <StatCard label="원달러 범위"
          value={`${krwStats.low.toFixed(0)} ~ ${krwStats.high.toFixed(0)}`}
          sub={`평균 ${krwStats.avg.toFixed(0)}원`} />
      </div>

      {/* USDKRW */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white">원달러 환율 추이</span>
          <span className="text-caption text-[var(--muted)] flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" />원달러</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500" />적정환율</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500/30 border-t border-dashed border-red-400" />상한</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500/30 border-t border-dashed border-green-400" />하한</span>
          </span>
        </div>
        <div ref={krwRef} className="w-full rounded-lg overflow-hidden border border-[var(--border)]" />
      </div>

      {/* USD Index */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-white">달러 인덱스 (DXY) 추이</span>
          <span className="text-caption text-[var(--muted)] flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-gray-400" />DXY</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-amber-400" />MA20</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500 border-t border-dashed" />평균</span>
          </span>
        </div>
        <div ref={dxyRef} className="w-full rounded-lg overflow-hidden border border-[var(--border)]" />
      </div>

      {/* 복합 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">원달러 & 달러지수 복합 추이</span>
            {corr !== 0 && (
              <span className={`text-caption px-1.5 py-0.5 rounded ${corr > 0.5 ? 'bg-green-500/20 text-green-400' : corr > 0 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-red-500/20 text-red-400'}`}>
                r={corr.toFixed(2)}
              </span>
            )}
          </div>
          <span className="text-caption text-[var(--muted)] flex items-center gap-3">
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-red-500" />USDKRW (좌)</span>
            <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-500" />DXY (우)</span>
          </span>
        </div>
        <div ref={comboRef} className="w-full rounded-lg overflow-hidden border border-[var(--border)]" />
      </div>
    </>
  )
}

/* 통계 카드 */
function StatCard({ label, value, change, sub }: { label: string; value: string; change?: number; sub?: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
      <div className="text-caption text-[var(--muted)] mb-0.5">{label}</div>
      <div className="text-sm font-bold text-white">{value}</div>
      {change !== undefined && (
        <div className={`text-caption font-mono ${change >= 0 ? 'text-red-400' : 'text-green-400'}`}>
          {change >= 0 ? '+' : ''}{change.toFixed(2)}%
        </div>
      )}
      {sub && <div className="text-caption text-[var(--muted)]">{sub}</div>}
    </div>
  )
}

/* ========== 공통 컴포넌트 ========== */
function Box({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
      <div className="text-caption text-[var(--muted)] mb-0.5">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
    </div>
  )
}

function GaugeBar({ gauge, unit, isGap }: { gauge: Gauge; unit: string; isGap?: boolean }) {
  const { label, current, lower, center, upper, gap_lower_pct, gap_center_pct, gap_upper_pct, is_buy } = gauge
  const fmt = (v: number) => isGap ? v.toFixed(2) : v.toLocaleString(undefined, { maximumFractionDigits: 0 })

  // 적정값(center)을 항상 50%에 고정, 현재값을 상대 위치로 계산
  // lower쪽 거리와 upper쪽 거리 중 큰 쪽을 기준으로 스케일
  const distLower = center - lower || 1
  const distUpper = upper - center || 1
  const maxDist = Math.max(distLower, distUpper)

  const toPos = (v: number) => {
    const offset = v - center
    return Math.max(2, Math.min(98, 50 + (offset / maxDist) * 50))
  }

  const currentPos = toPos(current)
  const lowerPos = toPos(lower)
  const upperPos = toPos(upper)

  // 바 그라디언트: 왼쪽(매수적합/초록) → 중앙 → 오른쪽(매수부적합/빨강)
  const gradStart = `${Math.max(0, lowerPos)}%`
  const gradEnd = `${Math.min(100, upperPos)}%`

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4">
      {/* 헤더: O/X + 라벨 */}
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-base font-bold ${is_buy ? 'text-green-400' : 'text-red-400'}`}>
          {is_buy ? '✓' : '✗'}
        </span>
        <span className="text-sm text-white font-semibold">{label}</span>
      </div>

      {/* 현재값 라벨 (바 위) */}
      <div className="relative h-5 mb-0.5">
        <div className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${currentPos}%` }}>
          <span className={`text-xs font-bold ${is_buy ? 'text-green-400' : 'text-red-400'}`}>
            {fmt(current)}{unit}
          </span>
        </div>
      </div>

      {/* 게이지 바 */}
      <div className="relative h-2.5 rounded-full mb-2"
        style={{ background: `linear-gradient(to right, #166534 ${gradStart}, #1e293b 50%, #7f1d1d ${gradEnd})` }}>
        {/* 적정 포인트 (회색, 항상 50% 중앙) */}
        <div className="absolute w-3.5 h-3.5 bg-gray-500 rounded-full -translate-x-1/2 -top-[2px] border-2 border-gray-400"
          style={{ left: '50%' }} />
        {/* 현재 포인트 */}
        <div className={`absolute w-3.5 h-3.5 rounded-full -translate-x-1/2 -top-[2px] border-2 ${is_buy ? 'bg-green-500 border-green-300' : 'bg-red-500 border-red-300'}`}
          style={{ left: `${currentPos}%` }} />
      </div>

      {/* 하단: 하한(0%) — 적정(50%) — 상한(100%) */}
      <div className="relative h-10">
        {/* 하한 */}
        <div className="absolute text-caption" style={{ left: `${lowerPos}%`, transform: 'translateX(-50%)' }}>
          <div className="font-mono text-[var(--muted)]">{fmt(lower)}{unit}</div>
          <div className="text-green-400/80">(+{Math.abs(gap_lower_pct)}%)</div>
        </div>
        {/* 적정 (중앙) */}
        <div className="absolute text-caption text-center" style={{ left: '50%', transform: 'translateX(-50%)' }}>
          <div className="font-mono text-[var(--muted)]">{fmt(center)}{unit}</div>
          <div className="text-[var(--muted)]">({gap_center_pct > 0 ? '+' : ''}{gap_center_pct}%)</div>
        </div>
        {/* 상한 */}
        <div className="absolute text-caption text-right" style={{ left: `${upperPos}%`, transform: 'translateX(-50%)' }}>
          <div className="font-mono text-[var(--muted)]">{fmt(upper)}{unit}</div>
          <div className="text-red-400/80">({gap_upper_pct > 0 ? '+' : ''}{gap_upper_pct}%)</div>
        </div>
      </div>
    </div>
  )
}
