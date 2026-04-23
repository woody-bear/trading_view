/* SQZ Terminal — SignalCard (Phase 9 redesign)
   원본 디자인: /tmp/design_extract/asst/project/pc-dashboard.jsx SignalCard
   기존 호출 시그니처(signal, index) 유지. 새탭 클릭, 가격 flash 동작 보존. */

import { memo, useEffect, useRef, useState } from 'react'
import type { Signal } from '../types'
import Spark from './charts/Spark'
import { fmt } from '../utils/format'
import { fmtPrice } from '../utils/format'
import { indicatorBadges, marketBadge } from '../utils/indicatorLabels'

function deriveSignalChip(s: Signal): { label: string; cls: string } {
  const sq = s.squeeze_level ?? 0
  const state = s.signal_state
  if (state === 'BUY' && sq >= 1) return { label: 'SQZ BUY', cls: 'chip chip-mag' }
  if (state === 'BUY')              return { label: 'BUY',     cls: 'chip chip-up' }
  if (state === 'SELL' && sq >= 1) return { label: 'SQZ SELL', cls: 'chip chip-down' }
  if (state === 'SELL')             return { label: 'SELL',    cls: 'chip chip-down' }
  return { label: 'WATCH', cls: 'chip chip-ghost' }
}

function deriveTrendLabel(s: Signal): { label: string; color: string } {
  const bull = s.ema_20 > s.ema_50 && s.ema_50 > s.ema_200
  const bear = s.ema_20 < s.ema_50 && s.ema_50 < s.ema_200
  if (bull) return { label: '상승', color: 'var(--up)' }
  if (bear) return { label: '하락', color: 'var(--down)' }
  return { label: '중립', color: 'var(--fg-2)' }
}

function SignalCardImpl({
  signal: s,
  index,
  compact,
  sparkData,
}: {
  signal: Signal
  index?: number
  compact?: boolean
  sparkData?: number[]
}) {
  const prevPrice = useRef(s.price)
  const [flash, setFlash] = useState<'up' | 'down' | null>(null)

  useEffect(() => {
    if (s.price !== prevPrice.current) {
      setFlash(s.price > prevPrice.current ? 'up' : 'down')
      prevPrice.current = s.price
      const t = setTimeout(() => setFlash(null), 800)
      return () => clearTimeout(t)
    }
  }, [s.price])

  const signal = deriveSignalChip(s)
  const trend = deriveTrendLabel(s)
  const market = marketBadge(s.market_type || s.market)
  const tags = indicatorBadges({
    squeeze_level: s.squeeze_level,
    rsi: s.rsi,
    bb_pct_b: s.bb_pct_b,
    volume_ratio: s.volume_ratio,
    macd_hist: s.macd_hist,
  })

  const hasSpark = sparkData && sparkData.length >= 2
  const sparkUp = (s.change_pct ?? 0) >= 0

  const flashColor =
    flash === 'up' ? 'var(--up)' :
    flash === 'down' ? 'var(--down)' :
    'var(--fg-0)'

  const handleClick = () => {
    window.open(`/${s.symbol.replace(/\//g, '_')}?market=${s.market}`, '_blank')
  }

  return (
    <div
      onClick={handleClick}
      className="panel cursor-pointer"
      style={{
        padding: 0,
        background: 'var(--bg-1)',
        transition: 'border-color 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {/* Header — 순위·종목명·코드·시장 칩 + 신호 칩 */}
      <div
        className="flex items-center"
        style={{
          padding: '8px 12px',
          gap: 8,
          borderBottom: '1px solid var(--border)',
          minWidth: 0,
        }}
      >
        {index != null && (
          <span
            style={{
              fontSize: 10,
              fontFamily: 'var(--font-mono)',
              fontWeight: 700,
              color: 'var(--fg-3)',
              width: 18,
              flexShrink: 0,
            }}
          >
            {String(index).padStart(2, '0')}
          </span>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="truncate"
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}
            >
              {s.display_name || s.symbol}
            </span>
            <span
              style={{
                fontSize: 10.5,
                color: 'var(--fg-3)',
                fontFamily: 'var(--font-mono)',
                flexShrink: 0,
              }}
            >
              {s.symbol}
            </span>
            {market && <span className="chip chip-ghost" style={{ flexShrink: 0 }}>{market.label}</span>}
          </div>
        </div>
        <span className={signal.cls} style={{ flexShrink: 0 }}>
          {signal.label}
        </span>
      </div>

      {/* Body */}
      {compact ? (
        /* 모바일 compact: 가격 + Spark(실제 5일) + RSI/Trend */
        <div style={{ padding: '8px 12px' }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <div style={{ minWidth: 80 }}>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 600, color: flashColor, transition: 'color 0.3s' }}>
                {fmtPrice(s.price, s.market)}
              </div>
              <div style={{ fontSize: 11, color: sparkUp ? 'var(--up)' : 'var(--down)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {sparkUp ? '▲' : '▼'} {fmt.pct(s.change_pct ?? 0)}
              </div>
            </div>
            {hasSpark && (
              <Spark data={sparkData!} w={72} h={28} color={sparkUp ? 'var(--up)' : 'var(--down)'} />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center" style={{ gap: 8, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', flexWrap: 'wrap' }}>
                {s.rsi != null && (
                  <span>RSI <span style={{ color: s.rsi > 60 ? 'var(--warn)' : s.rsi < 30 ? 'var(--up)' : 'var(--fg-0)' }}>{s.rsi.toFixed(0)}</span></span>
                )}
                <span>Trend <span style={{ color: trend.color }}>{trend.label}</span></span>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap" style={{ gap: 3, marginTop: 4 }}>
                  {tags.map(t => (
                    <span key={t.label} className="chip chip-ghost" style={{ fontSize: 9 }}>{t.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* PC full: 가격 + Spark(실제 5일, 90×36) + RSI/Trend + tags */
        <div className="flex items-center" style={{ padding: '10px 12px', gap: 14 }}>
          <div style={{ minWidth: 95 }}>
            <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600, color: flashColor, transition: 'color 0.3s' }}>
              {fmtPrice(s.price, s.market)}
            </div>
            <div style={{ fontSize: 11, color: s.change_pct >= 0 ? 'var(--up)' : 'var(--down)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {s.change_pct >= 0 ? '▲' : '▼'} {fmt.pct(s.change_pct ?? 0)}
            </div>
          </div>
          {hasSpark && (
            <div style={{ width: 90, flexShrink: 0 }}>
              <Spark data={sparkData!} w={90} h={36} color={sparkUp ? 'var(--up)' : 'var(--down)'} responsive />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center" style={{ gap: 10, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              {s.rsi != null && (
                <span>RSI <span style={{ color: s.rsi > 60 ? 'var(--warn)' : s.rsi < 30 ? 'var(--up)' : 'var(--fg-0)' }}>{s.rsi.toFixed(0)}</span></span>
              )}
              <span>Trend <span style={{ color: trend.color }}>{trend.label}</span></span>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 4, marginTop: 6 }}>
                {tags.map(t => (
                  <span key={t.label} className="chip chip-ghost" style={{ fontSize: 9.5 }}>{t.label}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const SignalCard = memo(SignalCardImpl) as typeof SignalCardImpl
export default SignalCard
