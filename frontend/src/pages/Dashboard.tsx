import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSymbol, deleteSymbol, fetchBatchPrices, fetchFullScanLatest, fetchFullScanStatus, fetchScanStatus, fetchScanSymbols, fetchSignals, searchSymbols, triggerFullScan } from '../api/client'
import SentimentPanel from '../components/SentimentPanel'
import SignalCard from '../components/SignalCard'
import { usePriceFlash } from '../hooks/usePriceFlash'
import { usePageSwipe } from '../hooks/usePageSwipe'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../stores/toastStore'
import type { Signal } from '../types'
import { fmtPrice } from '../utils/format'
import { indicatorBadges, marketBadge } from '../utils/indicatorLabels'

interface SearchResult {
  symbol: string; name: string; market: string; market_type: string; display: string
}

export default function Dashboard() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { signals, setSignals } = useSignalStore()
  const { user, loading: authLoading } = useAuthStore()
  // authLoading이 끝난 뒤 실행 — 세션 확보 전에 요청하면 토큰 없이 빈 배열 반환됨
  const { data, isLoading } = useQuery<Signal[]>({
    queryKey: ['signals'],
    queryFn: fetchSignals,
    enabled: !authLoading,
  })
  const { addToast } = useToastStore()

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addMsg, setAddMsg] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const snapRef = useRef<HTMLDivElement>(null)
  const [currentSection, setCurrentSection] = useState(0)
  const [mobileScan, setMobileScan] = useState<{ buyItems: any[]; overheatItems: any[]; marketHealth: { dead_cross: number; alive: number; volume_spike?: number; volume_total?: number } | null }>({
    buyItems: [], overheatItems: [], marketHealth: null,
  })
  const [mobileScanTotal, setMobileScanTotal] = useState<number | null>(null)

  const deleteMut = useMutation({
    mutationFn: deleteSymbol,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signals'] }) },
  })

  useEffect(() => { if (data) setSignals(data) }, [data, setSignals])

  // 검색 디바운스
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 1) { setSearchResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      try {
        const r = await searchSymbols(q)
        setSearchResults(r)
        setShowDropdown(true)
      } catch {}
    }, 300)
  }, [searchQuery])

  // 외부 클릭 닫기 (data-search-box 속성으로 모바일/PC 공용 처리)
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('[data-search-box]')) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // 모바일 스냅 레이아웃용 스캔 데이터 로드 (스냅샷 단일 소스)
  useEffect(() => {
    fetchFullScanLatest().then(r => {
      if (r?.status !== 'no_data' && r?.chart_buy) {
        setMobileScan({ buyItems: r.chart_buy?.items || [], overheatItems: r.overheat?.items || [], marketHealth: r.market_health || null })
      }
    }).catch(() => {})
    fetchScanSymbols().then(r => { if (r?.total) setMobileScanTotal(r.total) }).catch(() => {})
  }, [])

  // 모바일 스냅 섹션 인덱스 추적
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

  const handleAddFromSearch = async (r: SearchResult) => {
    if (!user) {
      addToast('error', '관심종목을 추가하려면 로그인이 필요합니다')
      return
    }
    setAdding(r.symbol)
    setAddMsg('')
    try {
      await addSymbol({ market: r.market, symbol: r.symbol, timeframe: '1d' })
      setAddMsg(`${r.name} 추가됨`)
      setSearchQuery('')
      setSearchResults([])
      setShowDropdown(false)
      qc.invalidateQueries({ queryKey: ['signals'] })
      setTimeout(() => setAddMsg(''), 3000)
    } catch (e: any) {
      setAddMsg(e.response?.data?.detail || '추가 실패')
      setTimeout(() => setAddMsg(''), 3000)
    } finally { setAdding(null) }
  }

  const grouped = signals.reduce<Record<string, Signal[]>>((acc, s) => {
    ;(acc[s.market] ??= []).push(s)
    return acc
  }, {})
  const marketLabel: Record<string, string> = { KR: '한국 주식', US: '미국 주식', CRYPTO: '암호화폐' }
  const isMarketOpenLocal = (market: string) => {
    const now = new Date()
    if (market === 'CRYPTO') return true
    if (market === 'KR') {
      const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
      const d = kst.getDay(), h = kst.getHours(), m = kst.getMinutes()
      if (d === 0 || d === 6) return false
      return h >= 9 && (h < 15 || (h === 15 && m <= 30))
    }
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const d = et.getDay(), h = et.getHours(), m = et.getMinutes()
    if (d === 0 || d === 6) return false
    return (h > 9 || (h === 9 && m >= 30)) && h < 16
  }

  // 거래량 내림차순 정렬 헬퍼

  const sH = 'calc(100dvh - 64px)' // 각 스냅 섹션 높이
  usePageSwipe(snapRef)

  // ── 검색 박스 공통 JSX (인라인 사용 — 컴포넌트로 정의하면 매 렌더마다 리마운트됨) ──
  const searchDropdown = showDropdown && searchResults.length > 0
  const searchInputJSX = (mobile: boolean) => (
    <div data-search-box className={`relative ${mobile ? 'px-3 pb-2 shrink-0' : 'mb-3 md:mb-5 sticky top-0 z-30 bg-[var(--bg)] pt-1 pb-1'}`}>
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length && setShowDropdown(true)}
          placeholder="종목 검색 (예: 삼성전자, AAPL, BTC)"
          autoComplete="new-password"
          className="w-full pl-9 pr-8 py-2 bg-[var(--card)] border border-[var(--border)] rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-blue-500/50 focus:outline-none"
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white">
            <X size={14} />
          </button>
        )}
      </div>
      {addMsg && (
        <div className={`mt-2 text-xs px-3 py-1.5 rounded ${addMsg.includes('실패') ? 'text-red-400 bg-red-400/10' : 'text-green-400 bg-green-400/10'}`}>
          {addMsg}
        </div>
      )}
      {searchDropdown && (
        <div className={`absolute z-50 mt-1 bg-[#1e293b] border border-[var(--border)] rounded-lg shadow-xl max-h-64 overflow-y-auto ${mobile ? 'left-3 right-3' : 'w-full'}`}>
          {searchResults.map((r) => (
            <div key={`${r.market}-${r.symbol}`}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--border)] transition">
              <button onClick={() => nav(`/${r.symbol.replace(/\//g, '_')}?market=${r.market_type || r.market}`)}
                className="flex-1 text-left">
                <span className="text-white text-sm">{r.name}</span>
                <span className="text-[var(--muted)] text-xs ml-2">{r.symbol}</span>
                <span className="text-caption text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded ml-2">{r.market_type}</span>
              </button>
              <button onClick={() => handleAddFromSearch(r)} disabled={adding === r.symbol}
                className="shrink-0 ml-3 flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md disabled:opacity-50 transition">
                <Plus size={12} />
                {adding === r.symbol ? '추가 중...' : '추가'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* ══ 모바일: 스냅 스크롤 레이아웃 ══ */}
      <div
        ref={snapRef}
        className="md:hidden fixed inset-x-0 top-0"
        style={{ bottom: '64px', overflowY: 'scroll', scrollSnapType: 'y mandatory', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'none' } as any}
      >
        {/* ── 섹션 1: 시장지표 ── */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapSectionHeader title="시장지표" color="text-blue-400" currentSection={currentSection} />
          <div className="flex-1 overflow-y-auto px-3 pb-2 pt-2" style={{ overscrollBehaviorY: 'contain' } as any}>
            <SentimentPanel />
          </div>
        </div>

        {/* ── 섹션 2: 관심종목 ── */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapSectionHeader title="관심종목" color="text-white" currentSection={currentSection} />
          {searchInputJSX(true)}
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-3" style={{ overscrollBehaviorY: 'contain' } as any}>
            {isLoading && <p className="text-[var(--muted)] text-sm py-8 text-center">로딩 중...</p>}
            {!isLoading && signals.length === 0 && (
              <div className="text-center py-12 text-[var(--muted)]">
                <p className="mb-1">등록된 종목이 없습니다</p>
                <p className="text-xs">위 검색창에서 종목을 추가하세요</p>
              </div>
            )}
            {['KR', 'US', 'CRYPTO'].map((market) =>
              grouped[market] ? (
                <div key={market}>
                  <div className="flex items-center gap-2 mb-2">
                    <h2 className="text-sm font-semibold text-[var(--muted)]">
                      {marketLabel[market]} <span className="opacity-60">({grouped[market].length})</span>
                    </h2>
                    {isMarketOpenLocal(market) ? (
                      <span className="text-caption text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        실시간
                      </span>
                    ) : (
                      <span className="text-caption text-[var(--muted)]">장종료</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {grouped[market].map((s, i) => (
                      <div key={s.watchlist_id} className="relative group">
                        <SignalCard signal={s} index={i + 1} />
                        <button
                          onClick={(e) => { e.stopPropagation(); if (confirm(`${s.display_name || s.symbol} 삭제?`)) deleteMut.mutate(s.watchlist_id) }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-red-500/80 rounded text-white hover:bg-red-600 transition"
                          title="워치리스트에서 삭제">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null
            )}
          </div>
        </div>

        {/* ── 섹션 3: 차트 BUY 신호 ── */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapSectionHeader title="추천 종목" color="text-[var(--buy)]" currentSection={currentSection} />
          <p className="text-body text-[var(--muted)] px-3 py-1 shrink-0">일봉 10거래일 이내 BUY/SQZ BUY · 눌림목(EMA20{'>'}60{'>'}120 + EMA5↓) · 데드크로스 제외</p>
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2" style={{ overscrollBehaviorY: 'contain' } as any}>
            {/* Dead Cross 비율 바 (모바일) */}
            {mobileScan.marketHealth && (mobileScan.marketHealth.dead_cross + mobileScan.marketHealth.alive) > 0 && (() => {
              const mh = mobileScan.marketHealth
              const total = mh.dead_cross + mh.alive
              const labelTotal = mobileScanTotal ?? total
              const alivePct = Math.round(mh.alive / total * 100)
              const deadPct = 100 - alivePct
              return (
                <div className="w-1/2 mb-1">
                  <p className="text-label text-[var(--muted)] mb-1.5">EMA 추세 · {labelTotal.toLocaleString()}종목</p>
                  <div className="relative">
                    <div className="absolute -top-2.5 z-10" style={{ left: `${alivePct}%`, transform: 'translateX(-50%)' }}>
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[var(--muted)]" />
                    </div>
                    <div className="flex h-[5px] rounded-full overflow-hidden">
                      <div className="bg-blue-500 rounded-l-full" style={{ width: `${alivePct}%` }} />
                      <div className="bg-red-500 rounded-r-full" style={{ width: `${deadPct}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-label text-blue-400">정상 {alivePct}%</span>
                    <span className="text-label text-red-400">데드크로스 {deadPct}%</span>
                  </div>
                </div>
              )
            })()}
            {/* 거래량 급증 비율 바 (모바일) */}
            {mobileScan.marketHealth && mobileScan.marketHealth.volume_total && mobileScan.marketHealth.volume_total > 0 && mobileScan.marketHealth.volume_spike != null && (() => {
              const mh = mobileScan.marketHealth!
              const total = mh.volume_total!
              const spike = mh.volume_spike ?? 0
              const spikePct = Math.round(spike / total * 100)
              const restPct = 100 - spikePct
              return (
                <div className="w-1/2 mb-1">
                  <p className="text-label text-[var(--muted)] mb-1.5">거래량 급증 · 10일 내 1봉 이상 · {total.toLocaleString()}종목</p>
                  <div className="relative">
                    <div className="absolute -top-2.5 z-10" style={{ left: `${spikePct}%`, transform: 'translateX(-50%)' }}>
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[var(--muted)]" />
                    </div>
                    <div className="flex h-[5px] rounded-full overflow-hidden">
                      <div className="bg-green-500 rounded-l-full" style={{ width: `${spikePct}%` }} />
                      <div className="bg-slate-600 rounded-r-full" style={{ width: `${restPct}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-label text-green-400">활발 {spikePct}%</span>
                    <span className="text-label text-[var(--muted)]">정체 {restPct}%</span>
                  </div>
                </div>
              )
            })()}
            {mobileScan.buyItems.length === 0 ? (
              <p className="text-[var(--muted)] text-sm py-8 text-center">BUY 신호 종목이 없습니다</p>
            ) : (() => {
              const { mode } = getBuyDisplayMode()
              const items = filterBuyByMode(
                [...mobileScan.buyItems].sort((a: any, b: any) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0)),
                mode
              )
              return items.map((item: any, i: number) => (
                <BuyCard key={item.symbol} item={item} index={i} nav={nav} />
              ))
            })()}
          </div>
        </div>

      </div>

      {/* ══ PC 레이아웃 (모바일 숨김) ══ */}
      <div className="hidden md:block p-3 md:p-6 max-w-7xl mx-auto">
        {searchInputJSX(false)}

        {/* ── 시장 방향성 ── */}
        <SentimentPanel />

        {/* ── 관심종목 ── */}
        <div className="md:bg-[var(--card)] md:border md:border-[var(--border)] md:rounded-xl md:p-5 mb-4">
          <h1 className="text-lg md:text-xl font-bold text-white mb-3">관심종목</h1>
          {isLoading && <p className="text-[var(--muted)] text-sm">로딩 중...</p>}
          {signals.length === 0 && !isLoading && (
            <div className="text-center py-8 text-[var(--muted)]">
              <p className="mb-1">등록된 종목이 없습니다</p>
              <p className="text-xs">위 검색창에서 종목을 추가하세요</p>
            </div>
          )}
          {['KR', 'US', 'CRYPTO'].map((market) =>
            grouped[market] ? (
              <div key={market} className="mb-3 last:mb-0">
                <div className="flex items-center gap-2 mb-2 md:mb-1.5">
                  <h2 className="text-sm md:text-xs font-semibold text-[var(--muted)]">
                    {marketLabel[market]} <span className="opacity-60">({grouped[market].length})</span>
                  </h2>
                  {isMarketOpenLocal(market) ? (
                    <span className="text-caption md:text-micro text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      실시간 가격 반영중
                    </span>
                  ) : (
                    <span className="text-caption md:text-micro text-[var(--muted)]">장종료</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {grouped[market].map((s, i) => (
                    <div key={s.watchlist_id} className="relative group">
                      <SignalCard signal={s} index={i + 1} />
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`${s.display_name || s.symbol} 삭제?`)) deleteMut.mutate(s.watchlist_id) }}
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-red-500/80 rounded text-white hover:bg-red-600 transition"
                        title="워치리스트에서 삭제">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null
          )}
        </div>

        {/* ── 전체 시장 스캔 ── */}
        <div className="border-t border-[var(--border)] my-8" />
        <MarketScanBox nav={nav} qc={qc} />
      </div>
    </>
  )
}

// ══════════════════════════════════════════════════════════════
// ── 모바일 스냅 섹션 헤더 (외부 컴포넌트 — 내부 정의 시 매 렌더마다 리마운트됨) ──
function SnapSectionHeader({ title, color, currentSection, total = 4 }: { title: string; color: string; currentSection: number; total?: number }) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0 border-b border-[var(--border)]/50">
      <h2 className={`text-display font-bold ${color}`}>{title}</h2>
      <div className="flex gap-1.5">
        {Array.from({ length: total }, (_, i) => (
          <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentSection ? `w-4 ${color.replace('text-', 'bg-')}` : 'w-1.5 bg-white/20'}`} />
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ── 장 운영 여부 판단 ──────────────────────────────────────────
function isMarketOpen(market: 'KR' | 'US'): boolean {
  const now = new Date()
  if (market === 'KR') {
    const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    const day = kst.getDay()
    const h = kst.getHours(), m = kst.getMinutes()
    if (day === 0 || day === 6) return false
    return h >= 9 && (h < 15 || (h === 15 && m <= 30))
  }
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const h = et.getHours(), m = et.getMinutes()
  if (day === 0 || day === 6) return false
  return (h > 9 || (h === 9 && m >= 30)) && h < 16
}

function isAllMarketsClosed(): boolean {
  return !isMarketOpen('KR') && !isMarketOpen('US')
}

// ── 시간대별 BUY 신호 표시 모드 ───────────────────────────────
// KR 스캔: 평일 09:30~15:30 KST (매시 :30)  → 코스피200+코스닥150+KRX섹터+국내ETF ~502종목
// US 스캔: 평일 19:50 / 화~토 03:50 KST     → S&P500+나스닥100+Russell1000+미국ETF+암호화폐 ~1041종목
function getKSTHour(): number {
  return (new Date().getUTCHours() + 9) % 24
}
function getKSTWeekday(): number {
  // 0=일 1=월 ... 6=토 (KST 기준)
  const now = new Date()
  const kst = new Date(now.getTime() + 9 * 3600000)
  return kst.getUTCDay()
}

type BuyDisplayMode = 'KR' | 'US' | 'ALL'

function getBuyDisplayMode(): { mode: BuyDisplayMode; label: string } {
  const h = getKSTHour()
  const wd = getKSTWeekday()  // 0=일~6=토
  const isWeekday = wd >= 1 && wd <= 5

  // 시간대에 상관없이 항상 ALL — 스냅샷에서 KR 5 + US 5 전체 표시
  // 라벨만 현재 시간대 컨텍스트 표시용
  if (isWeekday && h >= 9 && h < 16) {
    return { mode: 'ALL', label: '🇰🇷🇺🇸 국내장 · 최근 스캔 기준' }
  }
  if (isWeekday && h >= 19 && h < 23) {
    return { mode: 'ALL', label: '🇰🇷🇺🇸 미국장 · 최근 스캔 기준' }
  }
  return { mode: 'ALL', label: '🇰🇷🇺🇸 최근 스캔 기준' }
}

function filterBuyByMode(items: any[], mode: BuyDisplayMode): any[] {
  const isKR = (i: any) => i.market === 'KR' || i.market_type === 'KOSPI' || i.market_type === 'KOSDAQ'
  const isUS = (i: any) => i.market === 'US'
    || i.market_type === 'NASDAQ' || i.market_type === 'NASDAQ100'
    || i.market_type === 'NYSE' || i.market_type === 'SP500' || i.market_type === 'ETF'
  if (mode === 'US') return items.filter(isUS)
  if (mode === 'KR') {
    const kr = items.filter(isKR)
    const us = items.filter(isUS)
    const usLimit = Math.max(1, Math.round(kr.length * 0.25))  // KR 수의 25% = 전체의 ~20%
    return [...kr, ...us.slice(0, usLimit)]
  }
  return items  // ALL
}

function fmtScanTime(isoStr: string | null | undefined): string {
  if (!isoStr) return ''
  try {
    const d = new Date(isoStr.endsWith('Z') ? isoStr : isoStr + 'Z')
    const kst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
    return `${kst.getMonth() + 1}/${kst.getDate()} ${String(kst.getHours()).padStart(2, '0')}:${String(kst.getMinutes()).padStart(2, '0')}`
  } catch { return '' }
}

// 통합 시장 스캔 박스 (1회 다운로드, 3개 결과 동시 생성)
// ══════════════════════════════════════════════════════════════
export function MarketScanBox({ nav }: { nav: any; qc?: any }) {
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [scanTime, setScanTime] = useState<string | null>(null)
  const autoLoaded = useRef(false)

  const [maxSq] = useState<any>(null)  // 하위 호환용 (제거 예정)
  const [buyItems, setBuyItems] = useState<any[]>([])
  const [overheatItems, setOverheatItems] = useState<any[]>([])
  const [marketHealth, setMarketHealth] = useState<{ dead_cross: number; alive: number; volume_spike?: number; volume_total?: number } | null>(null)
  const [scanSymbolsTotal, setScanSymbolsTotal] = useState<number | null>(null)

  // 섹션 토글 (localStorage 유지)

  // 실시간 가격 캐시: {symbol: {price, change_pct, ...}}
  const [livePrices, setLivePrices] = useState<Record<string, any>>({})
  const priceTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyResult = (result: any) => {
    if (result?.chart_buy) setBuyItems(result.chart_buy.items || [])
    if (result?.overheat) setOverheatItems(result.overheat.items || [])
    if (result?.market_health) setMarketHealth(result.market_health)
    // 마지막 스캔 시각 (full_market_scanner: completed_at, unified_scanner: scan_time)
    const ts = result?.completed_at || result?.scan_time
    if (ts) setScanTime(ts)
  }

  // 스캔 결과에서 모든 종목 심볼 추출
  const extractSymbols = useCallback(() => {
    const syms: { symbol: string; market: string }[] = []
    const seen = new Set<string>()
    const add = (items: any[], marketType?: string) => {
      if (!items) return
      for (const item of items) {
        if (seen.has(item.symbol)) continue
        seen.add(item.symbol)
        const mt = marketType || item.market_type || item.market || 'KR'
        const market = (mt === 'KOSPI' || mt === 'KOSDAQ') ? 'KR' : mt === 'CRYPTO' ? 'CRYPTO' : 'US'
        syms.push({ symbol: item.symbol, market })
      }
    }
    if (maxSq) {
      add(maxSq.kospi, 'KOSPI'); add(maxSq.kosdaq, 'KOSDAQ')
      add(maxSq.us, 'US'); add(maxSq.crypto, 'CRYPTO')
    }
    add(buyItems)
    add(overheatItems)
    return syms
  }, [maxSq, buyItems, overheatItems])

  // 실시간 가격 fetch
  const refreshPrices = useCallback(async () => {
    const syms = extractSymbols()
    // CRYPTO 제외 (한투 API 미지원)
    const filtered = syms.filter(s => s.market !== 'CRYPTO')
    if (filtered.length === 0) return
    try {
      const prices = await fetchBatchPrices(filtered)
      setLivePrices(prev => ({ ...prev, ...prices }))
    } catch {}
  }, [extractSymbols])

  // 스캔 결과 로드 후 실시간 가격 갱신 시작 (10초 간격)
  useEffect(() => {
    const syms = extractSymbols()
    if (syms.length === 0) return
    refreshPrices()
    priceTimer.current = setInterval(refreshPrices, 5_000)
    return () => { if (priceTimer.current) clearInterval(priceTimer.current) }
  }, [maxSq, buyItems, overheatItems])

  const [scanElapsed, setScanElapsed] = useState(0)
  const [fullScanRunning, setFullScanRunning] = useState(false)
  const fullScanPollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const runScan = async () => {
    setScanning(true)
    setScanMsg('전체 시장 스캔 중...')
    setScanElapsed(0)
    const elapsed = { v: 0 }
    const elapsedTimer = setInterval(() => { elapsed.v += 1; setScanElapsed(elapsed.v) }, 1000)
    try {
      await triggerFullScan()
      // full_market_scanner 완료까지 폴링 (최대 10분)
      const maxPolls = 120
      let polls = 0
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          polls++
          if (polls > maxPolls) { clearInterval(poll); reject(new Error('timeout')); return }
          try {
            const status = await fetchFullScanStatus()
            if (!status.running) { clearInterval(poll); resolve() }
          } catch { /* 폴링 실패 무시, 계속 */ }
        }, 5000)
      })
      const result = await fetchFullScanLatest()
      applyResult(result)
      setScanMsg('스캔 완료')
      setTimeout(() => setScanMsg(''), 3000)
    } catch { setScanMsg('스캔 실패') }
    finally { clearInterval(elapsedTimer); setScanning(false); setScanElapsed(0) }
  }

  // 마운트 시: 스캔 대상 종목 수 로드 (EMA 추세 라벨용 — 항상 최신 정의 기준)
  useEffect(() => {
    fetchScanSymbols().then(r => { if (r?.total) setScanSymbolsTotal(r.total) }).catch(() => {})
  }, [])

  // 마운트 시: full_market_scanner 스냅샷 로드 (단일 소스)
  useEffect(() => {
    if (autoLoaded.current) return
    autoLoaded.current = true

    // 스냅샷 단일 소스
    const loadData: Promise<boolean> = fetchFullScanLatest().catch(() => null).then(full => {
      const fullHasData = full?.status !== 'no_data' && full?.chart_buy
      if (fullHasData) {
        applyResult(full)
        return true as boolean
      }
      return false as boolean
    })

    // 스캔 상태 + 데이터 로드를 함께 기다린 후 스캔 실행 여부 결정
    // → fetchScanStatus 실패만으로 runScan()을 트리거하지 않음 (레이스 컨디션 방지)
    Promise.all([loadData, fetchScanStatus().catch(() => null)])
      .then(([hasData, status]) => {
        if (!status) return  // API 오류 시 스캔 미실행
        if (status.scan_time) setScanTime(status.scan_time)
        if (status.scanning) {
          setScanning(true)
          setScanMsg('전체 시장 스캔 중...')
          setScanElapsed(status.elapsed_seconds || 0)
        } else if (!hasData) {
          // 데이터가 전혀 없을 때만 스캔 실행
          runScan()
        }
      })

    // full market scan 진행 중 확인 → 실시간 chart_buy 폴링
    fetchFullScanStatus().then(fs => {
      if (fs?.running) setFullScanRunning(true)
    }).catch(() => {})
  }, [])

  // 스캔 중일 때 상태 폴링 (3초 간격)
  useEffect(() => {
    if (!scanning) return
    const poll = setInterval(async () => {
      try {
        const status = await fetchScanStatus()
        setScanElapsed(status.elapsed_seconds || 0)
        if (!status.scanning) {
          // 스캔 완료 — 결과 로드 (full_market_scanner 우선)
          setScanning(false)
          setScanElapsed(0)
          try {
            const full = await fetchFullScanLatest()
            if (full?.status !== 'no_data' && full?.chart_buy) {
              applyResult(full)
            }
          } catch { /* 결과 로드 실패 무시 */ }
          setScanMsg('스캔 완료')
          setTimeout(() => setScanMsg(''), 3000)
          clearInterval(poll)
        }
      } catch {}
    }, 3000)
    return () => clearInterval(poll)
  }, [scanning])

  // full market scan 진행 중일 때 5초마다 chart_buy 실시간 업데이트
  useEffect(() => {
    if (!fullScanRunning) {
      if (fullScanPollTimer.current) { clearInterval(fullScanPollTimer.current); fullScanPollTimer.current = null }
      return
    }
    fullScanPollTimer.current = setInterval(async () => {
      try {
        const fs = await fetchFullScanStatus()
        if (!fs?.running) {
          setFullScanRunning(false)
          return
        }
        const snap = await fetchFullScanLatest()
        if (snap?.chart_buy) setBuyItems(snap.chart_buy.items || [])
      } catch {}
    }, 5000)
    return () => { if (fullScanPollTimer.current) clearInterval(fullScanPollTimer.current) }
  }, [fullScanRunning])

  const allClosed = isAllMarketsClosed()

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base md:text-xl font-bold text-white">전체 시장 스캔</h1>
          {allClosed && !scanning && (
            <span className="text-caption font-semibold text-slate-300 bg-slate-600/40 border border-slate-500/40 px-2 py-0.5 rounded-full">
              장 종료
            </span>
          )}
          {scanTime && !scanning && (
            <span className="text-caption text-[var(--muted)]">
              마지막 스캔: {fmtScanTime(scanTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scanMsg && <span className="text-caption text-green-400 bg-green-400/10 px-2 py-1 rounded">{scanMsg}</span>}
          <button onClick={runScan} disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs disabled:opacity-50 transition">
            <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
            {scanning ? '스캔 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {scanning && buyItems.length === 0 && (
        <div className="text-center py-8 text-[var(--muted)]">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-orange-400" />
          <p className="text-sm">전체 시장 스캔 중... {scanElapsed > 0 ? `(${scanElapsed}초 경과)` : '(약 30초~1분)'}</p>
        </div>
      )}
      {scanning && buyItems.length > 0 && (
        <div className="flex items-center gap-2 mb-3 px-2 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-lg">
          <RefreshCw size={14} className="animate-spin text-orange-400" />
          <span className="text-xs text-orange-400">스캔 진행 중... {scanElapsed > 0 ? `(${scanElapsed}초)` : ''}</span>
        </div>
      )}

      {/* 1. 차트 BUY 신호 */}
      {(() => {
        const { mode, label } = getBuyDisplayMode()
        const displayItems = filterBuyByMode(
          [...buyItems].sort((a: any, b: any) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0)),
          mode
        )
        return (
          <div className="mb-2">
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <h2 className="text-sm font-bold text-[var(--buy)]">추천 종목</h2>
              <span className="text-micro text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded">일봉 10거래일 이내 + 데드크로스 제외 + 거래량 5일 평균 1.5배↑</span>
              <span className="text-micro px-1.5 py-0.5 rounded font-medium bg-[var(--bg)] text-[var(--muted)]">{label}</span>
              {Object.keys(livePrices).length > 0 && (
                <span className="text-micro text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  실시간 가격 반영중
                </span>
              )}
            </div>
            {/* Dead Cross 비율 바 */}
            {marketHealth && (marketHealth.dead_cross + marketHealth.alive) > 0 && (() => {
              const total = marketHealth.dead_cross + marketHealth.alive
              const labelTotal = scanSymbolsTotal ?? total
              const alivePct = Math.round(marketHealth.alive / total * 100)
              const deadPct = 100 - alivePct
              return (
                <div className="w-1/2 mb-3">
                  <p className="text-caption text-[var(--muted)] mb-1.5">EMA 추세 · {labelTotal.toLocaleString()}종목</p>
                  <div className="relative">
                    <div className="absolute -top-2.5 z-10" style={{ left: `${alivePct}%`, transform: 'translateX(-50%)' }}>
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[var(--muted)]" />
                    </div>
                    <div className="flex h-[5px] rounded-full overflow-hidden">
                      <div className="bg-blue-500 rounded-l-full" style={{ width: `${alivePct}%` }} />
                      <div className="bg-red-500 rounded-r-full" style={{ width: `${deadPct}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-caption text-blue-400">정상 {alivePct}%</span>
                    <span className="text-caption text-red-400">데드크로스 {deadPct}%</span>
                  </div>
                </div>
              )
            })()}
            {/* 거래량 급증 비율 바 — 10거래일 이내 1봉이라도 (당일 거래량 > 5일 평균 × 1.5) */}
            {marketHealth && marketHealth.volume_total && marketHealth.volume_total > 0 && marketHealth.volume_spike != null && (() => {
              const total = marketHealth.volume_total!
              const spike = marketHealth.volume_spike ?? 0
              const spikePct = Math.round(spike / total * 100)
              const restPct = 100 - spikePct
              return (
                <div className="w-1/2 mb-3">
                  <p className="text-caption text-[var(--muted)] mb-1.5">거래량 급증 · 10일 내 1봉 이상 · {total.toLocaleString()}종목</p>
                  <div className="relative">
                    <div className="absolute -top-2.5 z-10" style={{ left: `${spikePct}%`, transform: 'translateX(-50%)' }}>
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[var(--muted)]" />
                    </div>
                    <div className="flex h-[5px] rounded-full overflow-hidden">
                      <div className="bg-green-500 rounded-l-full" style={{ width: `${spikePct}%` }} />
                      <div className="bg-slate-600 rounded-r-full" style={{ width: `${restPct}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-caption text-green-400">활발 {spikePct}%</span>
                    <span className="text-caption text-[var(--muted)]">정체 {restPct}%</span>
                  </div>
                </div>
              )
            })()}
            {displayItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {displayItems.map((item: any, i: number) => (
                  <BuyCard key={item.symbol} item={item} index={i} livePrice={livePrices[item.symbol]} nav={nav} />
                ))}
              </div>
            ) : !scanning ? (
              <p className="text-[var(--muted)] text-xs text-center py-4">10거래일 이내 BUY 신호 종목이 없습니다</p>
            ) : null}
          </div>
        )
      })()}



    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BuyCard — 차트 BUY 신호 카드 (가격 깜빡임)
// ══════════════════════════════════════════════════════════════
function BuyCard({ item, index, livePrice, nav }: { item: any; index: number; livePrice?: any; nav: any }) {
  const price = livePrice?.price ?? item.price
  const pct = livePrice?.change_pct ?? item.change_pct
  const { flashClass } = usePriceFlash(price)

  // 지표 라벨 — 공유 유틸리티 사용 (bb_pct_b: 0-100 스케일 → 0-1로 변환)
  const mktBadge = marketBadge(item.market_type || item.market)
  const signalBadge = item.last_signal === 'SQZ BUY'
    ? { label: '스퀴즈해소', cls: 'text-cyan-400 bg-cyan-400/10', priority: 1 }
    : { label: 'BB반전', cls: 'text-[var(--buy)] bg-[var(--buy)]/10', priority: 1 }
  const indicators = indicatorBadges({
    squeeze_level: item.squeeze_level,
    rsi: item.rsi,
    bb_pct_b: item.bb_pct_b != null ? item.bb_pct_b / 100 : undefined,
    volume_ratio: item.volume_ratio,
    macd_hist: item.macd_hist,
  })
  const reasons = [mktBadge, signalBadge, ...indicators]

  return (
    <div onClick={() => nav(`/${item.symbol.replace(/\//g, '_')}?market=${item.market_type || item.market}`, { state: { buySignal: item } })}
      className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3.5 md:p-2.5 cursor-pointer hover:border-green-500/50 transition active:scale-[0.98]">
      <div className="flex items-center justify-between mb-1.5 md:mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-label md:text-caption bg-[var(--border)] text-white w-5 h-5 md:w-4 md:h-4 rounded flex items-center justify-center font-mono">{index + 1}</span>
          <span className="text-white font-semibold text-title md:text-sm truncate">{item.display_name || item.name}</span>
          <span className="text-[var(--muted)] text-body md:text-caption shrink-0">{item.symbol}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.trend === 'BULL' && (
            <span className="text-body md:text-micro font-bold text-[var(--buy)] bg-[var(--buy)]/10 px-1.5 md:px-1 py-0.5 rounded">상승추세</span>
          )}
          <span className={`text-body md:text-micro font-bold px-1.5 md:px-1 py-0.5 rounded ${
            item.last_signal === 'SQZ BUY' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[var(--buy)]/20 text-[var(--buy)]'
          }`}>{item.last_signal}</span>
        </div>
      </div>
      <div className="md:flex md:items-center md:justify-between mt-1 md:mt-0">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-value md:text-sm font-mono font-semibold transition-colors duration-300 ${flashClass}`}>
            {fmtPrice(price, item.market)}
          </span>
          <span className={`text-label md:text-caption font-mono ${pct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
            {pct >= 0 ? '+' : ''}{pct}%
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-2 text-body md:text-micro mt-1 md:mt-0">
          <span className="text-[var(--muted)]">{item.last_signal_date}</span>
          {item.rsi != null && <span className="text-[var(--muted)]">RSI <span className="text-white font-mono font-semibold">{item.rsi?.toFixed(0)}</span></span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 md:gap-1 mt-2 md:mt-1">
        {reasons.map(r => (
          <span key={r.label} className={`text-label md:text-micro px-2 md:px-1.5 py-0.5 rounded ${r.cls}`}>
            {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}
