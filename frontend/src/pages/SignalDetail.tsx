import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import BuySignalBanner from '../components/BuySignalBanner'
import type { NavigateState } from '../utils/buyReason'
import { addSymbol, checkPatternCaseDuplicate, createPatternCase, fetchIndicatorsAt, fetchPatternCases, fetchQuickChart, fetchSignalBySymbol, fetchSignals, getSensitivity, setSensitivity } from '../api/client'
import { fmtPrice as _fmtPrice } from '../utils/format'
import ChartEmptyState from '../components/charts/ChartEmptyState'
import ChartErrorBoundary from '../components/charts/ChartErrorBoundary'
import ChartSkeleton from '../components/charts/ChartSkeleton'
import FinancialChart from '../components/charts/FinancialChart'
import CompanyInfoPanel from '../components/CompanyInfoPanel'
import RevenueSegmentChart from '../components/RevenueSegmentChart'
import PositionGuide from '../components/PositionGuide'
import RiskWarningBanner from '../components/RiskWarningBanner'
import StockFundamentals from '../components/StockFundamentals'
import OrderbookPanel from '../components/OrderbookPanel'
import IndicatorChart from '../components/charts/IndicatorChart'
import ConnectionIndicator from '../components/ui/ConnectionIndicator'
import { usePriceFlash } from '../hooks/usePriceFlash'
import { useRealtimePrice } from '../hooks/useRealtimePrice'
import { useSignalStore } from '../stores/signalStore'
import { useBuyPoint } from '../hooks/useBuyPoint'
import { useToastStore } from '../stores/toastStore'
import { useAuthStore } from '../store/authStore'
import DetailTabs from '../components/DetailTabs'
import { useDetailViewStore, buildDetailKey } from '../stores/detailViewStore'
import ValueAnalysisTab from '../components/ValueAnalysisTab'
import { fetchCompanyInfo } from '../api/client'
import { useDetailTab } from '../hooks/useDetailTab'

const stateLabel: Record<string, string> = { BUY: '매수', SELL: '매도', NEUTRAL: '대기' }

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

  const zoneColor = g.zone === 'buy' ? 'text-[var(--buy)]' : g.zone === 'sell' ? 'text-[var(--sell)]' : 'text-[var(--muted)]'
  const dotColor = g.zone === 'buy' ? 'bg-green-500 border-green-300' : g.zone === 'sell' ? 'bg-red-500 border-red-300' : 'bg-blue-500 border-blue-300'
  const gradientClass = 'from-green-800/40 via-slate-700/40 to-red-800/40'

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--muted)]">{g.label}</span>
        <span className={`text-sm font-bold font-mono ${zoneColor}`}>{g.format(g.value)}</span>
      </div>

      {/* 게이지 바 */}
      <div className="relative h-2 bg-[#0f172a] rounded-full mb-1.5 mt-2">
        <div className={`absolute h-full bg-gradient-to-r ${gradientClass} rounded-full w-full`} />
        {/* 중앙값 (회색 삼각형) */}
        <div className="absolute -top-[3px] -translate-x-1/2" style={{ left: `${medianPos}%` }}>
          <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-b-[6px] border-l-transparent border-r-transparent border-b-gray-400" />
        </div>
        {/* 현재값 */}
        <div className={`absolute w-2.5 h-2.5 rounded-full -translate-x-1/2 -top-[1px] border-2 ${dotColor}`}
          style={{ left: `${pos}%` }} />
      </div>

      {/* 하단 범위 + 중앙값 */}
      <div className="flex justify-between text-micro text-[var(--muted)]">
        <span className="font-mono">{g.format(g.min)}</span>
        <span className="font-mono text-gray-400">적정 {g.format(g.median)}</span>
        <span className="font-mono">{g.format(g.max)}</span>
      </div>

      {g.warn && <div className="text-caption text-yellow-400 mt-1 text-center">{g.warn}</div>}
    </div>
  )
}

