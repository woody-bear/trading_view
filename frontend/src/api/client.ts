import axios from 'axios'
import { supabase } from '../lib/supabase'
import { signOutWithReason, logAuthEvent } from '../lib/authService'
import { useAuthStore } from '../store/authStore'

const api = axios.create({ baseURL: '/api' })

// AuthProvider가 getSession()으로 authStore.session을 채운 뒤 loading=false로 바꾼다.
// 인터셉터에서 getSession()을 직접 호출하면 AuthProvider와 락 경합이 발생하므로
// authStore.session을 직접 읽어 락 충돌을 원천 차단한다.
api.interceptors.request.use(async (config) => {
  try {
    if (useAuthStore.getState().loading) {
      // 인증 초기화 완료까지 대기 (authLoading → false 신호 구독)
      await new Promise<void>((resolve) => {
        const unsub = useAuthStore.subscribe((state) => {
          if (!state.loading) { unsub(); resolve() }
        })
        setTimeout(() => { unsub(); resolve() }, 6000)
      })
    }

    const { session, user, loading } = useAuthStore.getState()
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
    } else if (user && !loading) {
      // 초기화 완료 + 로그인 상태인데 세션 없음 → 사일런트 실패
      logAuthEvent({ type: 'SILENT_FAILURE', source: 'request_interceptor', url: config.url, recovered: false, ts: new Date().toISOString() })
    }
  } catch {
    // auth 실패 시 토큰 없이 요청 진행
  }
  return config
})

export const fetchSignals = () => api.get('/signals').then(r => r.data.signals)
export const fetchWatchlist = () => api.get('/watchlist').then(r => r.data.items)
export const addSymbol = (data: { market: string; symbol: string; timeframe: string }) =>
  api.post('/watchlist', data).then(r => r.data)
export const deleteSymbol = (id: number) => api.delete(`/watchlist/${id}`)
export const updateSymbol = (id: number, data: { timeframe?: string; is_active?: boolean }) =>
  api.put(`/watchlist/${id}`, data).then(r => r.data)
export const triggerScan = () => api.post('/scan/trigger').then(r => r.data)
export const fetchChart = (id: number, timeframe?: string) =>
  api.get(`/signals/${id}/chart`, { params: { timeframe } }).then(r => r.data)
export const fetchSignalBySymbol = (symbol: string) =>
  api.get(`/signals/by-symbol/${symbol}`).then(r => r.data)
export const fetchChartBySymbol = (symbol: string, timeframe?: string) =>
  api.get(`/chart/by-symbol/${symbol}`, { params: { timeframe } }).then(r => r.data)
export const fetchQuickChart = (symbol: string, market: string, timeframe?: string, limit?: number) =>
  api.get('/chart/quick', { params: { symbol, market, timeframe: timeframe || '1d', ...(limit !== undefined ? { limit } : {}) } }).then(r => r.data)
export const fetchHealth = () => api.get('/health').then(r => r.data)

// 통합 스캔
export const runUnifiedScan = () => api.post('/scan/unified').then(r => r.data)
export const fetchUnifiedCache = () => api.get('/scan/unified').then(r => r.data)
export const fetchScanStatus = () => api.get('/scan/status').then(r => r.data)

// 시장 방향성
export const fetchSentiment = () => api.get('/sentiment/overview').then(r => r.data)
export const fetchSentimentHistory = (days: number = 30) => api.get('/sentiment/history', { params: { days } }).then(r => r.data)
export const fetchVIXHistory = (days: number = 365) => api.get('/sentiment/vix-history', { params: { days } }).then(r => r.data)

// 검색
export const searchSymbols = (q: string, market?: string) =>
  api.get('/search', { params: { q, market: market || '' } }).then(r => r.data.results)

// 설정
export const getSensitivity = () => api.get('/settings/sensitivity').then(r => r.data)
export const setSensitivity = (level: string) => api.put('/settings/sensitivity', { level }).then(r => r.data)

