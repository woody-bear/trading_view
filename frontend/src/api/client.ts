import axios from 'axios'
import { supabase } from '../lib/supabase'

const api = axios.create({ baseURL: '/api' })

// Bearer 토큰 자동 주입 (Supabase 초기화 지연에도 블록되지 않도록 타임아웃 보호)
api.interceptors.request.use(async (config) => {
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000)),
    ])
    const session = result && 'data' in result ? result.data.session : null
    if (session?.access_token) {
      config.headers.Authorization = `Bearer ${session.access_token}`
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
export const fetchQuickChart = (symbol: string, market: string, timeframe?: string) =>
  api.get('/chart/quick', { params: { symbol, market, timeframe: timeframe || '1d' } }).then(r => r.data)
export const fetchHealth = () => api.get('/health').then(r => r.data)

// 시장 스캔
export const scanMarket = (topN: number = 3) =>
  api.post(`/scan/market?top_n=${topN}`).then(r => r.data)
export const scanMaxSqueeze = (topN: number = 5) =>
  api.post(`/scan/market?top_n=${topN}&min_squeeze=3`).then(r => r.data)
export const fetchLatestPicks = () =>
  api.get('/scan/market/latest').then(r => r.data)

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
export interface CompanyInfoResponse {
  company: CompanyInfo | null
  metrics: InvestmentMetrics | null
  revenue_segments: RevenueSegment[] | null
  cached_at: string | null
}
export const fetchCompanyInfo = (symbol: string, market: string): Promise<CompanyInfoResponse> =>
  api.get(`/company/${symbol}`, { params: { market } }).then(r => r.data)

// BUY 사인조회 — 전체 스캔 대상 종목 목록 (인증 불필요, 인터셉터 우회)
export const fetchScanSymbols = () => fetch('/api/scan/symbols').then(r => r.json())

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
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const { data, error: refreshError } = await supabase.auth.refreshSession()
        if (refreshError || !data.session) {
          // 갱신 불가 → 로그아웃 (로그인 버튼 표시)
          await supabase.auth.signOut()
          return Promise.reject(error)
        }
        // 새 토큰으로 원래 요청 재시도
        originalRequest.headers.Authorization = `Bearer ${data.session.access_token}`
        return api(originalRequest)
      } catch {
        await supabase.auth.signOut()
        return Promise.reject(error)
      }
    }
    return Promise.reject(error)
  }
)

export default api
