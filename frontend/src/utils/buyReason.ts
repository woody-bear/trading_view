export interface BuySignalItem {
  last_signal: 'BUY' | 'SQZ BUY' | string
  last_signal_date?: string  // 'YYYY-MM-DD'
  rsi?: number
  volume_ratio?: number
  macd_hist?: number
  squeeze_level?: number     // 0=방금 해소, 1~3=압축중
  trend?: 'BULL' | 'BEAR' | 'NEUTRAL' | string
  symbol?: string
  name?: string
  display_name?: string
  market_type?: string
  market?: string
  bb_pct_b?: number
  price?: number
  change_pct?: number
}

export interface ReasonPart {
  text: string
  highlight?: boolean  // true이면 var(--buy) 색상 + font-bold 적용
}

export type BuyReason = ReasonPart[]

export interface NavigateState {
  buySignal?: BuySignalItem
  _snapStart?: 'last'
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  const parts = dateStr.split('-')
  if (parts.length < 3) return ''
  return ` (${parts[1]}-${parts[2]})`
}

function vol(v: number): string {
  return `${v.toFixed(1)}배`
}

export function generateBuyReason(item: BuySignalItem): BuyReason {
  const dateSuffix = formatDate(item.last_signal_date)
  const datePart: ReasonPart[] = dateSuffix ? [{ text: dateSuffix }] : []

  if (item.last_signal === 'SQZ BUY') {
    if (item.trend === 'BULL' && item.volume_ratio != null && item.volume_ratio >= 2) {
      return [
        { text: '스퀴즈 압축이 해소되며 상승추세에서 거래량이 ' },
        { text: vol(item.volume_ratio), highlight: true },
        { text: ' 급증했습니다' },
        ...datePart,
      ]
    }
    if (item.trend === 'BULL') {
      return [
        { text: '스퀴즈 압축이 해소되며 상승추세에서 매수 모멘텀이 시작됐습니다' },
        ...datePart,
      ]
    }
    return [
      { text: '스퀴즈 압축이 해소되며 반등 모멘텀이 발생했습니다' },
      ...datePart,
    ]
  }

  if (item.last_signal === 'BUY') {
    const rsi = item.rsi
    const volRatio = item.volume_ratio
    const macd = item.macd_hist

    // rsi < 30 + BULL + vol >= 2
    if (rsi != null && rsi < 30 && item.trend === 'BULL' && volRatio != null && volRatio >= 2) {
      return [
        { text: 'RSI ' },
        { text: String(Math.round(rsi)), highlight: true },
        { text: ' 강한 과매도 + 거래량 ' },
        { text: vol(volRatio), highlight: true },
        { text: ' 급증 + 상승추세 BB 반등' },
        ...datePart,
      ]
    }

    // rsi < 30 + BULL
    if (rsi != null && rsi < 30 && item.trend === 'BULL') {
      return [
        { text: 'RSI ' },
        { text: String(Math.round(rsi)), highlight: true },
        { text: ' 강한 과매도 구간에서 BB 하단 반등 · 상승추세 유지' },
        ...datePart,
      ]
    }

    // vol >= 2 + macd > 0
    if (volRatio != null && volRatio >= 2 && macd != null && macd > 0) {
      return [
        { text: 'RSI ' },
        { text: rsi != null ? String(Math.round(rsi)) : '–', highlight: rsi != null },
        { text: ' 과매도 + 거래량 ' },
        { text: vol(volRatio), highlight: true },
        { text: ' 급증 + MACD 상향 · 복합 매수 신호' },
        ...datePart,
      ]
    }

    // vol >= 2
    if (volRatio != null && volRatio >= 2) {
      return [
        { text: 'RSI ' },
        { text: rsi != null ? String(Math.round(rsi)) : '–', highlight: rsi != null },
        { text: ' 과매도 구간에서 거래량이 ' },
        { text: vol(volRatio), highlight: true },
        { text: ' 급증하며 BB 하단 반등' },
        ...datePart,
      ]
    }

    // macd > 0
    if (macd != null && macd > 0) {
      return [
        { text: 'RSI ' },
        { text: rsi != null ? String(Math.round(rsi)) : '–', highlight: rsi != null },
        { text: ' 과매도 + BB 하단 반등 + MACD 상향 전환이 확인됐습니다' },
        ...datePart,
      ]
    }

    // trend BULL
    if (item.trend === 'BULL') {
      return [
        { text: 'RSI ' },
        { text: rsi != null ? String(Math.round(rsi)) : '–', highlight: rsi != null },
        { text: ' 과매도 구간에서 BB 하단 반등 · 상승추세 유지' },
        ...datePart,
      ]
    }

    // default
    if (rsi != null) {
      return [
        { text: 'RSI ' },
        { text: String(Math.round(rsi)), highlight: true },
        { text: ' 과매도 구간에서 볼린저 밴드 하단을 되돌리며 반등 신호 발생' },
        ...datePart,
      ]
    }
  }

  // Fallback
  return [
    { text: 'BUY 신호가 감지됐습니다' },
    ...datePart,
  ]
}
