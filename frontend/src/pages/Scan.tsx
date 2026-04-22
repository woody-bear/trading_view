import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFullScanLatest } from '../api/client'
import { MarketScanBox, SectorGrouped } from './Dashboard'
import { usePageSwipe } from '../hooks/usePageSwipe'

const SECTIONS = [
  { key: 'buy',      label: '추천종목', color: 'var(--up)' },
  { key: 'pullback', label: '눌림목',   color: 'var(--warn)' },
  { key: 'largecap', label: '대형주',   color: 'var(--accent)' },
]

function ScanSectionHeader({ idx, currentSection, onDotClick }: {
  idx: number; currentSection: number; onDotClick: (i: number) => void
}) {
  const sec = SECTIONS[idx]
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0 border-b" style={{ borderColor: 'var(--border)' }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: sec.color, fontFamily: 'var(--font-sans)' }}>
        {sec.label}
      </h2>
      <div style={{
        display: 'flex', gap: 5, alignItems: 'center',
        background: 'color-mix(in oklch, var(--bg-2), transparent 30%)',
        borderRadius: 8, padding: '4px 8px',
      }}>
        {SECTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onDotClick(i)}
            title={s.label}
            style={{
              height: 8, borderRadius: 4, transition: 'all 0.2s',
              width: i === currentSection ? 22 : 8,
              background: i === currentSection ? s.color : 'color-mix(in oklch, var(--fg-0), transparent 55%)',
              border: 'none', padding: 0, cursor: 'pointer',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ScanSkeleton() {
  const sk = (w: number | string, h: number, r = 4) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />
  )
  return (
    <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 섹터 헤더 1 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        {sk(80, 11, 3)}
        {sk(24, 11, 3)}
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      {/* 카드 3개 */}
      {[0,1,2].map(i => (
        <div key={i} className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {sk('45%', 14, 3)}
            {sk('18%', 11, 3)}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {sk(28, 18, 3)}
            {sk(24, 10, 3)}
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {sk(36, 10, 3)}{sk(36, 10, 3)}{sk(48, 10, 3)}
          </div>
        </div>
      ))}
      {/* 섹터 헤더 2 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
        {sk(64, 11, 3)}
        {sk(24, 11, 3)}
        <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
      </div>
      {/* 카드 2개 */}
      {[0,1].map(i => (
        <div key={i} className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {sk('40%', 14, 3)}
            {sk('20%', 11, 3)}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {sk(28, 18, 3)}
            {sk(24, 10, 3)}
          </div>
          <div style={{ display: 'flex', gap: 5 }}>
            {sk(36, 10, 3)}{sk(48, 10, 3)}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Scan() {
  const nav = useNavigate()
  const qc = useQueryClient()
  const snapRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)

  const [scanData, setScanData] = useState<{
    buyItems: any[]; pullbackItems: any[]; buyTotal: number | null
  }>({ buyItems: [], pullbackItems: [], buyTotal: null })
  const [scanLoading, setScanLoading] = useState(true)

  useEffect(() => {
    fetchFullScanLatest().then(r => {
      if (r?.status !== 'no_data' && r?.chart_buy) {
        setScanData({
          buyItems: r.chart_buy?.items || [],
          pullbackItems: r.pullback_buy?.items || [],
          buyTotal: r.chart_buy?.total ?? null,
        })
      }
    }).catch(() => {}).finally(() => setScanLoading(false))
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

  const scrollToSection = (idx: number) => {
    const el = snapRef.current
    if (!el) return
    el.scrollTo({ top: idx * el.clientHeight, behavior: 'smooth' })
  }

  const sortedBuy = useMemo(() =>
    [...scanData.buyItems].sort((a, b) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0)),
    [scanData.buyItems]
  )
  const sortedPullback = useMemo(() =>
    [...scanData.pullbackItems].sort((a, b) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0)),
    [scanData.pullbackItems]
  )
  const largeCapItems = useMemo(() =>
    scanData.buyItems.filter(i => i.is_large_cap)
      .sort((a, b) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0)),
    [scanData.buyItems]
  )

  return (
    <>
      {/* ── 모바일: 스냅 3섹션 ── */}
      <div
        ref={snapRef}
        className="md:hidden fixed inset-x-0 top-0"
        style={{ bottom: 64, overflowY: 'scroll', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' } as any}
      >
        {/* ── 섹션 0: 추천종목 ── */}
        <div className="flex flex-col" style={{ height: sH, scrollSnapAlign: 'start', background: 'var(--bg-0)' }}>
          <ScanSectionHeader idx={0} currentSection={currentSection} onDotClick={scrollToSection} />
          <div style={{ padding: '6px 12px', display: 'flex', gap: 8, flexShrink: 0 }}>
            {scanData.buyTotal != null && <span className="chip chip-up">{scanData.buyTotal}</span>}
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>20거래일 이내 BUY/SQZ BUY</span>
          </div>
          <div className="flex-1 overflow-y-auto pb-2" style={{ overscrollBehaviorY: 'contain' } as any}>
            {scanLoading
              ? <ScanSkeleton />
              : sortedBuy.length === 0
                ? <p style={{ color: 'var(--fg-3)', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>BUY 신호 종목이 없습니다</p>
                : <div className="px-3"><SectorGrouped items={sortedBuy} livePrices={{}} compact /></div>
            }
          </div>
        </div>

        {/* ── 섹션 1: 눌림목 ── */}
        <div className="flex flex-col" style={{ height: sH, scrollSnapAlign: 'start', background: 'var(--bg-0)' }}>
          <ScanSectionHeader idx={1} currentSection={currentSection} onDotClick={scrollToSection} />
          <p style={{ fontSize: 11, color: 'var(--fg-3)', padding: '4px 12px 6px', flexShrink: 0 }}>
            EMA20&gt;60&gt;120 + EMA5↓ + 대형주
          </p>
          <div className="flex-1 overflow-y-auto pb-2" style={{ overscrollBehaviorY: 'contain' } as any}>
            {scanLoading
              ? <ScanSkeleton />
              : sortedPullback.length === 0
                ? <p style={{ color: 'var(--fg-3)', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>눌림목 종목이 없습니다</p>
                : <div className="px-3"><SectorGrouped items={sortedPullback} livePrices={{}} compact /></div>
            }
          </div>
        </div>

        {/* ── 섹션 2: 대형주 ── */}
        <div className="flex flex-col" style={{ height: sH, scrollSnapAlign: 'start', background: 'var(--bg-0)' }}>
          <ScanSectionHeader idx={2} currentSection={currentSection} onDotClick={scrollToSection} />
          <p style={{ fontSize: 11, color: 'var(--fg-3)', padding: '4px 12px 6px', flexShrink: 0 }}>
            추천종목 중 KOSPI200·KOSDAQ150·S&P500
          </p>
          <div className="flex-1 overflow-y-auto pb-2" style={{ overscrollBehaviorY: 'contain' } as any}>
            {scanLoading
              ? <ScanSkeleton />
              : largeCapItems.length === 0
                ? <p style={{ color: 'var(--fg-3)', fontSize: 13, textAlign: 'center', padding: '48px 0' }}>대형주 BUY 신호 종목이 없습니다</p>
                : <div className="px-3"><SectorGrouped items={largeCapItems} livePrices={{}} compact /></div>
            }
          </div>
        </div>
      </div>

      {/* ── PC 레이아웃 ── */}
      <div className="hidden md:block p-3 md:p-6 max-w-7xl mx-auto">
        <MarketScanBox nav={nav} qc={qc} />
      </div>
    </>
  )
}
