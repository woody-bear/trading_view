export interface Badge {
  label: string
  cls: string
  priority: number
}

export interface IndicatorData {
  squeeze_level?: number
  rsi?: number
  bb_pct_b?: number
  volume_ratio?: number
  macd_hist?: number
}

export function marketBadge(marketType: string): Badge {
  const map: Record<string, { label: string; cls: string }> = {
    KOSPI: { label: 'KOSPI', cls: 'text-blue-300 bg-blue-500/15' },
    KOSDAQ: { label: 'KOSDAQ', cls: 'text-purple-300 bg-purple-500/15' },
    NASDAQ100: { label: 'NQ100', cls: 'text-blue-400 bg-blue-400/15' },
    SP500: { label: 'S&P500', cls: 'text-emerald-300 bg-emerald-500/15' },
    RUSSELL1000: { label: 'R1000', cls: 'text-orange-300 bg-orange-400/15' },
    CRYPTO: { label: 'CRYPTO', cls: 'text-yellow-300 bg-yellow-400/15' },
  }
  const m = map[marketType] ?? { label: marketType || '시장', cls: 'text-slate-300 bg-slate-500/15' }
  return { label: m.label, cls: m.cls, priority: 0 }
}

export function signalStrengthBadge(state: string, grade: string): Badge | null {
  if (state === 'BUY' && grade === 'STRONG')
    return { label: 'STRONG BUY', cls: 'text-[var(--buy)] bg-[var(--buy)]/15 border border-[var(--buy)]/30', priority: 1 }
  if (state === 'BUY' && grade === 'WEAK')
    return { label: 'WEAK BUY', cls: 'text-[var(--buy)] bg-[var(--buy)]/10', priority: 1 }
  if (state === 'SELL' && grade === 'STRONG')
    return { label: 'STRONG SELL', cls: 'text-[var(--sell)] bg-[var(--sell)]/15 border border-[var(--sell)]/30', priority: 1 }
  if (state === 'SELL' && grade === 'WEAK')
    return { label: 'WEAK SELL', cls: 'text-[var(--sell)] bg-[var(--sell)]/10', priority: 1 }
  return null
}

export function indicatorBadges(data: IndicatorData, maxCount = 4): Badge[] {
  const badges: Badge[] = []

  const sq = data.squeeze_level ?? 0
  if (sq >= 3) badges.push({ label: 'MAX SQ', cls: 'text-[var(--sell)] bg-[var(--sell)]/10', priority: 10 })
  else if (sq >= 2) badges.push({ label: 'MID SQ', cls: 'text-orange-400 bg-orange-400/10', priority: 11 })
  else if (sq >= 1) badges.push({ label: 'LOW SQ', cls: 'text-yellow-400 bg-yellow-400/10', priority: 12 })

  const rsi = data.rsi
  if (rsi !== undefined && rsi !== null) {
    if (rsi < 30) badges.push({ label: 'RSI 과매도', cls: 'text-emerald-400 bg-emerald-400/10', priority: 20 })
    else if (rsi > 70) badges.push({ label: 'RSI 과매수', cls: 'text-[var(--sell)] bg-[var(--sell)]/10', priority: 21 })
    else if (rsi <= 45) badges.push({ label: 'RSI 낮음', cls: 'text-blue-400 bg-blue-400/10', priority: 22 })
  }

  const bb = data.bb_pct_b
  if (bb !== undefined && bb !== null) {
    if (bb < 0.2) badges.push({ label: 'BB 하단', cls: 'text-cyan-400 bg-cyan-400/10', priority: 30 })
    else if (bb > 0.8) badges.push({ label: 'BB 상단', cls: 'text-orange-400 bg-orange-400/10', priority: 31 })
  }

  const vol = data.volume_ratio
  if (vol !== undefined && vol !== null) {
    if (vol >= 3) badges.push({ label: '거래량 폭증', cls: 'text-purple-400 bg-purple-400/10', priority: 40 })
    else if (vol >= 2) badges.push({ label: '거래량 급증', cls: 'text-purple-300 bg-purple-300/10', priority: 41 })
  }

  if ((data.macd_hist ?? 0) > 0)
    badges.push({ label: 'MACD↑', cls: 'text-teal-400 bg-teal-400/10', priority: 50 })

  return badges.sort((a, b) => a.priority - b.priority).slice(0, maxCount)
}