// 차트 BUY 신호
export const fetchLatestBuy = () => api.get('/signals/latest-buy').then(r => r.data)
export const refreshLatestBuy = () => api.post('/signals/latest-buy/refresh').then(r => r.data)

// 텔레그램
export const getTelegram = () => api.get('/settings/telegram').then(r => r.data)
export const setTelegram = (data: { bot_token: string; chat_id: string }) =>
  api.put('/settings/telegram', data).then(r => r.data)
export const testTelegram = () => api.post('/settings/telegram/test').then(r => r.data)

// 실시간 가격
export const fetchBatchPrices = (symbols: { symbol: string; market: string }[]) =>
  api.post('/prices/batch', { symbols }).then(r => r.data.prices)

export const fetchSparklines = (symbols: { symbol: string; market: string }[]) =>
  api.post('/prices/sparkline', { symbols }).then(r => r.data.sparklines as Record<string, number[]>)

// 시장 상태 (개장전/장중/장종료/휴장)
export type MarketStatusDTO = {
  status: 'holiday' | 'pre_open' | 'open' | 'closed' | 'crypto_24h'
  label: string
  color: 'red' | 'gray' | 'green' | 'blue' | 'purple'
  tz_now: string
}
export const fetchMarketStatus = (market: string) =>
  api.get<MarketStatusDTO>('/market/status', { params: { market } }).then(r => r.data)

// 종목 상세 (KIS)
export const fetchStockDetail = (symbol: string, market: string = 'KR') =>
  api.get(`/stocks/${symbol}/detail`, { params: { market } }).then(r => r.data)
export const fetchOrderbook = (symbol: string, market: string = 'KR') =>
  api.get(`/stocks/${symbol}/orderbook`, { params: { market } }).then(r => r.data)

// 한국투자증권
export const getKIS = () => api.get('/settings/kis').then(r => r.data)
export const setKIS = (data: { app_key: string; app_secret: string; account_no: string; paper_trading: boolean }) =>
  api.put('/settings/kis', data).then(r => r.data)
export const testKIS = () => api.post('/settings/kis/test').then(r => r.data)

// BUY 신호 알림
export const testBuyAlert = () => api.post('/alerts/buy-signal/test').then(r => r.data)
export const fetchAlertHistory = (type: string = 'scheduled_buy', limit: number = 20) =>
  api.get('/alerts/history', { params: { alert_type: type, limit } }).then(r => r.data.alerts)

// 전체 시장 스캔
export const fetchFullScanLatest = () => api.get('/scan/full/latest').then(r => r.data)
export const fetchFullScanStatus = () => api.get('/scan/full/status').then(r => r.data)
export const triggerFullScan = () => api.post('/scan/full/trigger').then(r => r.data)
export const fetchFullScanHistory = (limit: number = 10) =>
  api.get('/scan/full/history', { params: { limit } }).then(r => r.data.history)
export const fetchSnapshotBuyItems = (snapshotId: number) =>
  api.get(`/scan/full/snapshot/${snapshotId}/buy-items`).then(r => r.data)

// 재무 데이터
export const fetchFinancials = (symbol: string, market: string) =>
  api.get(`/financials/${symbol}`, { params: { market } }).then(r => r.data)

// 회사 정보 + 확장 투자 지표 (yfinance, KIS 불필요)
export interface CompanyInfo {
  name: string
  logo_url: string | null
  description: string | null
  industry: string | null
  sector: string | null
  country: string | null
  exchange: string | null
  employees: number | null
  website: string | null
}
export interface InvestmentMetrics {
  per: number | null
  pbr: number | null
  roe: number | null
  roa: number | null
  eps: number | null
  bps: number | null
  dividend_yield: number | null
  market_cap: number | null
  operating_margin: number | null
  debt_to_equity: number | null
  currency: 'KRW' | 'USD'
}
export interface RevenueSegment {
  name: string
  revenue: number
  percentage: number
  period: string
}
export type AssetClass = 'STOCK_KR' | 'STOCK_US' | 'ETF' | 'CRYPTO' | 'INDEX' | 'FX'
export interface CompanyInfoResponse {
  company: CompanyInfo | null
  metrics: InvestmentMetrics | null
  revenue_segments: RevenueSegment[] | null
  asset_class: AssetClass
  reporting_period: string | null
  cached_at: string | null
}
export const fetchCompanyInfo = (symbol: string, market: string): Promise<CompanyInfoResponse> =>
  api.get(`/company/${symbol}`, { params: { market } }).then(r => r.data)

