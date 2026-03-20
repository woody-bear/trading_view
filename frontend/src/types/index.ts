export interface WatchlistItem {
  id: number
  market: string
  symbol: string
  display_name: string | null
  timeframe: string
  data_source: string
  is_active: boolean
  created_at: string
}

export interface Signal {
  watchlist_id: number
  symbol: string
  display_name: string | null
  market: string
  signal_state: 'BUY' | 'SELL' | 'NEUTRAL'
  confidence: number
  signal_grade: string
  price: number
  change_pct: number
  rsi: number
  bb_pct_b: number
  bb_width: number
  squeeze_level: number
  macd_hist: number
  volume_ratio: number
  ema_20: number
  ema_50: number
  ema_200: number
  updated_at: string
}

export interface ChartData {
  symbol: string
  display_name: string
  timeframe: string
  candles: { time: number; open: number; high: number; low: number; close: number; volume: number }[]
  indicators: Record<string, { time: number; value: number }[]>
  squeeze_dots: { time: number; value: number; color: string; level: number }[]
  markers: { time: number; position: string; color: string; shape: string; text: string }[]
  current: {
    pct_b: number | null
    bandwidth: number | null
    rsi: number | null
    squeeze: string
    squeeze_level: number
    trend: string
  } | null
}
