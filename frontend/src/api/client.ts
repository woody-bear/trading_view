import axios from 'axios'

const api = axios.create({ baseURL: '/api' })

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

// 한국투자증권
export const getKIS = () => api.get('/settings/kis').then(r => r.data)
export const setKIS = (data: { app_key: string; app_secret: string; account_no: string; paper_trading: boolean }) =>
  api.put('/settings/kis', data).then(r => r.data)
export const testKIS = () => api.post('/settings/kis/test').then(r => r.data)

// BUY 신호 알림
export const testBuyAlert = () => api.post('/alerts/buy-signal/test').then(r => r.data)
export const fetchAlertHistory = (type: string = 'scheduled_buy', limit: number = 20) =>
  api.get('/alerts/history', { params: { alert_type: type, limit } }).then(r => r.data.alerts)

// 재무 데이터
export const fetchFinancials = (symbol: string, market: string) =>
  api.get(`/financials/${symbol}`, { params: { market } }).then(r => r.data)

export default api