// 추세 분석 (024-trend-trading-signals)
export type TrendType = 'uptrend' | 'downtrend' | 'sideways' | 'triangle' | 'unknown' | 'insufficient_data'
export interface TrendLine {
  kind: string
  start: { time: number; price: number }
  end: { time: number; price: number }
  style: { color: string; dashed: boolean }
}
export interface TradingSignal {
  kind: 'buy_candidate' | 'watch' | 'sell_candidate_1' | 'sell_candidate_2'
  price: number | null
  condition: string
  distance_pct: number | null
  is_near: boolean
}
export interface TrendAnalysisResponse {
  symbol: string
  market: string
  classification: {
    type: TrendType
    confidence: number | null
    window_size: number
    slope_high: number | null
    slope_low: number | null
    last_close: number | null
    evaluated_at: string
  }
  lines: TrendLine[]
  buy_signals: TradingSignal[]
  sell_signals: TradingSignal[]
  disclaimer: string
  current_price: number | null
  evaluated_at: string
}
export const fetchTrendAnalysis = (symbol: string, market: string): Promise<TrendAnalysisResponse> =>
  api.get(`/trend-analysis/${symbol}`, { params: { market } }).then(r => r.data)

// 추세선 채널 (033-chart-trendlines)
export interface TrendChannelLine {
  kind: 'hh_main' | 'hl_main' | 'lh_main' | 'll_main'
  start: { time: number; price: number }
  end: { time: number; price: number }
  style: { color: string; dashed: boolean }
}
export interface TrendPhaseStep {
  stage: number
  label: string
  completed: boolean
  completed_time: number | null
  completed_price: number | null
  volume_ratio: number | null
}
export interface SwingPivotInfo {
  direction: 'up' | 'down' | 'none'
  overall_direction: 'up' | 'down' | 'none'
  count: number
  points: Array<{ date: string; price: number }>
  overall_points: Array<{ date: string; price: number }>
}
export interface TrendPeriodResult {
  lines: TrendChannelLine[]
  swing_counts: { high: number; low: number }
  swing_pivots: { high: SwingPivotInfo; low: SwingPivotInfo }
  current_line_prices: {
    hh_main: number | null
    hl_main: number | null
    lh_main: number | null
    ll_main: number | null
  }
  phase: {
    current_stage: number
    steps: TrendPhaseStep[]
    inflection_times: number[]
    insufficient: boolean
    message: string | null
  }
  candle_count: number
}
export interface TrendlineChannelsResponse {
  symbol: string
  market: string
  evaluated_at: string
  periods: {
    '1m': TrendPeriodResult
    '3m': TrendPeriodResult
    '6m': TrendPeriodResult
    '12m': TrendPeriodResult
  }
}
export const fetchTrendlineChannels = (symbol: string, market: string): Promise<TrendlineChannelsResponse> =>
  api.get(`/trendline-channels/${symbol}`, { params: { market } }).then(r => r.data)

// BUY 사인조회 — 전체 스캔 대상 종목 목록 (인증 불필요, 인터셉터 우회)
export const fetchScanSymbols = () => fetch('/api/scan/symbols').then(r => r.json())

