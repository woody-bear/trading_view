/* SQZ Terminal — WatchlistPanel (Phase 10, PC 전용)
   원본: /tmp/design_extract/asst/project/pc-dashboard.jsx WatchlistPanel
   디자인은 SignalCard 보다 단순한 미니 카드(스타·종목명·가격·태그)를 사용. */

import { Minus } from 'lucide-react'
import type { Signal } from '../types'
import { fmt } from '../utils/format'
import { fmtPrice } from '../utils/format'
import { indicatorBadges } from '../utils/indicatorLabels'

interface Props {
  signals: Signal[]
  isLoading: boolean
  isOpen: boolean
  onToggle: () => void
  onDelete: (watchlistId: number, displayName: string) => void
  isMarketOpenLocal: (market: string) => boolean
}

const SECTION_DEF: { key: string; label: string; flag: string }[] = [
  { key: 'KR',     label: '국내종목',   flag: '🇰🇷' },
  { key: 'US',     label: '해외종목',   flag: '🇺🇸' },
  { key: 'CRYPTO', label: '암호화폐',   flag: '₿' },
]

function deriveSignalTag(s: Signal): string | null {
  const sq = s.squeeze_level ?? 0
  if (s.signal_state === 'BUY' && sq >= 1) return 'SQZ BUY'
  if (s.signal_state === 'BUY')             return 'BUY'
  if (s.signal_state === 'SELL' && sq >= 1) return 'SQZ SELL'
  if (s.signal_state === 'SELL')            return 'SELL'
  return null
}

function deriveTrendTag(s: Signal): string | null {
  const bull = s.ema_20 > s.ema_50 && s.ema_50 > s.ema_200
  const bear = s.ema_20 < s.ema_50 && s.ema_50 < s.ema_200
  if (bull) return '상승'
  if (bear) return '하락'
  return null
}

function tagStyle(tag: string): { bg: string; fg: string } {
  if (tag === 'BUY' || tag === 'SQZ BUY' || tag === '추천' || tag === '상승' || tag === 'RSI 과매도')
    return { bg: 'var(--up-bg)', fg: 'var(--up)' }
  if (tag === 'SELL' || tag === 'SQZ SELL' || tag === '하락' || tag === 'RSI 과매수' || tag === 'BB 상단')
    return { bg: 'var(--down-bg)', fg: 'var(--down)' }
  if (tag.includes('눌림목') || tag.includes('SQ') || tag === 'MACD↑')
    return { bg: 'var(--warn-bg)', fg: 'var(--warn)' }
  if (tag.includes('대형') || tag === 'BB 하단')
    return { bg: 'var(--accent-bg)', fg: 'var(--accent)' }
  return { bg: 'var(--bg-2)', fg: 'var(--fg-3)' }
}

function MiniWatchCard({
  s,
  onDelete,
}: {
  s: Signal
  onDelete: (id: number, name: string) => void
}) {
  const sigTag = deriveSignalTag(s)
  const trendTag = deriveTrendTag(s)
  const indicators = indicatorBadges({
    squeeze_level: s.squeeze_level,
    rsi: s.rsi,
    bb_pct_b: s.bb_pct_b,
    volume_ratio: s.volume_ratio,
    macd_hist: s.macd_hist,
  })

  // Tag composition: primary signal → trend → top 2 indicators
  const tags: string[] = []
  if (sigTag) tags.push(sigTag)
  if (trendTag) tags.push(trendTag)
  for (const ind of indicators.slice(0, 4 - tags.length)) {
    if (!tags.includes(ind.label)) tags.push(ind.label)
  }

  const handleClick = () => {
    window.open(`/${s.symbol.replace(/\//g, '_')}?market=${s.market}`, '_blank')
  }

  return (
    <div
      onClick={handleClick}
      className="cursor-pointer relative group"
      style={{
        padding: '10px 12px',
        borderRadius: 4,
        background: 'var(--bg-1)',
        border: '1px solid var(--border)',
        transition: 'border-color 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div className="flex items-center" style={{ gap: 6, marginBottom: 6, minWidth: 0 }}>
        <span style={{ fontSize: 10, color: 'var(--fg-4)', flexShrink: 0 }}>☆</span>
        <span
          className="truncate flex-1"
          style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }}
        >
          {s.display_name || s.symbol}
        </span>
        <span
          style={{
            fontSize: 10,
            color: 'var(--fg-3)',
            fontFamily: 'var(--font-mono)',
            flexShrink: 0,
          }}
        >
          {s.symbol}
        </span>
      </div>
      <div className="flex items-baseline" style={{ gap: 8, marginBottom: 6 }}>
        <span
          style={{
            fontSize: 16,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: 'var(--fg-0)',
          }}
        >
          {fmtPrice(s.price, s.market)}
        </span>
        <span
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-mono)',
            fontWeight: 600,
            color: s.change_pct >= 0 ? 'var(--up)' : 'var(--down)',
          }}
        >
          {s.change_pct >= 0 ? '▲' : '▼'} {fmt.pct(s.change_pct ?? 0)}
        </span>
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap" style={{ gap: 3 }}>
          {tags.map(t => {
            const st = tagStyle(t)
            return (
              <span
                key={t}
                style={{
                  padding: '1px 6px',
                  borderRadius: 2,
                  background: st.bg,
                  color: st.fg,
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {t}
              </span>
            )
          })}
        </div>
      )}

      <button
        onClick={e => {
          e.stopPropagation()
          if (confirm(`${s.display_name || s.symbol} 삭제?`)) {
            onDelete(s.watchlist_id, s.display_name || s.symbol)
          }
        }}
        className="absolute opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          top: 5,
          right: 5,
          width: 18,
          height: 18,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-3)',
          color: 'var(--fg-2)',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          fontFamily: 'var(--font-mono)',
          fontSize: 14,
          fontWeight: 700,
          lineHeight: 1,
        }}
        title="워치리스트에서 삭제"
      >
        <Minus size={10} />
      </button>
    </div>
  )
}