export default function SignalDetail() {
  const { symbol: urlSymbol } = useParams()
  const [searchParams] = useSearchParams()
  const nav = useNavigate()
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
      return fetchQuickChart(lookupSymbol, guessMarket, globalTf).finally(() => clearTimeout(timeout))
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

  // 실시간 가격 SSE (1초 간격)
  const { livePrice, connected: realtimeConnected, connectionStatus, reconnect } = useRealtimePrice(lookupSymbol, s.market)
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

  // 탭 상태 — URL ?tab=chart|value 동기화 (FR-005, US3)
  const [activeTab, setActiveTab] = useDetailTab()

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

  // 세션 단위 차트 UI 상태 보존 (FR-010) — symbol 단위 키로 복원
  const detailKey = buildDetailKey(s.market || guessMarket, lookupSymbol)
  const storedUi = useDetailViewStore((st) => st.byKey[detailKey])
  const setStoredUi = useDetailViewStore((st) => st.set)

  const [sens, setSens] = useState(storedUi?.sensitivity ?? 'strict')
  const [sensLoading, setSensLoading] = useState(false)
  useEffect(() => {
    if (storedUi?.sensitivity) {
      setSens(storedUi.sensitivity)
      return
    }
    getSensitivity().then((d) => {
      setSens(d.current)
      setStoredUi(detailKey, { sensitivity: d.current })
    }).catch(() => {})
  }, [detailKey])

  const stateColor = s.signal_state === 'BUY' ? 'text-[var(--buy)]' : s.signal_state === 'SELL' ? 'text-[var(--sell)]' : 'text-[var(--neutral)]'

  // 차트 상태 판별
  const chartEmpty = chartData && (!chartData.candles || chartData.candles.length === 0)
  const chartTimeout = chartError && !chartData

  const fmtPrice = (price: number) => _fmtPrice(price, s.market)

  const sensPresets: Record<string, { label: string; rsi: number; bb: number; vol: number; req: number; color: string }> = {
    strict: { label: '엄격', rsi: 30, bb: 0.05, vol: 1.2, req: 4, color: 'text-blue-400' },
    normal: { label: '보통', rsi: 35, bb: 0.15, vol: 1.1, req: 3, color: 'text-yellow-400' },
    sensitive: { label: '민감', rsi: 40, bb: 0.25, vol: 1.0, req: 2, color: 'text-red-400' },
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



  // BUY 조건 체크리스트 (민감도에 따라 동적)
  const buyConditions = [
    { label: `BB %B ≤ ${sp.bb}`, met: s.bb_pct_b <= sp.bb, value: `${(s.bb_pct_b * 100).toFixed(1)}%` },
    { label: `RSI < ${sp.rsi}`, met: s.rsi < sp.rsi, value: s.rsi?.toFixed(1) },
    { label: 'MACD 히스토그램 상승', met: s.macd_hist > 0, value: s.macd_hist?.toFixed(4) },
    { label: `거래량 ${sp.vol}배 이상`, met: s.volume_ratio > sp.vol, value: `${s.volume_ratio?.toFixed(1)}x` },
  ]
  const metCount = buyConditions.filter(c => c.met).length

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
        <ValueAnalysisTab
          symbol={lookupSymbol}
          market={normalizedMarket}
          assetClassHint={assetClass}
        />
      )}
      <div className="p-3 md:p-6" style={{ display: activeTab === 'chart' ? 'block' : 'none' }}>
      {/* 모바일 상단 헤더 */}
      <div className="flex items-center gap-3 mb-3 md:mb-4">
        <button onClick={() => nav('/')} className="text-[var(--muted)] hover:text-white p-1">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl md:text-2xl font-bold text-white truncate">{s.display_name || s.symbol}</h1>
            <span className="text-[var(--muted)] text-sm shrink-0">{s.symbol}</span>
          </div>
        </div>
        {s.signal_state !== 'NEUTRAL' && (
          <div className="text-right shrink-0">
            <span className={`text-base md:text-lg font-bold ${stateColor}`}>{stateLabel[s.signal_state]}</span>
          </div>
        )}
        {!isInWatchlist && !addedNow && (
          <button onClick={handleAddToWatchlist} disabled={adding}
            className="shrink-0 flex items-center gap-1 px-2.5 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs disabled:opacity-50">
            <Plus size={14} /> {adding ? '...' : '관심종목'}
          </button>
        )}
        {addedNow && !isInWatchlist && (
          <span className="shrink-0 flex items-center gap-1 text-green-400 text-xs"><Check size={14} /> 추가됨</span>
        )}
      </div>

      {/* 가격 영역 */}
      <div className="flex items-baseline gap-3 mb-4 md:mb-6 pl-1">
        <span className={`text-2xl md:text-xl font-mono font-semibold transition-colors duration-300 ${flashClass}`}>
          {fmtPrice(currentPrice)}
        </span>
        <span className={`text-sm font-mono ${currentChangePct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
          {currentChangePct >= 0 ? '+' : ''}{currentChangePct?.toFixed(2)}%
        </span>
        {livePrice?.is_expected && <span className="text-xs text-yellow-400 border border-yellow-400/30 rounded px-1.5 py-0.5">예상가</span>}
        {s.confidence > 0 && <span className="text-xs text-[var(--muted)]">강도 {s.confidence.toFixed(0)}점</span>}
        <ConnectionIndicator status={connectionStatus || (realtimeConnected ? 'connected' : 'disconnected')} onReconnect={reconnect || (() => {})} />
      </div>

      {/* BUY 신호 이유 배너 — BUY 리스트 진입 시만 표시 */}
      {buySignal && <BuySignalBanner item={buySignal} />}

      {/* 포지션 가이드 — 차트 마지막 BUY/SELL 마커 기준 (가격 영역 아래, 차트 위) */}
      <PositionGuide
        symbol={lookupSymbol}
        signalState={(() => {
          const markers = (chartData as any)?.markers || []
          for (let i = markers.length - 1; i >= 0; i--) {
            const t = markers[i].text
            if (t === 'BUY' || t === 'SQZ BUY') return 'BUY'
            if (t === 'SELL' || t === 'SQZ SELL') return 'SELL'
          }
          return 'NEUTRAL'
        })()}
        lastSignalText={(() => {
          const markers = (chartData as any)?.markers || []
          for (let i = markers.length - 1; i >= 0; i--) {
            const t = markers[i].text
            if (['BUY', 'SQZ BUY', 'SELL', 'SQZ SELL'].includes(t)) return t
          }
          return undefined
        })()}
        lastSignalDate={(() => {
          const markers = (chartData as any)?.markers || []
          for (let i = markers.length - 1; i >= 0; i--) {
            const t = markers[i].text
            if (['BUY', 'SQZ BUY', 'SELL', 'SQZ SELL'].includes(t)) {
              const d = new Date(markers[i].time * 1000)
              return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
            }
          }
          return undefined
        })()}
        rsi={s.rsi}
        bbPctB={s.bb_pct_b}
        ema20={s.ema_20}
        ema50={s.ema_50}
      />

      {/* 위험경고 배너 (한국 주식만) */}
      <RiskWarningBanner symbol={lookupSymbol} market={guessMarket} />

      {/* 차트 */}
      {(chartLoading || chartFetching || !chartSymbolMatch) && !chartError && (
        <div className="relative">
          <ChartSkeleton />
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-[var(--muted)] bg-[var(--card)]/80 px-3 py-1.5 rounded-lg backdrop-blur-sm">차트 로드중...</span>
          </div>
        </div>
      )}
      {chartEmpty && chartSymbolMatch && <ChartEmptyState status="empty" />}
      {chartTimeout && <ChartEmptyState status="timeout" onRetry={() => refetchChart()} />}
      {chartError && !chartTimeout && <ChartEmptyState status="error" onRetry={() => refetchChart()} />}
      {chartData && chartSymbolMatch && !chartEmpty && !chartError && !chartFetching && (
        <ChartErrorBoundary onReset={() => refetchChart()}>
          <IndicatorChart
            data={chartData}
            watchlistId={wid}
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
          />
        </ChartErrorBoundary>
      )}

      {/* 투자지표 + 52주 범위 + 가격제한 */}
      <StockFundamentals symbol={lookupSymbol} market={guessMarket} />

      {/* 호가창 (한국 주식만) */}
      <OrderbookPanel symbol={lookupSymbol} market={guessMarket} />

      {/* 실적 차트 */}
      <FinancialChart symbol={lookupSymbol} market={s.market} />

      {/* 회사 정보 */}
      <CompanyInfoPanel symbol={lookupSymbol} market={guessMarket || 'US'} />

      {/* 매출 구성 */}
      <RevenueSegmentChart symbol={lookupSymbol} market={guessMarket || 'US'} />

      {/* 기본 정보 */}
      <div className="grid grid-cols-2 gap-2 md:gap-3 mt-4 md:mt-6 mb-4">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">현재가</div>
          <div className={`font-mono mt-1 transition-colors duration-300 ${flashClass}`}>{fmtPrice(currentPrice)}</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">등락률</div>
          <div className={`font-mono mt-1 ${currentChangePct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
            {currentChangePct >= 0 ? '+' : ''}{currentChangePct?.toFixed(2)}%
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">EMA 20 / 50 / 200</div>
          <div className="text-white font-mono mt-1 text-xs">{s.ema_20?.toFixed(0)} / {s.ema_50?.toFixed(0)} / {s.ema_200?.toFixed(0)}</div>
          <div className="text-micro mt-0.5" style={{ color: s.ema_20 > s.ema_50 && s.ema_50 > s.ema_200 ? '#ff4b6a' : s.ema_20 < s.ema_50 && s.ema_50 < s.ema_200 ? '#4285f4' : '#8e8e93' }}>
            {s.ema_20 > s.ema_50 && s.ema_50 > s.ema_200 ? '정배열 (상승추세)' : s.ema_20 < s.ema_50 && s.ema_50 < s.ema_200 ? '역배열 (하락추세)' : '혼조 (횡보)'}
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3">
          <div className="text-xs text-[var(--muted)]">종합 신호</div>
          {s.signal_state !== 'NEUTRAL' && <div className={`font-mono mt-1 text-lg font-bold ${stateColor}`}>{stateLabel[s.signal_state]}</div>}
          {s.confidence > 0 && <div className="text-micro text-[var(--muted)] mt-0.5">신뢰도 {s.confidence.toFixed(0)}점 / {s.signal_grade}</div>}
        </div>
      </div>

      {/* BUY 조건 충족 현황 */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-white">매수 조건 ({metCount}/4)</span>
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold px-2 py-0.5 rounded ${metCount >= sp.req ? 'bg-green-500/20 text-green-400' : metCount >= 2 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-slate-500/20 text-[var(--muted)]'}`}>
              {metCount >= sp.req ? '매수 신호' : metCount >= sp.req - 1 ? '조건 근접' : '대기'}
            </span>
            {/* 민감도 선택 */}
            <div className="flex gap-0.5 bg-[var(--bg)] rounded-md p-0.5">
              {Object.entries(sensPresets).map(([key, p]) => (
                <button key={key} onClick={() => handleSensChange(key)} disabled={sensLoading}
                  className={`px-2 py-1 rounded text-caption font-bold transition ${sens === key ? `${p.color} bg-[var(--card)]` : 'text-[var(--muted)] hover:text-white'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {buyConditions.map((c) => (
            <div key={c.label} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${c.met ? 'bg-green-500/10 border border-green-500/30' : 'bg-[var(--bg)] border border-transparent'}`}>
              <span className={`text-sm ${c.met ? 'text-green-400' : 'text-[var(--muted)]'}`}>{c.met ? '✓' : '✗'}</span>
              <div>
                <div className={c.met ? 'text-green-400' : 'text-[var(--muted)]'}>{c.label}</div>
                <div className="text-caption text-[var(--muted)] font-mono">현재: {c.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 지표 게이지 */}
      <div className="mb-2">
        <h2 className="text-sm font-semibold text-white mb-3">지표 적정 범위</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-3">
        {gauges.map((g) => <MiniGauge key={g.label} g={g} />)}
      </div>
      </div>
    </div>
  )
}