// 시가총액 3등분 분포 (KR/US) — BuyList 상단 바
export interface MarketCapTertile {
  rank: 1 | 2 | 3
  count: number
  market_cap_sum: number
  top_symbols: { symbol: string; name: string; market_cap: number }[]
  size_breakdown: { large: number; mid: number; small: number }
  dominant_size: 'large' | 'mid' | 'small' | null
}
export interface MarketCapDistribution {
  currency: 'KRW' | 'USD'
  total_count: number
  total_market_cap: number
  tertiles: MarketCapTertile[]
  median_position_pct: number
  size_thresholds: { large: number; mid: number }
}
export interface MarketCapDistributionResponse {
  kr: MarketCapDistribution
  us: MarketCapDistribution
}
export const fetchMarketCapDistribution = (): Promise<MarketCapDistributionResponse> =>
  fetch('/api/scan/symbols/market-cap-distribution').then(r => r.json())

// 포지션 가이드 (매수 완료 체크 상태)
export interface PositionState {
  symbol: string
  market: string
  completed_stages: number[]
  signal_date: string | null
}
export const getPosition = (symbol: string, market: string = 'KR'): Promise<PositionState> =>
  api.get(`/position/${symbol}`, { params: { market } }).then(r => r.data)
export const updatePosition = (
  symbol: string,
  data: { market: string; completed_stages: number[]; signal_date: string | null },
): Promise<PositionState> =>
  api.put(`/position/${symbol}`, data).then(r => r.data)

// 패턴 케이스 스크랩
export const fetchPatternCases = (params?: { pattern_type?: string; market?: string }) =>
  api.get('/pattern-cases', { params }).then(r => r.data)
export const createPatternCase = (data: any) => api.post('/pattern-cases', data).then(r => r.data)
export const updatePatternCase = (id: number, data: any) => api.patch(`/pattern-cases/${id}`, data).then(r => r.data)
export const deletePatternCase = (id: number) => api.delete(`/pattern-cases/${id}`)
export const checkPatternCaseDuplicate = (symbol: string, signalDate: string) =>
  api.get('/pattern-cases/check', { params: { symbol, signal_date: signalDate } }).then(r => r.data as { exists: boolean; id: number | null })
export const fetchIndicatorsAt = (symbol: string, market: string, date: string) =>
  api.get('/chart/indicators-at', { params: { symbol, market, date } }).then(r => r.data)

// 401 응답 시: 토큰 갱신 후 원래 요청 재시도 → 갱신 실패 시만 signOut
// (비핵심 API는 401이어도 signOut하지 않음 — UX 보호)
const NON_CRITICAL_PATHS = ['/position/']

function isNonCriticalPath(url: string | undefined): boolean {
  if (!url) return false
  return NON_CRITICAL_PATHS.some(p => url.includes(p))
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !data.session) {
          // 갱신 불가: 비핵심 API면 조용히 실패, 그 외엔 로그아웃
          if (!isNonCriticalPath(originalRequest.url)) {
            if (useAuthStore.getState().user) {
              logAuthEvent({ type: 'SILENT_FAILURE', source: 'api_interceptor', url: originalRequest.url, recovered: false, ts: new Date().toISOString() })
            }
            await signOutWithReason('token_refresh_failed', 'api_interceptor', originalRequest.url)
          }
          return Promise.reject(error)
        }
        // 새 토큰으로 원래 요청 재시도
        logAuthEvent({ type: 'TOKEN_REFRESHED', source: 'api_interceptor', ts: new Date().toISOString() })
        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`
        const retryResult = await api(originalRequest)
        logAuthEvent({ type: 'AUTO_RECOVERED', source: 'api_interceptor', url: originalRequest.url, ts: new Date().toISOString() })
        return retryResult
      } catch {
        if (!isNonCriticalPath(originalRequest.url)) {
          if (useAuthStore.getState().user) {
            logAuthEvent({ type: 'SILENT_FAILURE', source: 'api_interceptor', url: originalRequest.url, recovered: false, ts: new Date().toISOString() })
          }
          await signOutWithReason('network_error', 'api_interceptor', originalRequest.url)
        }
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
