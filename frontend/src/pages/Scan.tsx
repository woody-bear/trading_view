import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { MarketScanBox } from './Dashboard'
import { fetchFullScanLatest, fetchUnifiedCache } from '../api/client'
import { usePageSwipe } from '../hooks/usePageSwipe'

function SnapHdr({ title, color, currentSection, total }: {
  title: string; color: string; currentSection: number; total: number
}) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0 border-b border-[var(--border)]/50">
      <h2 className={`text-[34px] font-bold ${color}`}>{title}</h2>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${
            i === currentSection
              ? `w-4 ${color.replace('text-', 'bg-')}`
              : 'w-1.5 bg-white/20'
          }`} />
        ))}
      </div>
    </div>
  )
}

export default function Scan() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const snapRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [scanData, setScanData] = useState<{
    buyItems: any[]; overheatItems: any[]
  }>({ buyItems: [], overheatItems: [] })

  useEffect(() => {
    fetchFullScanLatest()
      .then(r => {
        if (r?.status !== 'no_data' && r?.chart_buy) {
          setScanData({
            buyItems: r.chart_buy?.items || [],
            overheatItems: r.overheat?.items || [],
          })
        } else {
          fetchUnifiedCache().then(r2 => {
            setScanData({
              buyItems: r2?.chart_buy?.items || [],
              overheatItems: r2?.overheat?.items || [],
            })
          }).catch(() => {})
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const el = snapRef.current
    if (!el) return
    const onScroll = () => {
      const h = el.clientHeight
      if (h > 0) setCurrentSection(Math.round(el.scrollTop / h))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const sH = 'calc(100dvh - 64px)'
  usePageSwipe(snapRef)

  const byVol = (arr: any[]) => [...arr].sort((a, b) => (b.volume_ratio || 0) - (a.volume_ratio || 0))

  return (
    <>
      {/* ── Mobile snap layout ── */}
      <div
        ref={snapRef}
        className="md:hidden fixed inset-x-0 top-0"
        style={{ bottom: '64px', overflowY: 'scroll', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' } as any}
      >
        {/* Section 1: 차트 BUY 신호 */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapHdr title="차트 BUY 신호" color="text-[var(--buy)]" currentSection={currentSection} total={2} />
          <div
            className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-2"
            style={{ overscrollBehaviorY: 'contain' } as any}>
            {scanData.buyItems.length === 0 ? (
              <div className="text-center py-12 text-[var(--muted)] text-sm">BUY 신호 데이터가 없습니다</div>
            ) : scanData.buyItems.map((item, i) => (
              <div
                key={item.symbol}
                onClick={() => nav(`/${item.symbol}?market=${item.market_type || item.market || 'KR'}`, { state: { buySignal: item } })}
                className="bg-[var(--card)] border border-[var(--buy)]/20 rounded-xl p-4 cursor-pointer hover:border-[var(--buy)]/50 transition active:scale-[0.98]"
              >
                {/* 헤더: 순위 + 이름 + BUY 뱃지 */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[11px] bg-[var(--border)] text-[var(--text)] w-5 h-5 rounded flex items-center justify-center font-mono shrink-0">{i + 1}</span>
                    <span className="text-[var(--text)] font-semibold text-[22px] truncate">{item.display_name || item.name || item.symbol}</span>
                    <span className="text-[var(--muted)] text-[17px] shrink-0">{item.symbol}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.trend === 'BULL' && <span className="text-[15px] font-bold text-[var(--buy)] bg-[var(--buy)]/10 px-1.5 py-0.5 rounded">상승추세</span>}
                    <span className="text-[17px] text-[var(--buy)] bg-[var(--buy)]/10 px-2 py-0.5 rounded font-bold">BUY</span>
                  </div>
                </div>
                {/* 가격 행 */}
                {(item.price > 0 || item.change_pct != null) && (
                  <div className="flex items-baseline gap-2 mb-2">
                    {item.price > 0 && <span className="text-[18px] font-mono font-bold text-[var(--text)]">{item.price?.toLocaleString()}</span>}
                    {item.change_pct != null && (
                      <span className={`text-[13px] font-mono font-semibold ${item.change_pct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
                        {item.change_pct >= 0 ? '+' : ''}{item.change_pct}%
                      </span>
                    )}
                  </div>
                )}
                {/* 지표 행 */}
                <div className="flex items-center gap-3 text-[18px]">
                  {item.rsi != null && <span className="text-[var(--muted)]">RSI <span className="text-[var(--text)] font-mono font-semibold">{Number(item.rsi).toFixed(0)}</span></span>}
                  {item.volume_ratio != null && <span className="text-[var(--muted)]">거래량 <span className="text-[var(--text)] font-mono font-semibold">{Number(item.volume_ratio).toFixed(1)}x</span></span>}
                  {item.signal_date && <span className="text-[var(--muted)] ml-auto">신호일: {item.signal_date}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 2: 투자과열 */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapHdr title="투자과열 종목" color="text-orange-400" currentSection={currentSection} total={2} />
          <div
            className="flex-1 overflow-y-auto px-3 pb-3 pt-2 space-y-2"
            style={{ overscrollBehaviorY: 'contain' } as any}>
            {scanData.overheatItems.length === 0 ? (
              <div className="text-center py-12 text-[var(--muted)] text-sm">투자과열 데이터가 없습니다</div>
            ) : byVol(scanData.overheatItems).slice(0, 5).map((item, i) => (
              <div
                key={item.symbol}
                onClick={() => nav(`/${item.symbol}?market=${item.market_type || item.market || 'KR'}`)}
                className="bg-[var(--card)] border border-orange-500/20 rounded-lg p-3 cursor-pointer hover:border-orange-500/50 transition active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] bg-[var(--border)] text-white w-5 h-5 rounded flex items-center justify-center font-mono shrink-0">{i + 1}</span>
                    <span className="text-white font-bold text-[21px] truncate">{item.display_name || item.name || item.symbol}</span>
                    <span className="text-[var(--muted)] text-[15px] shrink-0">{item.symbol}</span>
                  </div>
                  {item.rsi != null && (
                    <span className="text-[15px] text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded font-mono shrink-0">
                      RSI {item.rsi.toFixed(0)}
                    </span>
                  )}
                </div>
                {item.volume_ratio != null && (
                  <div className="text-[15px] text-[var(--muted)] mt-1.5">거래량 {item.volume_ratio.toFixed(1)}x</div>
                )}
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── PC layout ── */}
      <div className="hidden md:block p-3 md:p-6 max-w-7xl mx-auto">
        <MarketScanBox nav={nav} qc={qc} />
      </div>
    </>
  )
}
