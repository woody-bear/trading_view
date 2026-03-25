import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Signal } from '../types'
import { fmtPrice } from '../utils/format'

const sqColors = ['#22c55e', '#eab308', '#f97316', '#ef4444']
const sqLabels = ['NO SQ', 'LOW SQ', 'MID SQ', 'MAX SQ']

export default function SignalCard({ signal: s, index }: { signal: Signal; index?: number }) {
  const nav = useNavigate()
  const sqLvl = s.squeeze_level ?? 0
  const prevPrice = useRef(s.price)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  const trend = s.ema_20 > s.ema_50 && s.ema_50 > s.ema_200 ? 'BULL'
    : s.ema_20 < s.ema_50 && s.ema_50 < s.ema_200 ? 'BEAR' : null

  useEffect(() => {
    if (s.price !== prevPrice.current) {
      setFlash(s.price > prevPrice.current ? 'up' : 'down')
      prevPrice.current = s.price
      const t = setTimeout(() => setFlash(null), 800)
      return () => clearTimeout(t)
    }
  }, [s.price])

  const flashClass = flash === 'up' ? 'animate-pulse text-green-400' : flash === 'down' ? 'animate-pulse text-red-400' : 'text-white'

  return (
    <div
      onClick={() => nav(`/${s.symbol.replace(/\//g, '_')}?market=${s.market}`)}
      className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-4 md:p-2.5 cursor-pointer hover:border-blue-500/50 transition active:scale-[0.98]"
    >
      {/* Row 1: 종목명 + 추세 + 스퀴즈 */}
      <div className="flex items-center justify-between mb-2 md:mb-1">
        <div className="flex items-center gap-2 md:gap-1.5 min-w-0">
          {index != null && (
            <span className="text-xs md:text-[10px] bg-[var(--border)] text-white w-5 h-5 md:w-4 md:h-4 rounded flex items-center justify-center font-mono shrink-0">{index}</span>
          )}
          <span className="text-white font-bold text-[17px] md:text-sm truncate">{s.display_name || s.symbol}</span>
          <span className="text-[var(--muted)] text-xs md:text-[10px] shrink-0">{s.symbol}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {trend === 'BULL' && (
            <span className="text-[11px] md:text-[9px] font-bold text-green-400 bg-green-400/10 px-1.5 md:px-1 py-0.5 rounded">상승추세</span>
          )}
          {trend === 'BEAR' && (
            <span className="text-[11px] md:text-[9px] font-bold text-red-400 bg-red-400/10 px-1.5 md:px-1 py-0.5 rounded">하락추세</span>
          )}
          <div className="flex items-center gap-0.5">
            <div className="w-2.5 h-2.5 md:w-2 md:h-2 rounded-full" style={{ background: sqColors[sqLvl] }} />
            <span className="text-[11px] md:text-[9px] font-bold" style={{ color: sqColors[sqLvl] }}>{sqLabels[sqLvl]}</span>
          </div>
        </div>
      </div>

      {/* Row 2: 가격 + 지표 */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2 md:gap-1.5">
          <span className={`text-xl md:text-sm font-mono font-bold transition-colors duration-300 ${flashClass}`}>
            {fmtPrice(s.price, s.market)}
          </span>
          <span className={`text-[13px] md:text-[10px] font-mono font-semibold ${s.change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {s.change_pct >= 0 ? '+' : ''}{s.change_pct?.toFixed(2)}%
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-2 text-[13px] md:text-[9px]">
          <span className="text-[var(--muted)]">RSI <span className={`font-mono font-semibold ${s.rsi < 30 ? 'text-green-400' : s.rsi > 70 ? 'text-red-400' : 'text-white'}`}>{s.rsi?.toFixed(0)}</span></span>
          <span className="text-[var(--muted)]">%B <span className="font-mono font-semibold text-white">{s.bb_pct_b != null ? (s.bb_pct_b * 100).toFixed(0) : '—'}%</span></span>
          <span className="text-[var(--muted)]">Vol <span className="font-mono font-semibold text-white">{s.volume_ratio?.toFixed(1)}x</span></span>
        </div>
      </div>
    </div>
  )
}