function WatchlistSkeleton() {
  const sk = (w: number | string, h: number, r = 4) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />
  )
  const miniCard = (i: number) => (
    <div key={i} className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {sk(10, 10, 2)}
        {sk('60%', 13, 3)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        {sk('45%', 16, 3)}
        {sk('25%', 11, 3)}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {sk(30, 10, 2)}{sk(30, 10, 2)}{sk(38, 10, 2)}
      </div>
    </div>
  )
  const section = (count: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sk(80, 11, 3)}
        {sk(22, 11, 3)}
        {sk(30, 11, 3)}
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {Array.from({ length: count }).map((_, i) => miniCard(i))}
      </div>
    </div>
  )
  return (
    <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
      {section(3)}
      {section(3)}
    </div>
  )
}

export default function WatchlistPanel({
  signals,
  isLoading,
  isOpen,
  onToggle,
  onDelete,
  isMarketOpenLocal,
}: Props) {
  const grouped = signals.reduce<Record<string, Signal[]>>((acc, s) => {
    ;(acc[s.market] ??= []).push(s)
    return acc
  }, {})

  const totalCount = signals.length

  return (
    <div className="panel" style={{ padding: 0 }}>
      {/* Header */}
      <div
        className="flex justify-between items-center"
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="flex items-center" style={{ gap: 10 }}>
          <button
            onClick={onToggle}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-3)',
              cursor: 'pointer',
              padding: 0,
              fontSize: 11,
              fontFamily: 'var(--font-mono)',
            }}
            aria-label={isOpen ? '접기' : '펼치기'}
          >
            {isOpen ? '▾' : '▸'}
          </button>
          <div className="label">관심종목</div>
          <span className="chip chip-ghost">{totalCount}</span>
        </div>
      </div>

      {/* Body */}
      {isOpen && (
        <div
          className="flex flex-col"
          style={{ padding: 14, gap: 14 }}
        >
          {isLoading && <WatchlistSkeleton />}
          {!isLoading && totalCount === 0 && (
            <div style={{ color: 'var(--fg-3)', fontSize: 12, textAlign: 'center', padding: 16 }}>
              <div style={{ marginBottom: 4, color: 'var(--fg-2)' }}>등록된 종목이 없습니다</div>
              <div style={{ fontSize: 11 }}>상단 검색창 또는 + ADD 버튼으로 종목을 추가하세요</div>
            </div>
          )}
          {SECTION_DEF.map(sec => {
            const items = grouped[sec.key]
            if (!items || items.length === 0) return null
            const open = isMarketOpenLocal(sec.key)
            return (
              <div key={sec.key}>
                <div
                  className="flex items-center"
                  style={{ gap: 8, marginBottom: 8 }}
                >
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: 'var(--fg-2)',
                      fontFamily: 'var(--font-mono)',
                      letterSpacing: '0.08em',
                    }}
                  >
                    {sec.flag} {sec.label}
                  </span>
                  <span className="chip chip-ghost">{items.length}</span>
                  {open ? (
                    <span
                      className="chip chip-up"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      ● LIVE
                    </span>
                  ) : (
                    <span
                      className="chip chip-ghost"
                      style={{ fontFamily: 'var(--font-mono)' }}
                    >
                      장종료
                    </span>
                  )}
                  <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
                </div>
                <div
                  className="grid"
                  style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}
                >
                  {items.map(s => (
                    <MiniWatchCard key={s.watchlist_id} s={s} onDelete={onDelete} />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
