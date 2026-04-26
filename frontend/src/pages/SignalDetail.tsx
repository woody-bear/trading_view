import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useLocation, useParams, useSearchParams } from 'react-router-dom'
import BuySignalBanner from '../components/BuySignalBanner'
import type { NavigateState } from '../utils/buyReason'
import { addSymbol, checkPatternCaseDuplicate, createPatternCase, fetchIndicatorsAt, fetchPatternCases, fetchQuickChart, fetchSignalBySymbol, fetchSignals, getSensitivity, setSensitivity } from '../api/client'
import TrendPeriodTabs from '../components/charts/TrendPeriodTabs'
import TrendlineGlossaryPanel from '../components/charts/TrendlineGlossaryPanel'
import { useTrendlineChannels } from '../hooks/useTrendlineChannels'
import { useDetailViewStore, buildDetailKey } from '../stores/detailViewStore'
import { fmtPrice as _fmtPrice } from '../utils/format'
import ChartEmptyState from '../components/charts/ChartEmptyState'
import ChartErrorBoundary from '../components/charts/ChartErrorBoundary'
import ChartSkeleton from '../components/charts/ChartSkeleton'
import FinancialChart from '../components/charts/FinancialChart'
import RevenueSegmentChart from '../components/RevenueSegmentChart'
import RiskWarningBanner from '../components/RiskWarningBanner'
import StockFundamentals from '../components/StockFundamentals'
import OrderbookPanel from '../components/OrderbookPanel'
import IndicatorChart from '../components/charts/IndicatorChart'
import EmaOnlyChart from '../components/charts/EmaOnlyChart'
import TrendAnalysisCard from '../components/charts/TrendAnalysisCard'
import EntryPlanPanel from '../components/detail/EntryPlanPanel'
import SignalLegend from '../components/detail/SignalLegend'
import { useTrendOverlayStore } from '../stores/trendOverlayStore'
import { useTrendAnalysis } from '../hooks/useTrendAnalysis'
import ConnectionIndicator from '../components/ui/ConnectionIndicator'
import MarketStatusBadge from '../components/MarketStatusBadge'
import { usePriceFlash } from '../hooks/usePriceFlash'
import { useRealtimePrice } from '../hooks/useRealtimePrice'
import { useSignalStore } from '../stores/signalStore'
import { useBuyPoint } from '../hooks/useBuyPoint'
import { useToastStore } from '../stores/toastStore'
import { useAuthStore } from '../store/authStore'
import DetailTabs from '../components/DetailTabs'
import ValueAnalysisTab from '../components/ValueAnalysisTab'
import { fetchCompanyInfo } from '../api/client'
import { useDetailTab } from '../hooks/useDetailTab'

// stateLabel은 더 이상 사용하지 않음 (칩 기반 신호 표시로 대체)

interface IndicatorGauge {
  label: string
  value: number
  min: number
  median: number
  max: number
  format: (v: number) => string
  zone: 'buy' | 'sell' | 'neutral'
  warn?: string
}

function getZone(value: number, _median: number, lowThresh: number, highThresh: number, invertColor?: boolean): 'buy' | 'sell' | 'neutral' {
  if (invertColor) {
    if (value <= lowThresh) return 'buy'
    if (value >= highThresh) return 'sell'
    return 'neutral'
  }
  if (value <= lowThresh) return 'sell'
  if (value >= highThresh) return 'buy'
  return 'neutral'
}

