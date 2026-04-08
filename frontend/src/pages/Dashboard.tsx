import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Plus, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSymbol, deleteSymbol, fetchBatchPrices, fetchFullScanLatest, fetchFullScanStatus, fetchScanStatus, fetchSignals, fetchUnifiedCache, runUnifiedScan, searchSymbols } from '../api/client'
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

const sqColors: Record<number, string> = { 0: '#22c55e', 1: '#eab308', 2: '#f97316', 3: '#ef4444' }
const sqLabels: Record<number, string> = { 0: 'NO SQ', 1: 'LOW SQ', 2: 'MID SQ', 3: 'MAX SQ' }

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
  const [mobileScan, setMobileScan] = useState<{ buyItems: any[]; overheatItems: any[]; picks: any | null }>({
    buyItems: [], overheatItems: [], picks: null,
  })

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

  // 모바일 스냅 레이아웃용 스캔 데이터 로드
  useEffect(() => {
    fetchFullScanLatest().then(r => {
      if (r?.status !== 'no_data' && r?.picks) {
        setMobileScan({ buyItems: r.chart_buy?.items || [], overheatItems: r.overheat?.items || [], picks: r.picks })
      } else {
        fetchUnifiedCache().then(r2 => {
          setMobileScan({ buyItems: r2?.chart_buy?.items || [], overheatItems: r2?.overheat?.items || [], picks: r2?.picks || null })
        }).catch(() => {})
      }
    }).catch(() => {})
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
  const byVolume = (arr: any[]) => [...arr].sort((a, b) => (b.volume_ratio || 0) - (a.volume_ratio || 0))

  // 추천 종목 병합 (모바일용) — 코스피 2, 코스닥 2, 미국 1, 암호화폐 제외
  const allPicks: any[] = mobileScan.picks ? [
    ...byVolume(mobileScan.picks.kospi || []).slice(0, 2),
    ...byVolume(mobileScan.picks.kosdaq || []).slice(0, 2),
    ...byVolume(mobileScan.picks.us || []).slice(0, 1),
  ] : []

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
                <span className="text-[10px] text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded ml-2">{r.market_type}</span>
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
          <SnapSectionHeader title="관심종목" color="text-white" currentSection={currentSection} total={5} />
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
                      <span className="text-[10px] text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                        실시간
                      </span>
                    ) : (
                      <span className="text-[10px] text-[var(--muted)]">장종료</span>
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
          <SnapSectionHeader title="차트 BUY 신호" color="text-[var(--buy)]" currentSection={currentSection} />
          <p className="text-[15px] text-[var(--muted)] px-3 py-1 shrink-0">일봉 3일 이내 · 데드크로스 제외 · 거래량 5일 평균 1.5배↑</p>
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2" style={{ overscrollBehaviorY: 'contain' } as any}>
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

        {/* ── 섹션 3: 투자과열 ── */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapSectionHeader title="투자과열 신호" color="text-[var(--sell)]" currentSection={currentSection} />
          <p className="text-[15px] text-[var(--muted)] px-3 py-1 shrink-0">RSI 70+ 또는 RSI 65+ 거래량 2x · 국내 개별주</p>
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2" style={{ overscrollBehaviorY: 'contain' } as any}>
            {mobileScan.overheatItems.length === 0 ? (
              <p className="text-[var(--muted)] text-sm py-8 text-center">투자과열 종목이 없습니다</p>
            ) : byVolume(mobileScan.overheatItems).slice(0, 5).map((item: any, i: number) => (
              <div key={item.symbol}
                onClick={() => nav(`/${item.symbol}?market=${item.market_type || item.market}`)}
                className="bg-[var(--card)] border border-red-500/30 rounded-lg p-4 cursor-pointer hover:border-red-500/60 transition active:scale-[0.98]">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-[11px] bg-[var(--sell)]/20 text-[var(--sell)] w-5 h-5 rounded flex items-center justify-center font-mono shrink-0">{i + 1}</span>
                    <span className="text-[var(--text)] font-semibold text-base truncate">{item.name}</span>
                    <span className="text-[var(--muted)] text-xs shrink-0">{item.symbol}</span>
                  </div>
                  <span className="text-[15px] font-bold text-[var(--sell)] bg-[var(--sell)]/20 px-2 py-0.5 rounded shrink-0">과열</span>
                </div>
                <div className="flex items-baseline gap-2 mb-1.5">
                  <span className="text-xl font-mono font-bold text-[var(--text)]">{item.price?.toLocaleString()}</span>
                  <span className={`text-sm font-mono font-semibold ${item.change_pct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
                    {item.change_pct >= 0 ? '+' : ''}{item.change_pct}%
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[18px] mb-2">
                  <span className="text-[var(--sell)] font-bold">RSI {item.rsi?.toFixed(0)}</span>
                  <span className="text-[var(--muted)]">거래량 <span className="text-white font-mono">{item.volume_ratio?.toFixed(1)}x</span></span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[marketBadge(item.market_type || item.market), ...indicatorBadges({
                    rsi: item.rsi,
                    bb_pct_b: item.bb_pct_b != null ? item.bb_pct_b / 100 : undefined,
                    volume_ratio: item.volume_ratio,
                    macd_hist: item.macd_hist,
                  })].map(b => (
                    <span key={b.label} className={`text-[18px] px-2 py-0.5 rounded ${b.cls}`}>{b.label}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── 섹션 4: 추천 종목 ── */}
        <div className="flex flex-col bg-[var(--bg)]" style={{ height: sH, scrollSnapAlign: 'start' }}>
          <SnapSectionHeader title="추천 종목" color="text-orange-400" currentSection={currentSection} />
          <p className="text-[15px] text-[var(--muted)] px-3 py-1 shrink-0">스퀴즈 + 상승추세 + 데드크로스 제외 · 시장별 Top 15</p>
          <div className="flex-1 overflow-y-auto px-3 pb-2 space-y-2" style={{ overscrollBehaviorY: 'contain' } as any}>
            {allPicks.length === 0 ? (
              <p className="text-[var(--muted)] text-sm py-8 text-center">추천 종목이 없습니다</p>
            ) : allPicks.map((p: any, i: number) => (
              <PickCard key={p.symbol} p={p} index={i}
                onAdd={(p, e) => {
                  e.stopPropagation()
                  const market = (p.market_type === 'KOSPI' || p.market_type === 'KOSDAQ') ? 'KR' : 'US'
                  addSymbol({ market, symbol: p.symbol, timeframe: '1d' })
                    .then(() => qc.invalidateQueries({ queryKey: ['signals'] }))
                    .catch(() => {})
                }}
                onNavigate={(p) => nav(`/${p.symbol.replace(/\//g, '_')}?market=${p.market_type || 'KR'}`)}
                adding={false} added={false}
              />
            ))}
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
                    <span className="text-[10px] md:text-[9px] text-green-400 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                      실시간 가격 반영중
                    </span>
                  ) : (
                    <span className="text-[10px] md:text-[9px] text-[var(--muted)]">장종료</span>
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
function SnapSectionHeader({ title, color, currentSection, total = 5 }: { title: string; color: string; currentSection: number; total?: number }) {
  return (
    <div className="flex items-center justify-between px-3 pt-3 pb-2 shrink-0 border-b border-[var(--border)]/50">
      <h2 className={`text-[34px] font-bold ${color}`}>{title}</h2>
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
  const m = new Date().getUTCMinutes()  // KST분 = UTC분
  const wd = getKSTWeekday()  // 0=일~6=토
  const isWeekday = wd >= 1 && wd <= 5
  const isTueSat = wd >= 2 && wd <= 6

  // 국내장 스캔 시간 (평일 09:30~16:10, 최근 슬롯 계산)
  if (isWeekday && h >= 9 && h < 17) {
    const krSlots = [9, 10, 11, 12, 13, 14, 15]
    const nowMin = h * 60 + m
    const lastSlot = krSlots.filter(sh => sh * 60 + 30 <= nowMin).pop()
    const slotLabel = lastSlot !== undefined ? `${lastSlot}:30 스캔 · ` : ''
    return { mode: 'KR', label: `🇰🇷 국내장 · ${slotLabel}코스피200+코스닥150+국내ETF` }
  }

  // 미국 저녁 스캔 시간대 (평일 19:50 전후)
  if (isWeekday && h >= 19 && h < 23) {
    return { mode: 'US', label: '🇺🇸 미국장 · 19:50 스캔 · S&P500+나스닥100' }
  }

  // 미국 새벽 스캔 시간대 (화~토 03:50 전후, 00:00~07:00)
  if (isTueSat && h < 7) {
    return { mode: 'US', label: '🇺🇸 미국장 · 03:50 스캔 · S&P500+나스닥100' }
  }

  // 전환 시간 (장 마감 후, 미국 스캔 전: 17:00~19:50)
  if (h >= 17 && h < 20) {
    return { mode: 'ALL', label: '전체 · 국내 마감 후 대기중 (미국 스캔 19:50)' }
  }

  // 기본: 미국장 데이터 기준 (주말 등)
  return { mode: 'US', label: '🇺🇸 미국장 · 최근 스캔 기준' }
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
export function MarketScanBox({ nav, qc }: { nav: any; qc: any }) {
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [scanTime, setScanTime] = useState<string | null>(null)
  const autoLoaded = useRef(false)

  const [picks, setPicks] = useState<any>(null)
  const [maxSq] = useState<any>(null)  // 하위 호환용 (제거 예정)
  const [buyItems, setBuyItems] = useState<any[]>([])
  const [overheatItems, setOverheatItems] = useState<any[]>([])

  // 섹션 토글 (localStorage 유지)
  const [showPicks, setShowPicks] = useState(() => localStorage.getItem('dash_showPicks') === 'true')
  const togglePicks = () => { setShowPicks(v => { localStorage.setItem('dash_showPicks', String(!v)); return !v }) }
  const [showOverheat, setShowOverheat] = useState(() => localStorage.getItem('dash_showOverheat') === 'true')
  const toggleOverheat = () => { setShowOverheat(v => { localStorage.setItem('dash_showOverheat', String(!v)); return !v }) }

  // 실시간 가격 캐시: {symbol: {price, change_pct, ...}}
  const [livePrices, setLivePrices] = useState<Record<string, any>>({})
  const priceTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyResult = (result: any) => {
    if (result?.picks) setPicks(result.picks)
    // max_sq는 picks에 통합됨
    if (result?.chart_buy) setBuyItems(result.chart_buy.items || [])
    if (result?.overheat) setOverheatItems(result.overheat.items || [])
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
    if (picks) {
      add(picks.kospi, 'KOSPI'); add(picks.kosdaq, 'KOSDAQ')
      add(picks.us, 'US'); add(picks.crypto, 'CRYPTO')
    }
    if (maxSq) {
      add(maxSq.kospi, 'KOSPI'); add(maxSq.kosdaq, 'KOSDAQ')
      add(maxSq.us, 'US'); add(maxSq.crypto, 'CRYPTO')
    }
    add(buyItems)
    add(overheatItems)
    return syms
  }, [picks, maxSq, buyItems, overheatItems])

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
  }, [picks, maxSq, buyItems, overheatItems])

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
      await runUnifiedScan()
      // 백그라운드 스캔 완료까지 폴링 (최대 10분)
      const maxPolls = 120
      let polls = 0
      await new Promise<void>((resolve, reject) => {
        const poll = setInterval(async () => {
          polls++
          if (polls > maxPolls) { clearInterval(poll); reject(new Error('timeout')); return }
          try {
            const status = await fetchScanStatus()
            if (!status.scanning) { clearInterval(poll); resolve() }
          } catch { /* 폴링 실패 무시, 계속 */ }
        }, 5000)
      })
      const result = await fetchUnifiedCache()
      applyResult(result)
      setScanMsg('스캔 완료')
      setTimeout(() => setScanMsg(''), 3000)
    } catch { setScanMsg('스캔 실패') }
    finally { clearInterval(elapsedTimer); setScanning(false); setScanElapsed(0) }
  }

  // 마운트 시: full_market_scanner 스냅샷 우선 로드 → 없으면 unified_scanner fallback
  useEffect(() => {
    if (autoLoaded.current) return
    autoLoaded.current = true

    // full_market_scanner + unified_scanner 둘 다 로드해 더 최신 결과 사용
    const loadData: Promise<boolean> = Promise.all([
      fetchFullScanLatest().catch(() => null),
      fetchUnifiedCache().catch(() => null),
    ]).then(([full, unified]) => {
      const fullTs = full?.completed_at || full?.scan_time || null
      const unifiedTs = unified?.scan_time || null
      const fullHasData = full?.status !== 'no_data' && full?.picks
      const unifiedHasData = !!unifiedTs

      if (!fullHasData && !unifiedHasData) return false

      // 둘 다 있으면 더 최신 타임스탬프 우선
      if (fullHasData && unifiedHasData && fullTs && unifiedTs) {
        if (new Date(unifiedTs) > new Date(fullTs)) {
          applyResult(unified)
        } else {
          applyResult(full)
        }
      } else if (fullHasData) {
        applyResult(full)
      } else {
        applyResult(unified)
      }
      return true as boolean
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
            if (full?.status !== 'no_data' && full?.picks) {
              applyResult(full)
            } else {
              const result = await fetchUnifiedCache()
              applyResult(result)
            }
          } catch {
            const result = await fetchUnifiedCache()
            applyResult(result)
          }
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

  const hasPicks = picks && (picks.kospi?.length > 0 || picks.kosdaq?.length > 0 || picks.us?.length > 0 || picks.crypto?.length > 0)
  const allClosed = isAllMarketsClosed()

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="text-base md:text-xl font-bold text-white">전체 시장 스캔</h1>
          {allClosed && !scanning && (
            <span className="text-[10px] font-semibold text-slate-300 bg-slate-600/40 border border-slate-500/40 px-2 py-0.5 rounded-full">
              장 종료
            </span>
          )}
          {scanTime && !scanning && (
            <span className="text-[10px] text-[var(--muted)]">
              마지막 스캔: {fmtScanTime(scanTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {scanMsg && <span className="text-[10px] text-green-400 bg-green-400/10 px-2 py-1 rounded">{scanMsg}</span>}
          <button onClick={runScan} disabled={scanning}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs disabled:opacity-50 transition">
            <RefreshCw size={12} className={scanning ? 'animate-spin' : ''} />
            {scanning ? '스캔 중...' : '새로고침'}
          </button>
        </div>
      </div>

      {scanning && !hasPicks && buyItems.length === 0 && (
        <div className="text-center py-8 text-[var(--muted)]">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-orange-400" />
          <p className="text-sm">전체 시장 스캔 중... {scanElapsed > 0 ? `(${scanElapsed}초 경과)` : '(약 30초~1분)'}</p>
        </div>
      )}
      {scanning && (hasPicks || buyItems.length > 0) && (
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
              <h2 className="text-sm font-bold text-[var(--buy)]">차트 BUY 신호</h2>
              <span className="text-[9px] text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded">일봉 3일 이내 + 데드크로스 제외 + 거래량 5일 평균 1.5배↑</span>
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                mode === 'KR' ? 'bg-blue-500/15 text-blue-300' :
                mode === 'US' ? 'bg-emerald-500/15 text-emerald-300' :
                'bg-[var(--bg)] text-[var(--muted)]'
              }`}>{label}</span>
              {Object.keys(livePrices).length > 0 && (
                <span className="text-[9px] text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  실시간 가격 반영중
                </span>
              )}
            </div>
            {displayItems.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {displayItems.map((item: any, i: number) => (
                  <BuyCard key={item.symbol} item={item} index={i} livePrice={livePrices[item.symbol]} nav={nav} />
                ))}
              </div>
            ) : !scanning ? (
              <p className="text-[var(--muted)] text-xs text-center py-4">3일 이내 BUY 신호 종목이 없습니다</p>
            ) : null}
          </div>
        )
      })()}

      {/* 2. 투자과열 */}
      {overheatItems.length > 0 && (
        <>
        <div className="border-t border-[var(--border)] my-4" />
        <div className="mb-5">
          <button onClick={toggleOverheat} className="flex items-center gap-2 mb-3 w-full text-left">
            {showOverheat ? <ChevronDown size={14} className="text-[var(--sell)]" /> : <ChevronRight size={14} className="text-[var(--sell)]" />}
            <h2 className="text-sm font-bold text-[var(--sell)]">투자과열 신호</h2>
            <span className="text-[9px] text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded">RSI 70+ 또는 RSI 65+거래량 2x · 국내 개별주</span>
            <span className="text-[9px] text-[var(--sell)] font-bold">{overheatItems.length}종목</span>
            {!showOverheat && <span className="text-[9px] text-[var(--muted)]">접힘</span>}
          </button>
          {showOverheat && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              {overheatItems.map((item: any, i: number) => (
                <div key={item.symbol}
                  onClick={() => nav(`/${item.symbol}?market=${item.market_type || item.market}`)}
                  className="bg-[var(--bg)] border border-red-500/30 rounded-lg p-4 md:p-2.5 cursor-pointer hover:border-red-500/60 transition active:scale-[0.98]">
                  {/* 헤더: 순위 + 이름 + 코드 | 과열 배지 */}
                  <div className="flex items-center justify-between mb-2 md:mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[11px] bg-[var(--sell)]/20 text-[var(--sell)] w-5 h-5 rounded flex items-center justify-center font-mono shrink-0">{i + 1}</span>
                      <span className="text-[var(--text)] font-semibold text-base md:text-sm truncate">{item.name}</span>
                      <span className="text-[var(--muted)] text-xs md:text-[10px] shrink-0">{item.symbol}</span>
                    </div>
                    <span className="text-[10px] md:text-[9px] font-bold text-[var(--sell)] bg-[var(--sell)]/20 px-2 py-0.5 rounded shrink-0">과열</span>
                  </div>
                  {/* 가격 행 */}
                  <div className="md:flex md:items-center md:justify-between">
                    <div className="flex items-baseline gap-2 md:gap-1.5">
                      <span className="text-xl md:text-sm font-mono font-bold text-white">{item.price?.toLocaleString()}</span>
                      <span className={`text-sm md:text-[10px] font-mono font-semibold ${item.change_pct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
                        {item.change_pct >= 0 ? '+' : ''}{item.change_pct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3 md:gap-2 text-xs md:text-[10px] mt-1.5 md:mt-0">
                      <span className="text-[var(--sell)] font-bold">RSI {item.rsi?.toFixed(0)}</span>
                      <span className="text-[var(--muted)]">거래량 <span className="text-white font-mono">{item.volume_ratio?.toFixed(1)}x</span></span>
                    </div>
                  </div>
                  {/* 배지 행 */}
                  {(() => {
                    const overheatBadges = [
                      marketBadge(item.market_type || item.market),
                      ...indicatorBadges({
                        rsi: item.rsi,
                        bb_pct_b: item.bb_pct_b != null ? item.bb_pct_b / 100 : undefined,
                        volume_ratio: item.volume_ratio,
                        macd_hist: item.macd_hist,
                      }),
                    ]
                    return (
                      <div className="flex flex-wrap gap-1.5 md:gap-1 mt-2 md:mt-1.5">
                        {overheatBadges.map(b => (
                          <span key={b.label} className={`text-xs md:text-[8px] px-2 md:px-1.5 py-0.5 rounded ${b.cls}`}>{b.label}</span>
                        ))}
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
        </>
      )}

      {/* 3. 추천 종목 */}
      {hasPicks && (
        <>
        <div className="border-t border-[var(--border)] my-4" />
        <div className="mb-5">
          <button onClick={togglePicks} className="flex items-center gap-2 mb-3 w-full text-left">
            {showPicks ? <ChevronDown size={14} className="text-orange-400" /> : <ChevronRight size={14} className="text-orange-400" />}
            <h2 className="text-sm font-bold text-orange-400">추천 종목</h2>
            <span className="text-[9px] text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded">스퀴즈 + 상승추세 + 데드크로스 제외 · 강도순 시장별 Top 15</span>
            {!showPicks && <span className="text-[9px] text-[var(--muted)]">접힘</span>}
          </button>
          {showPicks && (
            <div className="space-y-3">
              {picks.kospi?.length > 0 && <PickSection title="코스피" picks={picks.kospi.slice(0, 15)} nav={nav} qc={qc} livePrices={livePrices} />}
              {picks.kosdaq?.length > 0 && <PickSection title="코스닥" picks={picks.kosdaq.slice(0, 15)} nav={nav} qc={qc} livePrices={livePrices} />}
              {picks.us?.length > 0 && <PickSection title="미국" picks={picks.us.slice(0, 15)} nav={nav} qc={qc} livePrices={livePrices} />}
              {picks.crypto?.length > 0 && <PickSection title="암호화폐" picks={picks.crypto.slice(0, 15)} nav={nav} qc={qc} livePrices={livePrices} />}
            </div>
          )}
        </div>
        </>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Pick 섹션 (추천/MAX SQ 공용)
// ══════════════════════════════════════════════════════════════
interface Pick {
  symbol: string; name: string; price: number; change_pct: number;
  rsi: number; bb_pct_b: number; squeeze_level: number; volume_ratio: number; confidence: number;
  market_type?: string; trend?: string; trend_label?: string; macd_hist?: number;
}

function PickSection({ title, picks, nav, qc, livePrices = {} }: { title: string; picks: Pick[]; nav: any; qc: any; livePrices?: Record<string, any> }) {
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set())

  const handleAdd = async (p: Pick, e: React.MouseEvent) => {
    e.stopPropagation()
    setAddingId(p.symbol)
    try {
      const market = (p.market_type === 'KOSPI' || p.market_type === 'KOSDAQ') ? 'KR' : 'US'
      await addSymbol({ market, symbol: p.symbol, timeframe: '1d' })
      setAddedIds(prev => new Set(prev).add(p.symbol))
      qc.invalidateQueries({ queryKey: ['signals'] })
    } catch {} finally { setAddingId(null) }
  }

  const handleClick = (p: Pick) => {
    const market = p.market_type || 'KR'
    nav(`/${p.symbol.replace(/\//g, '_')}?market=${market}`)
  }

  return (
    <div>
      <h3 className="text-xs text-[var(--muted)] mb-1.5">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {picks.map((p, i) => (
          <PickCard key={p.symbol} p={p} index={i} livePrice={livePrices[p.symbol]}
            onAdd={handleAdd} onNavigate={handleClick}
            adding={addingId === p.symbol} added={addedIds.has(p.symbol)} />
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PickCard — 가격 변동 시 깜빡임 효과
// ══════════════════════════════════════════════════════════════
function PickCard({ p, index, livePrice, onAdd, onNavigate, adding, added }: {
  p: Pick; index: number; livePrice?: any;
  onAdd: (p: Pick, e: React.MouseEvent) => void; onNavigate: (p: Pick) => void;
  adding: boolean; added: boolean;
}) {
  const price = livePrice?.price ?? p.price
  const pct = livePrice?.change_pct ?? p.change_pct
  const { flashClass } = usePriceFlash(price)

  return (
    <div onClick={() => onNavigate(p)}
      className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3.5 md:p-2.5 cursor-pointer hover:border-orange-500/50 transition active:scale-[0.98]">
      <div className="flex items-center justify-between mb-1.5 md:mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] md:text-[10px] bg-[var(--border)] text-white w-5 h-5 md:w-4 md:h-4 rounded flex items-center justify-center font-mono">{index + 1}</span>
          <span className="text-white font-semibold text-[24px] md:text-sm truncate">{p.name}</span>
          <span className="text-[var(--muted)] text-[17px] md:text-[10px] shrink-0">{p.symbol}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {p.trend === 'BULL' && (
            <span className="text-[10px] md:text-[9px] font-bold text-[var(--buy)] bg-[var(--buy)]/10 px-1.5 md:px-1 py-0.5 rounded">상승추세</span>
          )}
          <div className="flex items-center gap-0.5">
            <div className="w-2.5 h-2.5 md:w-2 md:h-2 rounded-full" style={{ background: sqColors[p.squeeze_level] }} />
            <span className="text-[10px] md:text-[9px] font-bold" style={{ color: sqColors[p.squeeze_level] }}>{sqLabels[p.squeeze_level]}</span>
          </div>
          {!added ? (
            <button onClick={(e) => onAdd(p, e)} disabled={adding}
              className="p-1 md:p-0.5 text-blue-400 hover:text-white hover:bg-blue-600 rounded transition" title="워치리스트에 추가">
              <Plus size={14} className="md:w-3 md:h-3" />
            </button>
          ) : (
            <span className="text-[10px] md:text-[9px] text-[var(--buy)]">추가됨</span>
          )}
        </div>
      </div>
      <div className="md:flex md:items-center md:justify-between mt-1 md:mt-0">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-xl md:text-sm font-mono font-semibold transition-colors duration-300 ${flashClass}`}>
            {fmtPrice(price, p.market_type)}
          </span>
          <span className={`text-sm md:text-[10px] font-mono ${pct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
            {pct >= 0 ? '+' : ''}{pct}%
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-2 text-[18px] md:text-[9px] mt-1.5 md:mt-0">
          <span className="text-[var(--muted)]">RSI <span className="text-[var(--text)] font-mono font-semibold">{p.rsi}</span></span>
          <span className="text-[var(--muted)]">%B <span className="text-white font-mono font-semibold">{p.bb_pct_b}%</span></span>
          <span className="text-[var(--muted)]">Vol <span className="text-white font-mono font-semibold">{p.volume_ratio}x</span></span>
        </div>
      </div>
      {/* 시장 배지 + 지표 라벨 */}
      {(() => {
        const indicators = indicatorBadges({
          squeeze_level: p.squeeze_level,
          rsi: p.rsi,
          bb_pct_b: p.bb_pct_b != null ? p.bb_pct_b / 100 : undefined,
          volume_ratio: p.volume_ratio,
          macd_hist: p.macd_hist ?? undefined,
        })
        const tags = [marketBadge(p.market_type || 'KR'), ...indicators]
        if (tags.length === 0) return null
        return (
          <div className="flex flex-wrap gap-1.5 md:gap-1 mt-2 md:mt-1">
            {tags.map(t => (
              <span key={t.label} className={`text-[18px] md:text-[8px] px-2 md:px-1.5 py-0.5 rounded ${t.cls}`}>{t.label}</span>
            ))}
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
          <span className="text-[11px] md:text-[10px] bg-[var(--border)] text-white w-5 h-5 md:w-4 md:h-4 rounded flex items-center justify-center font-mono">{index + 1}</span>
          <span className="text-white font-semibold text-[24px] md:text-sm truncate">{item.display_name || item.name}</span>
          <span className="text-[var(--muted)] text-[17px] md:text-[10px] shrink-0">{item.symbol}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.trend === 'BULL' && (
            <span className="text-[15px] md:text-[9px] font-bold text-[var(--buy)] bg-[var(--buy)]/10 px-1.5 md:px-1 py-0.5 rounded">상승추세</span>
          )}
          <span className={`text-[15px] md:text-[9px] font-bold px-1.5 md:px-1 py-0.5 rounded ${
            item.last_signal === 'SQZ BUY' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-[var(--buy)]/20 text-[var(--buy)]'
          }`}>{item.last_signal}</span>
        </div>
      </div>
      <div className="md:flex md:items-center md:justify-between mt-1 md:mt-0">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-xl md:text-sm font-mono font-semibold transition-colors duration-300 ${flashClass}`}>
            {fmtPrice(price, item.market)}
          </span>
          <span className={`text-sm md:text-[10px] font-mono ${pct >= 0 ? 'text-[var(--buy)]' : 'text-[var(--sell)]'}`}>
            {pct >= 0 ? '+' : ''}{pct}%
          </span>
        </div>
        <div className="flex items-center gap-3 md:gap-2 text-[18px] md:text-[9px] mt-1 md:mt-0">
          <span className="text-[var(--muted)]">{item.last_signal_date}</span>
          {item.rsi != null && <span className="text-[var(--muted)]">RSI <span className="text-white font-mono font-semibold">{item.rsi?.toFixed(0)}</span></span>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 md:gap-1 mt-2 md:mt-1">
        {reasons.map(r => (
          <span key={r.label} className={`text-[18px] md:text-[8px] px-2 md:px-1.5 py-0.5 rounded ${r.cls}`}>
            {r.label}
          </span>
        ))}
      </div>
    </div>
  )
}