function MiniGauge({ g }: { g: IndicatorGauge }) {
  const range = g.max - g.min || 1
  const pos = Math.max(0, Math.min(100, ((g.value - g.min) / range) * 100))
  const medianPos = Math.max(0, Math.min(100, ((g.median - g.min) / range) * 100))

  const valColor = g.zone === 'buy' ? 'var(--up)' : g.zone === 'sell' ? 'var(--down)' : 'var(--fg-2)'
  const dotBg   = g.zone === 'buy' ? 'var(--up)' : g.zone === 'sell' ? 'var(--down)' : 'var(--accent)'

  return (
    <div className="panel" style={{ padding: '10px 12px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>{g.label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, fontFamily: 'var(--font-mono)', color: valColor }}>{g.format(g.value)}</span>
      </div>

      {/* 게이지 바 */}
      <div className="relative" style={{ height: 6, background: 'var(--bg-3)', borderRadius: 3, margin: '2px 0 4px' }}>
        {/* 그라데이션 오버레이 */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: 3,
          background: 'linear-gradient(to right, var(--up-bg), var(--bg-3), var(--down-bg))',
        }} />
        {/* 중앙값 마커 */}
        <div style={{
          position: 'absolute', top: -2, left: `${medianPos}%`,
          transform: 'translateX(-50%)',
          width: 0, height: 0,
          borderLeft: '3px solid transparent',
          borderRight: '3px solid transparent',
          borderBottom: '5px solid var(--fg-3)',
        }} />
        {/* 현재값 도트 */}
        <div style={{
          position: 'absolute', top: '50%', left: `${pos}%`,
          transform: 'translate(-50%, -50%)',
          width: 10, height: 10, borderRadius: '50%',
          background: dotBg,
          border: '2px solid var(--bg-1)',
          boxShadow: `0 0 4px ${dotBg}`,
        }} />
      </div>

      {/* 범위 표시 */}
      <div className="flex justify-between" style={{ fontSize: 9.5, color: 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
        <span>{g.format(g.min)}</span>
        <span style={{ color: 'var(--fg-3)' }}>적정 {g.format(g.median)}</span>
        <span>{g.format(g.max)}</span>
      </div>

      {g.warn && <div style={{ fontSize: 10, color: 'var(--warn)', marginTop: 3, textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{g.warn}</div>}
    </div>
  )
}

export default function SignalDetail() {
  const { symbol: urlSymbol } = useParams()
  const [searchParams] = useSearchParams()
  const { state: navState } = useLocation()
  const buySignal = (navState as NavigateState)?.buySignal
  const qc = useQueryClient()
  const globalTf = '1d'  // 일봉 고정

  // URL에서 market 힌트 (미등록 종목용)
  const marketHint = searchParams.get('market') || ''

  // URL의 심볼로 store에서 먼저 찾기
  const lookupSymbol = (urlSymbol || '').replace(/_/g, '/')
  const storeSignal = useSignalStore((s) =>
    s.signals.find((x) => x.symbol === lookupSymbol)
  )
  const { setSignals } = useSignalStore()

  // store에 없으면 심볼로 API 조회
  const { data: fetchedSignal } = useQuery({
    queryKey: ['signal-by-symbol', urlSymbol],
    queryFn: () => fetchSignalBySymbol(urlSymbol!),
    enabled: !storeSignal && !!urlSymbol,
  })

  // 전체 signals도 로드 (store 채우기용)
  const { data: fetchedSignals } = useQuery({
    queryKey: ['signals'],
    queryFn: fetchSignals,
    enabled: !storeSignal && !fetchedSignal,
  })

  useEffect(() => {
    if (fetchedSignals && !storeSignal) setSignals(fetchedSignals)
  }, [fetchedSignals, storeSignal, setSignals])

  const signal = storeSignal || fetchedSignal
  const wid = signal?.watchlist_id
  const isInWatchlist = !!wid

  // 차트 데이터: 항상 quickChart를 사용 (확실한 데이터 보장)
  // 관심종목이어도 DB 캐시가 비어있을 수 있으므로 quickChart로 통일
  const guessMarket = signal?.market || marketHint || (lookupSymbol.match(/^\d{6}$/) ? 'KR' : 'US')
  const { data: chartData, isLoading: chartLoading, isFetching: chartFetching, isError: chartError, refetch: refetchChart } = useQuery({
    queryKey: ['chart-unified', urlSymbol, globalTf],
    queryFn: ({ signal }) => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 10000)
      if (signal) signal.addEventListener('abort', () => controller.abort())
      return fetchQuickChart(lookupSymbol, guessMarket, globalTf, 260).finally(() => clearTimeout(timeout))
    },
    enabled: !!urlSymbol,
    retry: 1,
    placeholderData: undefined,  // 이전 종목 데이터 표시 방지
  })

  // 차트 데이터가 현재 심볼과 일치하는지 확인
  const chartSymbolMatch = chartData && (chartData as any).symbol === lookupSymbol

  // chartData.current에서 지표 추출
  const cur = (chartData as any)?.current || {}

  // 통합 지표 데이터: signal 우선, 없으면 chartData.current
  const s = {
    symbol: signal?.symbol || lookupSymbol,
    display_name: signal?.display_name || (chartData as any)?.display_name || lookupSymbol,
    market: signal?.market || guessMarket,
    signal_state: signal?.signal_state || cur.signal_state || 'NEUTRAL',
    confidence: signal?.confidence || cur.confidence || 0,
    signal_grade: signal?.signal_grade || cur.signal_grade || '',
    price: signal?.price || cur.price || 0,
    change_pct: signal?.change_pct || cur.change_pct || 0,
    rsi: signal?.rsi ?? cur.rsi ?? 50,
    bb_pct_b: signal?.bb_pct_b ?? cur.bb_pct_b ?? 0.5,
    bb_width: signal?.bb_width ?? cur.bb_width ?? 0.1,
    squeeze_level: signal?.squeeze_level ?? cur.squeeze_level ?? 0,
    macd_hist: signal?.macd_hist ?? cur.macd_hist ?? 0,
    volume_ratio: signal?.volume_ratio ?? cur.volume_ratio ?? 1.0,
    ema_20: signal?.ema_20 ?? cur.ema_20 ?? 0,
    ema_50: signal?.ema_50 ?? cur.ema_50 ?? 0,
    ema_200: signal?.ema_200 ?? cur.ema_200 ?? 0,
  }

  // 차트 마커 기준 마지막 신호 추출 (EntryPlanPanel 입력)
  const lastMarker = useMemo(() => {
    const markers = (chartData as any)?.markers || []
    for (let i = markers.length - 1; i >= 0; i--) {
      const t = markers[i].text
      if (['BUY', 'SQZ BUY', 'SELL', 'SQZ SELL'].includes(t)) {
        const d = new Date(markers[i].time * 1000)
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        const state = t === 'BUY' || t === 'SQZ BUY' ? 'BUY' : 'SELL'
        return { state, text: t, date }
      }
    }
    return { state: 'NEUTRAL' as const, text: null as string | null, date: null as string | null }
  }, [chartData])

  // 탭 상태 — URL ?tab=chart|value 동기화 (FR-005, US3)
  // useRealtimePrice 이전에 선언 — 차트 탭이 아닐 때 SSE 연결을 맺지 않기 위해
  const [activeTab, setActiveTab] = useDetailTab()

  // 실시간 가격 SSE (1초 간격) — 차트 탭일 때만 연결, 가치 탭이면 연결 해제
  const { livePrice, connected: realtimeConnected, connectionStatus, reconnect } =
    useRealtimePrice(activeTab === 'chart' ? lookupSymbol : undefined, s.market)
  const { addToast } = useToastStore()
  const { user } = useAuthStore()
  const { buyPoint, toggleBuyPoint } = useBuyPoint(lookupSymbol)

  // 스크랩된 BUY 날짜 Set — 마커 골드 색상 + 오버레이 "저장됨" 표시용
  const [scrapedDates, setScrapedDates] = useState<Set<string>>(new Set())
  const { data: patternCases } = useQuery({
    queryKey: ['pattern-cases-symbol', lookupSymbol],
    queryFn: () => fetchPatternCases({}),
    enabled: !!lookupSymbol && !!user,
  })
  useEffect(() => {
    if (!patternCases) return
    const dates = (patternCases as any[])
      .filter((c) => c.symbol === lookupSymbol)
      .map((c) => c.signal_date as string)
    setScrapedDates(new Set(dates))
  }, [patternCases, lookupSymbol])
  const currentPrice = livePrice?.price ?? s.price
  const currentChangePct = livePrice?.change_pct ?? s.change_pct
  // 전일 종가 대비 변동 금액 — livePrice.change 우선, chartData.current.change 폴백
  const currentChange = (livePrice as any)?.change
    ?? ((chartData as any)?.current?.change)
    ?? null
  const { flashClass } = usePriceFlash(currentPrice)

  // 관심종목 추가
  const [adding, setAdding] = useState(false)
  const [addedNow, setAddedNow] = useState(false)
  const handleAddToWatchlist = async () => {
    setAdding(true)
    try {
      // guessMarket이 market_type(NASDAQ100/SP500/ETF/KOSPI/KOSDAQ)일 수 있으므로 KR/US/CRYPTO로 정규화
      const m: 'KR' | 'US' | 'CRYPTO' =
        (guessMarket === 'KR' || guessMarket === 'KOSPI' || guessMarket === 'KOSDAQ') ? 'KR'
        : guessMarket === 'CRYPTO' ? 'CRYPTO'
        : lookupSymbol.match(/^\d{6}$/) ? 'KR'
        : 'US'
      await addSymbol({ market: m, symbol: lookupSymbol, timeframe: '1d' })
      setAddedNow(true)
      addToast('success', '관심종목에 추가되었습니다')
      await qc.invalidateQueries({ queryKey: ['signals'] })
      await qc.invalidateQueries({ queryKey: ['signal-by-symbol', urlSymbol] })
      window.location.reload()
    } catch (e: any) {
      if (e.response?.status === 409 || e.response?.data?.detail?.includes('이미')) {
        addToast('info', '이미 등록된 종목입니다')
        setAddedNow(true)
        window.location.reload()
      } else {
        addToast('error', '관심종목 추가에 실패했습니다')
      }
    } finally { setAdding(false) }
  }

  // 자산군 판정 — 가치 탭 활성화 여부 (FR-006). market 코드 정규화 후 prefetch
  const normalizedMarket =
    s.market === 'CRYPTO' ? 'CRYPTO'
    : (s.market === 'KR' || s.market === 'KOSPI' || s.market === 'KOSDAQ') ? 'KR'
    : s.market === 'US' ? 'US'
    : (lookupSymbol.match(/^\d{6}$/) ? 'KR' : 'US')
  const { data: companyForClass } = useQuery({
    queryKey: ['company', normalizedMarket, lookupSymbol],
    queryFn: () => fetchCompanyInfo(lookupSymbol, normalizedMarket),
    staleTime: 60 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!lookupSymbol,
    refetchOnWindowFocus: false,
  })
  const assetClass = companyForClass?.asset_class
  const valueEnabled = assetClass === 'STOCK_KR' || assetClass === 'STOCK_US'

  // 추세 분석 (024) — 오버레이 토글과 연결
  const showTrendLines = useTrendOverlayStore((s) => s.showLines)
  const { data: trendData } = useTrendAnalysis(lookupSymbol, normalizedMarket)

  // 추세선 채널 (033) — 기간 탭 + 4선 오버레이 + 단계 패널
  const [selectedPeriod, setSelectedPeriod] = useState<'1m' | '3m' | '6m' | '12m'>('12m')
  const { data: channelData } = useTrendlineChannels(lookupSymbol, normalizedMarket)
  const periodData = channelData?.periods[selectedPeriod]

  const periodFromTs = (p: '1m' | '3m' | '6m' | '12m'): number => {
    const now = Math.floor(Date.now() / 1000)
    const days: Record<string, number> = { '1m': 30, '3m': 90, '6m': 180, '12m': 365 }
    return now - (days[p] ?? 90) * 86400
  }

  // 민감도 설정 (매수조건 임계값)
  const detailKey = buildDetailKey(s.market || guessMarket, lookupSymbol)
  const storedUi = useDetailViewStore((st) => st.byKey[detailKey])
  const setStoredUi = useDetailViewStore((st) => st.set)
  const [sens, setSens] = useState(storedUi?.sensitivity ?? 'strict')
  const [sensLoading, setSensLoading] = useState(false)
  useEffect(() => {
    if (storedUi?.sensitivity) { setSens(storedUi.sensitivity); return }
    getSensitivity().then((d) => {
      setSens(d.current)
      setStoredUi(detailKey, { sensitivity: d.current })
    }).catch(() => {})
  }, [detailKey])

  const sensPresets: Record<string, { label: string; rsi: number; req: number }> = {
    strict:    { label: '엄격', rsi: 30, req: 3 },
    normal:    { label: '보통', rsi: 35, req: 2 },
    sensitive: { label: '민감', rsi: 40, req: 2 },
  }
  const sp = sensPresets[sens] || sensPresets.strict

  const handleSensChange = async (level: string) => {
    setSensLoading(true)
    try {
      await setSensitivity(level)
      setSens(level)
      setStoredUi(detailKey, { sensitivity: level })
      qc.invalidateQueries({ queryKey: ['signals'] })
      addToast('success', '민감도가 변경되었습니다')
    } catch {
      addToast('error', '설정 변경에 실패했습니다')
    } finally { setSensLoading(false) }
  }

  const buyConditions = [
    { label: 'BB 하단 터치/복귀', met: s.bb_pct_b <= 0.05, value: `%B ${(s.bb_pct_b * 100).toFixed(1)}%` },
    { label: `RSI < ${sp.rsi}`, met: s.rsi < sp.rsi, value: s.rsi?.toFixed(1) },
    { label: 'MACD 모멘텀 양수', met: s.macd_hist > 0, value: s.macd_hist > 0 ? '↑ 상승' : '↓ 하락' },
  ]
  const metCount = buyConditions.filter(c => c.met).length

  const signalChip = useMemo(() => {
    const sq = s.squeeze_level ?? 0
    if (s.signal_state === 'BUY' && sq >= 1)  return { label: 'SQZ BUY',  cls: 'chip chip-mag' }
    if (s.signal_state === 'BUY')              return { label: 'BUY',      cls: 'chip chip-up' }
    if (s.signal_state === 'SELL' && sq >= 1) return { label: 'SQZ SELL', cls: 'chip chip-down' }
    if (s.signal_state === 'SELL')             return { label: 'SELL',     cls: 'chip chip-down' }
    return { label: 'WATCH', cls: 'chip chip-ghost' }
  }, [s.signal_state, s.squeeze_level])

  // 차트 상태 판별
  const chartEmpty = chartData && (!chartData.candles || chartData.candles.length === 0)
  const chartTimeout = chartError && !chartData

  const fmtPrice = (price: number) => _fmtPrice(price, s.market)

  // 지표 게이지 데이터 구성
  const gauges: IndicatorGauge[] = [
    {
      label: 'RSI (14)',
      value: s.rsi,
      min: 0, median: 50, max: 100,
      format: (v) => v.toFixed(1),
      zone: getZone(s.rsi, 50, 30, 70, true),
      warn: s.rsi < 30 ? '과매도 구간' : s.rsi > 70 ? '과매수 구간' : undefined,
    },
    {
      label: '%B (볼린저 위치)',
      value: s.bb_pct_b * 100,
      min: -20, median: 50, max: 120,
      format: (v) => `${v.toFixed(1)}%`,
      zone: getZone(s.bb_pct_b * 100, 50, 5, 95, true),
      warn: s.bb_pct_b <= 0.05 ? '하단 돌파' : s.bb_pct_b >= 0.95 ? '상단 돌파' : undefined,
    },
    {
      label: 'BBW (밴드폭)',
      value: s.bb_width * 100,
      min: 0, median: 10, max: Math.max(30, s.bb_width * 100 * 1.5),
      format: (v) => `${v.toFixed(2)}%`,
      zone: s.bb_width * 100 < 5 ? 'sell' : s.bb_width * 100 > 15 ? 'buy' : 'neutral',
      warn: s.bb_width * 100 < 5 ? '스퀴즈 (수렴)' : undefined,
    },
    {
      label: 'MACD 히스토그램',
      value: s.macd_hist,
      min: Math.min(-0.5, s.macd_hist * 2), median: 0, max: Math.max(0.5, s.macd_hist * 2),
      format: (v) => v.toFixed(4),
      zone: s.macd_hist > 0 ? 'buy' : s.macd_hist < 0 ? 'sell' : 'neutral',
    },
    {
      label: '거래량 비율',
      value: s.volume_ratio,
      min: 0, median: 1.0, max: Math.max(3.0, s.volume_ratio * 1.5),
      format: (v) => `${v.toFixed(1)}x`,
      zone: s.volume_ratio >= 1.2 ? 'buy' : s.volume_ratio < 0.8 ? 'sell' : 'neutral',
      warn: s.volume_ratio >= 1.5 ? '거래량 급증' : undefined,
    },
    {
      label: '스퀴즈 레벨',
      value: s.squeeze_level,
      min: 0, median: 0, max: 4,
      format: (v) => ['없음', '약', '중', '강', '최대'][Math.round(v)] || `${v}`,
      zone: s.squeeze_level >= 2 ? 'sell' : s.squeeze_level === 0 ? 'buy' : 'neutral',
      warn: s.squeeze_level >= 3 ? '강한 수렴 - 방향 전환 임박' : undefined,
    },
  ]

  const handleScrapSave = async (_markerTime: number, date: string) => {
    if (!user) return
    try {
      const dup = await checkPatternCaseDuplicate(lookupSymbol, date)
      if (dup.exists) {
        addToast('info', `이미 스크랩된 사례입니다 (${lookupSymbol} · ${date})`)
        return
      }
      const ind = await fetchIndicatorsAt(lookupSymbol, guessMarket, date)
      const patternType =
        ind.squeeze_level >= 1 ? 'squeeze_breakout'
        : ind.rsi != null && ind.rsi < 40 ? 'oversold_bounce'
        : 'custom'
      await createPatternCase({
        title: `${s.display_name} ${date} BUY`,
        symbol: lookupSymbol,
        stock_name: s.display_name || lookupSymbol,
        market: guessMarket,
        market_type: guessMarket,
        pattern_type: patternType,
        signal_date: date,
        entry_price: ind.close,
        rsi: ind.rsi,
        bb_pct_b: ind.bb_pct_b,
        bb_width: ind.bb_width,
        macd_hist: ind.macd_hist,
        volume_ratio: ind.volume_ratio,
        ema_alignment: ind.ema_alignment,
        squeeze_level: ind.squeeze_level,
        conditions_met: ind.conditions_met,
        source: 'chart',
      })
      setScrapedDates(prev => new Set([...prev, date]))
      addToast('success', `BUY 사례가 저장되었습니다 (${date})`)
    } catch (e: any) {
      if (e.response?.status === 409) {
        addToast('info', '이미 스크랩된 사례입니다')
      } else {
        addToast('error', '사례 저장에 실패했습니다')
      }
    }
  }

  return (
    <div>
      <DetailTabs activeTab={activeTab} onChange={setActiveTab} valueEnabled={valueEnabled} />
      {activeTab === 'value' && (
        <div>
          <ValueAnalysisTab
            symbol={lookupSymbol}
            market={normalizedMarket}
            assetClassHint={assetClass}
          />
          {/* 실적 차트 */}
          <FinancialChart symbol={lookupSymbol} market={s.market} />
          {/* 매출 구성 */}
          <RevenueSegmentChart symbol={lookupSymbol} market={guessMarket || 'US'} />
        </div>
      )}
      {activeTab === 'chart' && (
      <div className="p-3 md:p-6">
      {/* 헤더 */}
      <div className="flex items-center" style={{ gap: 8, marginBottom: 12, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex items-center" style={{ gap: 8, flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-0)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
              {s.display_name || s.symbol}
            </h1>
            <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {s.symbol}
            </span>
            <span className="chip chip-ghost" style={{ flexShrink: 0 }}>
              {guessMarket}
            </span>
          </div>
        </div>
        {s.signal_state !== 'NEUTRAL' && (
          <span className={signalChip.cls} style={{ flexShrink: 0 }}>{signalChip.label}</span>
        )}
        {!isInWatchlist && !addedNow && (
          <button
            onClick={handleAddToWatchlist}
            disabled={adding}
            style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: 'var(--accent)', color: 'var(--bg-0)', borderRadius: 4, fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer', opacity: adding ? 0.6 : 1 }}
          >
            <Plus size={13} /> {adding ? '...' : '관심'}
          </button>
        )}
        {(isInWatchlist || addedNow) && (
          <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--up)' }}>
            <Check size={13} /> 관심
          </span>
        )}
      </div>

      {/* 가격 영역 */}
      <div className="flex items-center flex-wrap" style={{ gap: 8, marginBottom: 16, paddingLeft: 4 }}>
        <span
          className={flashClass}
          style={{ fontSize: 26, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-0)', transition: 'color 0.3s' }}
        >
          {fmtPrice(currentPrice)}
        </span>
        <span style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600, color: currentChangePct >= 0 ? 'var(--up)' : 'var(--blue)' }}>
          {currentChangePct >= 0 ? '▲' : '▼'} {Math.abs(currentChangePct ?? 0).toFixed(2)}%
          {currentChange != null && (
            <span style={{ marginLeft: 4, fontSize: 11, opacity: 0.8 }}>
              ({currentChange >= 0 ? '+' : ''}{s.market === 'US' ? `$${currentChange.toFixed(2)}` : `${Math.round(currentChange).toLocaleString()}원`})
            </span>
          )}
        </span>
        <MarketStatusBadge market={
          s.market === 'CRYPTO' ? 'CRYPTO'
          : (s.market === 'KR' || s.market === 'KOSPI' || s.market === 'KOSDAQ') ? 'KR'
          : s.market === 'US' ? 'US'
          : (lookupSymbol.match(/^\d{6}$/) ? 'KR' : 'US')
        } />
        {livePrice?.is_expected && <span className="chip chip-warn">예상가</span>}
        {livePrice?.is_pre_market && <span className="chip chip-accent">프리마켓</span>}
        {livePrice?.is_post_market && <span className="chip chip-ghost">애프터마켓</span>}
        {s.confidence > 0 && <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>강도 {s.confidence.toFixed(0)}점</span>}
        <ConnectionIndicator status={connectionStatus || (realtimeConnected ? 'connected' : 'disconnected')} onReconnect={reconnect || (() => {})} />
      </div>

      {/* BUY 신호 이유 배너 — BUY 리스트 진입 시만 표시 */}
      {buySignal && <BuySignalBanner item={buySignal} />}

      {/* 위험경고 배너 (한국 주식만) */}
      <RiskWarningBanner symbol={lookupSymbol} market={guessMarket} />

      {/* 차트 영역 — PC(1280px+) 2컬럼: 좌 차트 / 우 EntryPlan·Squeeze·Legend */}
      <div className="xl:grid xl:gap-3" style={{ gridTemplateColumns: '1fr 340px' }}>
        <div className="min-w-0">
          {(chartLoading || chartFetching || !chartSymbolMatch) && !chartError && (
            <div className="relative">
              <ChartSkeleton />
              <div className="absolute inset-0 flex items-center justify-center">
                <span style={{ fontSize: 13, color: 'var(--fg-3)', background: 'color-mix(in oklch, var(--bg-1), transparent 20%)', padding: '6px 12px', borderRadius: 6, backdropFilter: 'blur(4px)' }}>차트 로드중...</span>
              </div>
            </div>
          )}
          {chartEmpty && chartSymbolMatch && <ChartEmptyState status="empty" />}
          {chartTimeout && <ChartEmptyState status="timeout" onRetry={() => refetchChart()} />}
          {chartError && !chartTimeout && <ChartEmptyState status="error" onRetry={() => refetchChart()} />}
          {chartData && chartSymbolMatch && !chartEmpty && !chartError && !chartFetching && (
            <ChartErrorBoundary onReset={() => refetchChart()}>
              <TrendPeriodTabs selected={selectedPeriod} onChange={setSelectedPeriod} />
              <IndicatorChart
                data={chartData}
                realtimePrice={livePrice}
                buyPoint={buyPoint}
                onBuyMarkerClick={({ price, markerTime }) => {
                  toggleBuyPoint({
                    symbol: lookupSymbol,
                    price,
                    date: new Date().toISOString().slice(0, 10),
                    markerTime,
                  })
                }}
                scrapedDates={scrapedDates}
                onScrapSave={user ? handleScrapSave : undefined}
                trendLines={[
                  ...(showTrendLines ? (trendData?.lines ?? []) : []),
                  ...(periodData?.lines ?? []),
                ] as import('../api/client').TrendLine[]}
                shortTrendPivots={channelData?.periods['3m']?.swing_pivots}
                longTrendPivots={channelData?.periods['12m']?.swing_pivots}
                highlightedVolumeTimes={undefined}
                visibleFromTs={periodFromTs(selectedPeriod)}
              />
              {/* EMA 전용 보조 차트 — 5/20/60/120만 일봉 기준 */}
              <EmaOnlyChart data={chartData} />
            </ChartErrorBoundary>
          )}
          {/* 추세 분석 카드 — EmaOnlyChart와 동일 너비 */}
          <TrendAnalysisCard symbol={lookupSymbol} market={normalizedMarket} chartData={chartData || undefined} />
        </div>

        {/* 사이드레일 — 모바일: 추세 확인 아래 단일 컬럼 / PC(1280px+): 우측 340px 고정 컬럼 */}
        <div className="flex flex-col mt-3 xl:mt-0" style={{ gap: 12 }}>
          <EntryPlanPanel
            symbol={lookupSymbol}
            signalState={lastMarker.state}
            lastSignalText={lastMarker.text}
            lastSignalDate={lastMarker.date}
            rsi={s.rsi}
            bbPctB={s.bb_pct_b}
            ema20={s.ema_20}
            ema50={s.ema_50}
          />
          <SignalLegend
            level={s.squeeze_level}
            bandwidthPct={s.bb_width != null ? s.bb_width * 100 : null}
          />
          {/* 매수 조건 체크리스트 */}
          <div className="panel" style={{ padding: 0 }}>
            <div className="flex justify-between items-center" style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-center" style={{ gap: 8 }}>
                <div className="label">매수 조건</div>
                <span className={metCount >= sp.req ? 'chip chip-up' : metCount >= sp.req - 1 ? 'chip chip-warn' : 'chip chip-ghost'}>
                  {metCount}/{buyConditions.length}
                </span>
              </div>
              {/* 민감도 토글 */}
              <div className="flex" style={{ gap: 2, background: 'var(--bg-2)', borderRadius: 4, padding: 2 }}>
                {Object.entries(sensPresets).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => handleSensChange(key)}
                    disabled={sensLoading}
                    style={{
                      padding: '2px 7px',
                      borderRadius: 3,
                      fontSize: 10,
                      fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      border: 'none',
                      cursor: 'pointer',
                      background: sens === key ? 'var(--bg-1)' : 'transparent',
                      color: sens === key ? 'var(--fg-0)' : 'var(--fg-3)',
                      boxShadow: sens === key ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col" style={{ padding: '8px 12px', gap: 5 }}>
              {buyConditions.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center justify-between"
                  style={{
                    padding: '6px 10px',
                    borderRadius: 4,
                    background: c.met ? 'var(--up-bg)' : 'var(--bg-2)',
                    border: `1px solid ${c.met ? 'var(--up)' : 'var(--border)'}`,
                  }}
                >
                  <div className="flex items-center" style={{ gap: 7 }}>
                    <span style={{ fontSize: 11, color: c.met ? 'var(--up)' : 'var(--fg-4)', fontWeight: 700 }}>
                      {c.met ? '✓' : '✗'}
                    </span>
                    <span style={{ fontSize: 11, color: c.met ? 'var(--fg-0)' : 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
                      {c.label}
                    </span>
                  </div>
                  <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, color: c.met ? 'var(--up)' : 'var(--fg-3)' }}>
                    {c.value}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 9.5, color: 'var(--fg-4)', paddingTop: 2, fontFamily: 'var(--font-mono)' }}>
                {metCount >= sp.req ? '✦ 매수 신호 조건 충족' : metCount >= sp.req - 1 ? '△ 조건 근접' : '○ 대기 중'}
              </div>
            </div>
          </div>

          {/* 단기 추세선 가이드 (3m, 최근 2개 스윙) */}
          <TrendlineGlossaryPanel
            high={channelData?.periods['3m']?.swing_pivots?.high}
            low={channelData?.periods['3m']?.swing_pivots?.low}
            useOverall={false}
            termLabel="단기"
            periodLabel="3m"
          />
          {/* 장기 추세선 가이드 (12m, 첫~마지막 스윙) */}
          <TrendlineGlossaryPanel
            high={channelData?.periods['12m']?.swing_pivots?.high}
            low={channelData?.periods['12m']?.swing_pivots?.low}
            useOverall={true}
            termLabel="장기"
            periodLabel="12m"
            footnote="* 첫 번째 vs 마지막 스윙 포인트 방향 기준"
          />

          {/* 지표 게이지 — 6종 세로 정렬 */}
          {gauges.map((g) => <MiniGauge key={g.label} g={g} />)}
        </div>
      </div>

      {/* 투자지표 + 52주 범위 + 가격제한 */}
      <StockFundamentals symbol={lookupSymbol} market={guessMarket} />

      {/* 호가창 (한국 주식만) */}
      <OrderbookPanel symbol={lookupSymbol} market={guessMarket} />



      </div>
      )}
    </div>
  )
}


