import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Search, X } from 'lucide-react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSymbol, deleteSymbol, fetchBatchPrices, fetchFullScanLatest, fetchFullScanStatus, fetchScanStatus, fetchScanSymbols, fetchSentiment, fetchSignals, searchSymbols, triggerFullScan } from '../api/client'
import FearGreedPanel from '../components/FearGreedPanel'
import MarketTicker from '../components/MarketTicker'
import ScanStatusPanel from '../components/ScanStatusPanel'
import WatchlistPanel from '../components/WatchlistPanel'
import FGGauge from '../components/charts/FGGauge'
import { useSignalStore } from '../stores/signalStore'
import { useAuthStore } from '../store/authStore'
import { useToastStore } from '../stores/toastStore'
import type { Signal } from '../types'
import { fmt, fmtPrice } from '../utils/format'
import { indicatorBadges, marketBadge } from '../utils/indicatorLabels'
import SignalCard from '../components/SignalCard'
import MiniCandles from '../components/charts/MiniCandles'
import Spark from '../components/charts/Spark'
import { genCandles } from '../utils/chartDummy'
import QuickBuyStrip from '../components/QuickBuyStrip'

interface SearchResult {
  symbol: string; name: string; market: string; market_type: string; display: string
}

export default function Dashboard() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { signals, setSignals } = useSignalStore()
  const { user, loading: authLoading } = useAuthStore()
  // user가 확인된 뒤에만 실행 — authLoading=false와 user 설정 사이의 틈에서
  // 인터셉터의 getSession()이 null을 반환해 빈 배열이 오는 레이스 컨디션 방지
  const { data, isPending: signalsPending } = useQuery<Signal[]>({
    queryKey: ['signals'],
    queryFn: fetchSignals,
    enabled: !authLoading && !!user,
    staleTime: 30_000,
  })
  // user가 없으면 쿼리가 disabled 상태(isPending=true)이므로 별도 계산
  const signalsActuallyLoading = authLoading || (!!user && signalsPending)
  const { addToast } = useToastStore()

  // 검색 상태 (PC 전용)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addMsg, setAddMsg] = useState('')
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const deleteMut = useMutation({
    mutationFn: deleteSymbol,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signals'] }) },
  })

  // 관심종목 실시간 가격
  const [watchlistLivePrices, setWatchlistLivePrices] = useState<Record<string, any>>({})
  const watchlistPriceTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const WATCHLIST_POLL_INTERVAL_MS = 5_000

  const refreshWatchlistPrices = useCallback(async (signals: Signal[]) => {
    const filtered = signals
      .filter(s => s.market !== 'CRYPTO')
      .map(s => ({ symbol: s.symbol, market: s.market }))
    if (filtered.length === 0) return
    try {
      const prices = await fetchBatchPrices(filtered)
      setWatchlistLivePrices(prev => {
        let changed = false
        const next = { ...prev }
        for (const [sym, p] of Object.entries(prices)) {
          const old = prev[sym]
          if (!old || old.price !== (p as any).price || old.change_pct !== (p as any).change_pct) {
            next[sym] = p
            changed = true
          }
        }
        return changed ? next : prev
      })
    } catch {}
  }, [])

  useEffect(() => {
    const signals = data ?? []
    if (signals.length === 0) return
    refreshWatchlistPrices(signals)
    watchlistPriceTimer.current = setInterval(() => refreshWatchlistPrices(signals), WATCHLIST_POLL_INTERVAL_MS)
    return () => { if (watchlistPriceTimer.current) clearInterval(watchlistPriceTimer.current) }
  }, [data])

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

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest?.('[data-search-box]')) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
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

  // ── 검색 박스 공통 JSX (인라인 사용 — 컴포넌트로 정의하면 매 렌더마다 리마운트됨) ──
  const searchDropdown = showDropdown && searchResults.length > 0
  const searchInputJSX = (mobile: boolean) => (
    <div
      data-search-box
      className={`relative ${mobile ? 'px-3 pb-2 shrink-0' : 'mb-3 md:mb-5 sticky top-[44px] z-30 pt-1 pb-1'}`}
      style={!mobile ? { background: 'var(--bg-0)' } : undefined}
    >
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--fg-3)' }} />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length && setShowDropdown(true)}
          placeholder="종목 검색 (예: 삼성전자, AAPL, BTC)"
          autoComplete="new-password"
          className="w-full pl-9 pr-8 py-2 rounded-lg text-sm focus:outline-none"
          style={{
            background: 'var(--bg-1)',
            border: '1px solid var(--border)',
            color: 'var(--fg-0)',
            fontFamily: 'var(--font-ui)',
          }}
        />
        {searchQuery && (
          <button onClick={() => { setSearchQuery(''); setSearchResults([]); setShowDropdown(false) }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--fg-3)' }}>
            <X size={14} />
          </button>
        )}
      </div>
      {addMsg && (
        <div
          className="mt-2 text-xs px-3 py-1.5 rounded"
          style={{
            color: addMsg.includes('실패') ? 'var(--down)' : 'var(--up)',
            background: addMsg.includes('실패') ? 'var(--down-bg)' : 'var(--up-bg)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {addMsg}
        </div>
      )}
      {searchDropdown && (
        <div
          className={`panel absolute z-50 mt-1 max-h-64 overflow-y-auto ${mobile ? 'left-3 right-3' : 'w-full'}`}
          style={{ padding: 0 }}
        >
          {searchResults.map((r, i) => (
            <div
              key={`${r.market}-${r.symbol}`}
              className="flex items-center justify-between"
              style={{
                padding: '8px 12px',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                transition: 'background 0.1s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <button
                onClick={() => nav(`/${r.symbol.replace(/\//g, '_')}?market=${r.market_type || r.market}`)}
                className="flex-1 text-left flex items-center min-w-0"
                style={{ gap: 8 }}
              >
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)' }} className="truncate">
                  {r.name}
                </span>
                <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
                  {r.symbol}
                </span>
                <span className="chip chip-ghost" style={{ flexShrink: 0 }}>
                  {r.market_type}
                </span>
              </button>
              <button
                onClick={() => handleAddFromSearch(r)}
                disabled={adding === r.symbol}
                className="shrink-0 ml-3 flex items-center gap-1"
                style={{
                  padding: '3px 10px',
                  background: 'var(--accent)',
                  color: 'var(--bg-1)',
                  borderRadius: 3,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                  cursor: adding === r.symbol ? 'not-allowed' : 'pointer',
                  opacity: adding === r.symbol ? 0.5 : 1,
                  border: 'none',
                }}
              >
                <Plus size={12} />
                {adding === r.symbol ? '추가 중...' : '추가'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )

  const [pcWatchlistOpen, setPcWatchlistOpen] = useState(true)

  return (
    <>
      {/* ══ 모바일: 마켓 화면 ══ */}
      <div className="md:hidden fixed inset-x-0 top-0 overflow-y-auto" style={{ bottom: 64, background: 'var(--bg-0)' }}>
        <MobileMarketTop watchlistSignals={data ?? []} signalsLoading={signalsActuallyLoading} userLoggedIn={!!user && !authLoading} />

      </div>

      {/* ══ PC 레이아웃 (모바일 숨김) ══ */}
      <div className="hidden md:block p-3 md:p-6 max-w-7xl mx-auto">
        <div className="mb-4"><MarketTicker /></div>
        {searchInputJSX(false)}
        <div className="mb-4"><FearGreedPanel /></div>
        <div className="mb-4">
          <WatchlistPanel
            signals={signals}
            isLoading={signalsActuallyLoading}
            isOpen={pcWatchlistOpen}
            onToggle={() => setPcWatchlistOpen(v => !v)}
            onDelete={(id) => deleteMut.mutate(id)}
            isMarketOpenLocal={isMarketOpenLocal}
            livePrices={watchlistLivePrices}
          />
        </div>
      </div>
    </>
  )
}

const MOBILE_MARKET_GROUPS = [
  { key: 'KR', label: '국내종목', flag: '🇰🇷' },
  { key: 'US', label: '해외종목', flag: '🇺🇸' },
] as const

function MobileWatchlistGroups({ signals }: { signals: any[] }) {
  const grouped = signals.reduce<Record<string, any[]>>((acc, s) => {
    ;(acc[s.market] ??= []).push(s)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {MOBILE_MARKET_GROUPS.map(sec => {
        const items = grouped[sec.key]
        if (!items || items.length === 0) return null
        const open = isMarketOpen(sec.key as 'KR' | 'US')
        return (
          <div key={sec.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
                {sec.flag} {sec.label}
              </span>
              <span className="chip chip-ghost">{items.length}</span>
              {open ? (
                <span className="chip chip-up" style={{ fontFamily: 'var(--font-mono)' }}>● LIVE</span>
              ) : (
                <span className="chip chip-ghost" style={{ fontFamily: 'var(--font-mono)' }}>장종료</span>
              )}
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {items.map((s: any, i: number) => (
                <SignalCard key={s.watchlist_id} signal={s} index={i + 1} compact />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── 마켓 페이지 스켈레톤 ──────────────────────────────────────
function MarketSkeleton() {
  const sk = (w: number | string, h: number, r = 4) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />
  )
  return (
    <div style={{ padding: '16px 12px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* FG 게이지 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0 4px' }}>
        {sk(110, 110, 55)}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {sk(60, 10, 3)}
          {sk(72, 32, 4)}
          {sk(88, 12, 3)}
        </div>
      </div>
      {/* 2×2 타일 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[0,1,2,3].map(i => (
          <div key={i} className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sk('50%', 10, 3)}
            {sk('70%', 18, 3)}
            {sk('45%', 10, 3)}
          </div>
        ))}
      </div>
      {/* 관심종목 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sk(80, 10, 3)}
        {[0,1,2].map(i => (
          <div key={i} className="panel" style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {sk('40%', 13, 3)}
              {sk('20%', 11, 3)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {sk(36, 10, 3)}{sk(36, 10, 3)}{sk(48, 10, 3)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// ── 모바일 마켓 섹션 상단: FG게이지 + 시장지표 2×2 그리드 ──
function MobileMarketTop({ watchlistSignals, signalsLoading, userLoggedIn }: { watchlistSignals: any[]; signalsLoading: boolean; userLoggedIn: boolean }) {
  const { data: sentiment } = useQuery<{
    fear_greed: number; fear_greed_label: string
    vix: any; kospi: any; sp500: any; nasdaq: any; usdkrw: any
  }>({
    queryKey: ['sentiment'],
    queryFn: fetchSentiment,
    staleTime: 60_000,
    refetchInterval: 300_000,
  })

  const fmtVal = (name: string, v: number) => {
    if (name === 'USD/KRW' || name === '코스피') return v.toLocaleString('ko-KR', { maximumFractionDigits: 0 })
    return v.toLocaleString('en-US', { maximumFractionDigits: 0 })
  }

  const tiles = sentiment ? [sentiment.kospi, sentiment.sp500, sentiment.nasdaq, sentiment.usdkrw] : []

  const isLoading = !sentiment || signalsLoading

  if (isLoading) return <MarketSkeleton />

  return (
    <div style={{ padding: '16px 12px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* FG 게이지 */}
      {sentiment && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: '0 4px' }}>
          <FGGauge value={Math.round(sentiment.fear_greed)} size={110} />
          <div>
            <div className="label" style={{ marginBottom: 4 }}>FEAR & GREED</div>
            <div style={{ fontSize: 32, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-0)', lineHeight: 1 }}>
              {sentiment.fear_greed.toFixed(0)}
            </div>
            <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>
              {sentiment.fear_greed_label}
            </div>
          </div>
        </div>
      )}

      {/* 2×2 시장지표 그리드 */}
      {tiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {tiles.map((idx) => (
            <div key={idx.name} className="panel" style={{ padding: '10px 12px' }}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                {idx.name}
              </div>
              <div style={{ fontSize: 16, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-0)', marginTop: 3 }}>
                {fmtVal(idx.name, idx.value)}
              </div>
              <div style={{
                fontSize: 11, fontFamily: 'var(--font-mono)', fontWeight: 600, marginTop: 2,
                color: idx.direction === 'up' ? 'var(--up)' : idx.direction === 'down' ? 'var(--down)' : 'var(--fg-3)',
              }}>
                {idx.direction === 'up' ? '▲' : idx.direction === 'down' ? '▼' : '—'} {Math.abs(idx.change_pct).toFixed(2)}%
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 최신 BUY 퀵 스트립 */}
      <QuickBuyStrip />

      {/* 관심종목 리스트 */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span className="label">관심종목</span>
          {watchlistSignals.length > 0 && <span className="chip chip-ghost">{watchlistSignals.length}</span>}
        </div>
        {signalsLoading ? (
          <p style={{ color: 'var(--fg-3)', fontSize: 13, textAlign: 'center', padding: '32px 0' }}>로딩 중…</p>
        ) : !userLoggedIn ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg-3)', fontSize: 12 }}>
            <p>로그인 후 관심종목을 등록할 수 있습니다</p>
          </div>
        ) : watchlistSignals.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--fg-3)', fontSize: 12 }}>
            <p>등록된 관심종목이 없습니다</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>스캔 탭에서 종목을 추가하세요</p>
          </div>
        ) : (
          <MobileWatchlistGroups signals={watchlistSignals} />
        )}
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

// PC 스캔 스켈레톤
function PcScanSkeleton() {
  const sk = (w: number | string, h: number, r = 4) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />
  )
  const card = (i: number) => (
    <div key={i} className="panel" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {sk('45%', 12, 3)}
        {sk('25%', 10, 3)}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        {sk('35%', 18, 3)}
        {sk('20%', 11, 3)}
      </div>
      <div style={{ display: 'flex', gap: 4 }}>
        {sk(32, 10, 2)}{sk(32, 10, 2)}{sk(40, 10, 2)}
      </div>
    </div>
  )
  const section = (cols: number) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sk(10, 10, 2)}
        {sk(70, 12, 3)}
        {sk(24, 16, 8)}
        {sk(160, 10, 3)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 8 }}>
        {Array.from({ length: cols * 2 }).map((_, i) => card(i))}
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* ScanStatusPanel skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="panel" style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sk('55%', 10, 3)}
            {sk('40%', 22, 3)}
          </div>
        ))}
      </div>
      {section(4)}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>{section(4)}</div>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>{section(4)}</div>
    </div>
  )
}

// 통합 시장 스캔 박스 (1회 다운로드, 3개 결과 동시 생성)
// ══════════════════════════════════════════════════════════════
export function MarketScanBox({ }: { nav?: any; qc?: any }) {
  const [scanning, setScanning] = useState(false)
  const [pcScanLoading, setPcScanLoading] = useState(true)
  const [scanMsg, setScanMsg] = useState('')
  const [scanTime, setScanTime] = useState<string | null>(null)
  const autoLoaded = useRef(false)

  const [maxSq] = useState<any>(null)  // 하위 호환용 (제거 예정)
  const [buyItems, setBuyItems] = useState<any[]>([])
  const [buyTotal, setBuyTotal] = useState<number | null>(null)
  const [largeCapCount, setLargeCapCount] = useState<number | null>(null)
  const [pullbackItems, setPullbackItems] = useState<any[]>([])
  const [overheatItems, setOverheatItems] = useState<any[]>([])
  const [marketHealth, setMarketHealth] = useState<{ dead_cross: number; alive: number; volume_spike?: number; volume_total?: number } | null>(null)
  const [scanSymbolsTotal, setScanSymbolsTotal] = useState<number | null>(null)

  // 섹션 토글 (localStorage 유지)
  const [scanClosedSec, setScanClosedSec] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('scan-closed-sec') || '[]')) }
    catch { return new Set() }
  })
  const isScanOpen = (k: string) => !scanClosedSec.has(k)
  const toggleScan = (k: string) => setScanClosedSec(prev => {
    const next = new Set(prev)
    if (next.has(k)) next.delete(k); else next.add(k)
    localStorage.setItem('scan-closed-sec', JSON.stringify([...next]))
    return next
  })

  // 실시간 가격 캐시: {symbol: {price, change_pct, ...}}
  const [livePrices, setLivePrices] = useState<Record<string, any>>({})
  const priceTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyResult = (result: any) => {
    if (result?.chart_buy) {
      setBuyItems(result.chart_buy.items || [])
      if (result.chart_buy.total != null) setBuyTotal(result.chart_buy.total)
      if (result.chart_buy.large_cap_count != null) setLargeCapCount(result.chart_buy.large_cap_count)
    }
    if (result?.pullback_buy) setPullbackItems(result.pullback_buy.items || [])
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
    add(pullbackItems)
    add(overheatItems)
    return syms
  }, [maxSq, buyItems, pullbackItems, overheatItems])

  // 실시간 가격 fetch
  // 변화가 없는 심볼은 참조를 유지해 하위 memo 컴포넌트 리렌더 최소화.
  const refreshPrices = useCallback(async () => {
    const syms = extractSymbols()
    // CRYPTO 제외 (한투 API 미지원)
    const filtered = syms.filter(s => s.market !== 'CRYPTO')
    if (filtered.length === 0) return
    try {
      const prices = await fetchBatchPrices(filtered)
      setLivePrices(prev => {
        let changed = false
        const next = { ...prev }
        for (const [sym, p] of Object.entries(prices)) {
          const old = prev[sym]
          if (!old || old.price !== (p as any).price || old.change_pct !== (p as any).change_pct) {
            next[sym] = p
            changed = true
          }
        }
        return changed ? next : prev
      })
    } catch {}
  }, [extractSymbols])

  const PRICE_POLL_INTERVAL_MS = 5_000

  // 스캔 결과 로드 후 실시간 가격 갱신 시작
  useEffect(() => {
    const syms = extractSymbols()
    if (syms.length === 0) return
    refreshPrices()
    priceTimer.current = setInterval(refreshPrices, PRICE_POLL_INTERVAL_MS)
    return () => { if (priceTimer.current) clearInterval(priceTimer.current) }
  }, [maxSq, buyItems, pullbackItems, overheatItems])

  const [scanElapsed, setScanElapsed] = useState(0)
  const [fullScanRunning, setFullScanRunning] = useState(false)
  const fullScanPollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const runScan = async () => {
    setScanning(true)
    setScanMsg('시장 스캔 중...')
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
        setPcScanLoading(false)
        if (!status) return  // API 오류 시 스캔 미실행
        if (status.scan_time) setScanTime(status.scan_time)
        if (status.scanning) {
          setScanning(true)
          setScanMsg('시장 스캔 중...')
          setScanElapsed(status.elapsed_seconds || 0)
        } else if (!hasData) {
          // 데이터가 전혀 없을 때만 스캔 실행
          runScan()
        }
      })
      .catch(() => setPcScanLoading(false))

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
  const totalSymbols = marketHealth ? marketHealth.dead_cross + marketHealth.alive : null
  const deadCrossPct = totalSymbols && marketHealth
    ? (marketHealth.dead_cross / totalSymbols) * 100
    : null

  if (pcScanLoading) {
    return (
      <div className="panel" style={{ padding: '12px 20px' }}>
        <PcScanSkeleton />
      </div>
    )
  }

  return (
    <div className="panel" style={{ padding: '12px 20px' }}>
      {/* SQZ Terminal — 시장 스캔 4칸 패널 (Phase 8) */}
      <div className="mb-4">
        <ScanStatusPanel
          recommendedCount={buyTotal ?? (buyItems.length || null)}
          pullbackCount={pullbackItems.length}
          largeCapCount={largeCapCount}
          deadCrossCount={marketHealth?.dead_cross ?? null}
          deadCrossPct={deadCrossPct}
          totalSymbols={totalSymbols}
          scanning={scanning}
          scanTimeText={scanTime ? fmtScanTime(scanTime) : null}
          allMarketsClosed={allClosed}
          scanElapsedSec={scanElapsed}
          onRefresh={runScan}
        />
        {scanMsg && (
          <div className="mt-2 text-right">
            <span className="text-caption text-[var(--up)]" style={{ background: 'var(--up-bg)', padding: '2px 8px', borderRadius: 3, fontFamily: 'var(--font-mono)' }}>
              {scanMsg}
            </span>
          </div>
        )}
      </div>

      {scanning && buyItems.length === 0 && (
        <div className="text-center py-8 text-[var(--fg-3)]">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2" style={{ color: 'var(--warn)' }} />
          <p className="text-sm">시장 스캔 중... {scanElapsed > 0 ? `(${scanElapsed}초 경과)` : '(약 30초~1분)'}</p>
        </div>
      )}

      {/* 1. 추천 종목 (chart_buy) */}
      {(() => {
        const { mode, label } = getBuyDisplayMode()
        const displayItems = filterBuyByMode(
          [...buyItems].sort((a: any, b: any) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0)),
          mode
        )
        return (
          <div className="mb-2">
            <div className="flex items-center mb-3 flex-wrap" style={{ gap: 10 }}>
              <button
                onClick={() => toggleScan('buy')}
                style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                aria-label={isScanOpen('buy') ? '접기' : '펼치기'}
              >
                {isScanOpen('buy') ? '▾' : '▸'}
              </button>
              <div className="label">추천 종목</div>
              {buyTotal != null && <span className="chip chip-up">{buyTotal}</span>}
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>
                일봉 20거래일 이내 BUY/SQZ BUY · 데드크로스(EMA 5선 역배열) 제외
              </span>
              <span className="chip chip-ghost">{label}</span>
              {Object.keys(livePrices).length > 0 && (
                <span className="chip chip-up" style={{ fontFamily: 'var(--font-mono)' }}>● LIVE</span>
              )}
            </div>
            {isScanOpen('buy') && <>
            {/* Dead Cross 비율 바 */}
            {marketHealth && (marketHealth.dead_cross + marketHealth.alive) > 0 && (() => {
              const total = marketHealth.dead_cross + marketHealth.alive
              const labelTotal = scanSymbolsTotal ?? total
              const alivePct = Math.round(marketHealth.alive / total * 100)
              const deadPct = 100 - alivePct
              return (
                <div className="w-1/2 mb-3">
                  <p className="text-caption" style={{ color: 'var(--fg-3)', marginBottom: 6 }}>EMA 추세 · {labelTotal.toLocaleString()}종목</p>
                  <div className="relative">
                    <div className="absolute -top-2.5 z-10" style={{ left: `${alivePct}%`, transform: 'translateX(-50%)' }}>
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent" style={{ borderTopColor: 'var(--fg-3)' }} />
                    </div>
                    <div className="flex h-[5px] rounded-full overflow-hidden">
                      <div className="rounded-l-full" style={{ width: `${alivePct}%`, background: 'var(--up)' }} />
                      <div className="rounded-r-full" style={{ width: `${deadPct}%`, background: 'var(--down)' }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-caption" style={{ color: 'var(--up)' }}>정상 {alivePct}%</span>
                    <span className="text-caption" style={{ color: 'var(--down)' }}>데드크로스 {deadPct}%</span>
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
                  <p className="text-caption" style={{ color: 'var(--fg-3)', marginBottom: 6 }}>거래량 급증 · 10일 내 1봉 이상 · {total.toLocaleString()}종목</p>
                  <div className="relative">
                    <div className="absolute -top-2.5 z-10" style={{ left: `${spikePct}%`, transform: 'translateX(-50%)' }}>
                      <div className="w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent" style={{ borderTopColor: 'var(--fg-3)' }} />
                    </div>
                    <div className="flex h-[5px] rounded-full overflow-hidden">
                      <div className="rounded-l-full" style={{ width: `${spikePct}%`, background: 'var(--accent)' }} />
                      <div className="rounded-r-full" style={{ width: `${restPct}%`, background: 'var(--bg-3)' }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-caption" style={{ color: 'var(--accent)' }}>활발 {spikePct}%</span>
                    <span className="text-caption" style={{ color: 'var(--fg-3)' }}>정체 {restPct}%</span>
                  </div>
                </div>
              )
            })()}
            {displayItems.length > 0 ? (
              <SectorGrouped items={displayItems} livePrices={livePrices} />
            ) : !scanning ? (
              <p className="text-[var(--fg-3)] text-xs text-center py-4">20거래일 이내 BUY 신호 종목이 없습니다</p>
            ) : null}
            </>}
          </div>
        )
      })()}

      {/* 2. 눌림목 (pullback_buy) */}
      <div className="mt-4 pt-4 border-t border-[var(--border)]">
        <div className="flex items-center mb-3 flex-wrap" style={{ gap: 10 }}>
          <button
            onClick={() => toggleScan('pullback')}
            style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'var(--font-mono)' }}
            aria-label={isScanOpen('pullback') ? '접기' : '펼치기'}
          >
            {isScanOpen('pullback') ? '▾' : '▸'}
          </button>
          <div className="label">눌림목</div>
          <span className="chip chip-warn">{pullbackItems.length}</span>
          <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>EMA20{'>'}60{'>'}120 + EMA5↓ + 대형주</span>
        </div>
        {isScanOpen('pullback') && (
          pullbackItems.length > 0
            ? <SectorGrouped items={[...pullbackItems].sort((a: any, b: any) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0))} livePrices={livePrices} />
            : <p className="text-[var(--fg-3)] text-xs text-center py-4">눌림목 종목이 없습니다</p>
        )}
      </div>

      {/* 3. 대형주 (large_cap) */}
      {(() => {
        const largeCapItems = buyItems.filter((i: any) => i.is_large_cap)
        return (
          <div className="mt-4 pt-4 border-t border-[var(--border)]">
            <div className="flex items-center mb-3 flex-wrap" style={{ gap: 10 }}>
              <button
                onClick={() => toggleScan('largecap')}
                style={{ background: 'transparent', border: 'none', color: 'var(--fg-3)', cursor: 'pointer', padding: 0, fontSize: 12, fontFamily: 'var(--font-mono)' }}
                aria-label={isScanOpen('largecap') ? '접기' : '펼치기'}
              >
                {isScanOpen('largecap') ? '▾' : '▸'}
              </button>
              <div className="label">대형주</div>
              <span className="chip chip-accent">{largeCapItems.length}</span>
              <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>추천종목 중 KOSPI200·KOSDAQ150·S&P500</span>
            </div>
            {isScanOpen('largecap') && (
              largeCapItems.length > 0
                ? <SectorGrouped items={[...largeCapItems].sort((a: any, b: any) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0))} livePrices={livePrices} />
                : <p className="text-[var(--fg-3)] text-xs text-center py-4">대형주 BUY 신호 종목이 없습니다</p>
            )}
          </div>
        )
      })()}

    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BuyCard — 차트 BUY 신호 카드 (가격 깜빡임)
// ══════════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════
// SectorGrouped — 업종별 그룹 렌더링
// ══════════════════════════════════════════════════════════════
const SECTOR_ORDER = [
  "IT/기술", "반도체", "커뮤니케이션", "헬스케어",
  "소비재(경기)", "소비재(필수)", "금융", "산업재",
  "소재", "에너지", "부동산", "유틸리티",
  "ETF", "암호화폐", "기타(국내)", "기타(미국)",
]

export const SectorGrouped = memo(function SectorGrouped({ items, livePrices, compact }: { items: any[]; livePrices: Record<string, any>; compact?: boolean }) {
  // 섹터별 그룹화
  const groups: Record<string, any[]> = {}
  for (const item of items) {
    const rawSector = item.sector || (item.is_etf ? "ETF" : item.market === "CRYPTO" ? "암호화폐" : "")
    const sector = rawSector === "기타" || !rawSector
      ? (item.market === "KR" ? "기타(국내)" : item.market === "US" ? "기타(미국)" : "기타")
      : rawSector
    ;(groups[sector] ??= []).push(item)
  }

  // 섹터 정렬: SECTOR_ORDER 우선, 나머지 알파벳순
  const ordered = [
    ...SECTOR_ORDER.filter(s => groups[s]),
    ...Object.keys(groups).filter(s => !SECTOR_ORDER.includes(s)).sort(),
  ]

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {ordered.map(sector => (
        <div key={sector}>
          <div className="flex items-center" style={{ gap: 8, marginBottom: compact ? 6 : 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-2)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em' }}>
              {sector}
            </span>
            <span className="chip chip-ghost">{groups[sector].length}</span>
            <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          </div>
          <div className={compact ? 'space-y-2' : 'grid grid-cols-1 md:grid-cols-3 gap-2'}>
            {groups[sector].map((item: any, i: number) => (
              <BuyCard key={item.symbol} item={item} index={i} livePrice={livePrices?.[item.symbol]} compact={compact} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
})

export const BuyCard = memo(function BuyCard({ item, index, livePrice, compact }: { item: any; index: number; livePrice?: any; compact?: boolean }) {
  const price = livePrice?.price ?? item.price
  const pct = livePrice?.change_pct ?? item.change_pct

  const prevPriceRef = useRef<number | undefined>(price)
  const [flashDir, setFlashDir] = useState<'up' | 'down' | null>(null)
  useEffect(() => {
    if (price != null && prevPriceRef.current != null && price !== prevPriceRef.current) {
      setFlashDir(price > prevPriceRef.current ? 'up' : 'down')
      const t = setTimeout(() => setFlashDir(null), 800)
      prevPriceRef.current = price
      return () => clearTimeout(t)
    }
    prevPriceRef.current = price
  }, [price])
  const flashColor = flashDir === 'up' ? 'var(--up)' : flashDir === 'down' ? 'var(--blue)' : 'var(--fg-0)'

  const mktBadge = marketBadge(item.market_type || item.market)
  const indicators = indicatorBadges({
    squeeze_level: item.squeeze_level,
    rsi: item.rsi,
    bb_pct_b: item.bb_pct_b != null ? item.bb_pct_b / 100 : undefined,
    volume_ratio: item.volume_ratio,
    macd_hist: item.macd_hist,
  })

  // SQZ Terminal 신호 칩
  const signalChip = item.last_signal === 'SQZ BUY'
    ? { label: 'SQZ BUY', cls: 'chip chip-mag' }
    : item.last_signal === 'BUY'
    ? { label: 'BUY', cls: 'chip chip-up' }
    : { label: item.last_signal || '신호', cls: 'chip chip-ghost' }

  // Trend 라벨
  const trend = item.trend === 'BULL'
    ? { label: '상승', color: 'var(--up)' }
    : item.trend === 'BEAR'
    ? { label: '하락', color: 'var(--down)' }
    : { label: '중립', color: 'var(--fg-2)' }

  const candles = useMemo(() => {
    const candleSeed = (item.symbol.charCodeAt(0) || 1) + (index + 1) * 7
    return genCandles(20, candleSeed, 100, 0.03)
  }, [item.symbol, index])
  const sparkData = useMemo(() => candles.map(c => c.c), [candles])
  const sparkUp = (pct ?? 0) >= 0

  return (
    <div
      onClick={() => window.open(`/${item.symbol.replace(/\//g, '_')}?market=${item.market_type || item.market}`, '_blank')}
      className="panel cursor-pointer"
      style={{
        padding: 0,
        background: 'var(--bg-1)',
        transition: 'border-color 0.1s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-strong)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      {/* Header */}
      <div
        className="flex items-center"
        style={{ padding: '8px 12px', gap: 8, borderBottom: '1px solid var(--border)', minWidth: 0 }}
      >
        <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--fg-3)', width: 18, flexShrink: 0 }}>
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate" style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-0)' }}>
              {item.display_name || item.name}
            </span>
            <span style={{ fontSize: 10.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
              {item.symbol}
            </span>
            <span className="chip chip-ghost" style={{ flexShrink: 0 }}>{mktBadge.label}</span>
          </div>
        </div>
        <span className={signalChip.cls} style={{ flexShrink: 0 }}>
          {signalChip.label}
        </span>
      </div>

      {/* Body */}
      {compact ? (
        /* 모바일 compact: Spark(72) + 가격(14px) + RSI/Trend */
        <div style={{ padding: '8px 12px' }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <div style={{ minWidth: 80 }}>
              <div style={{ fontSize: 14, fontFamily: 'var(--font-mono)', fontWeight: 600, color: flashColor, transition: 'color 0.3s' }}>
                {fmtPrice(price, item.market)}
              </div>
              <div style={{ fontSize: 11, color: sparkUp ? 'var(--up)' : 'var(--blue)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                {sparkUp ? '▲' : '▼'} {fmt.pct(pct ?? 0)}
              </div>
              {item.last_signal_date && (
                <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                  {item.last_signal_date}
                </div>
              )}
            </div>
            <Spark data={sparkData} w={72} h={28} color={sparkUp ? 'var(--up)' : 'var(--down)'} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center" style={{ gap: 8, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)', flexWrap: 'wrap' }}>
                {item.rsi != null && (
                  <span>RSI <span style={{ color: item.rsi > 60 ? 'var(--warn)' : item.rsi < 30 ? 'var(--up)' : 'var(--fg-0)' }}>{item.rsi.toFixed(0)}</span></span>
                )}
                <span>Trend <span style={{ color: trend.color }}>{trend.label}</span></span>
              </div>
              {indicators.length > 0 && (
                <div className="flex flex-wrap" style={{ gap: 3, marginTop: 4 }}>
                  {indicators.map(t => (
                    <span key={t.label} className="chip chip-ghost" style={{ fontSize: 9 }}>{t.label}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* PC full: MiniCandles(140) + 가격(18px) */
        <div className="flex items-center" style={{ padding: '10px 12px', gap: 14 }}>
          <div style={{ minWidth: 95 }}>
            <div style={{ fontSize: 18, fontFamily: 'var(--font-mono)', fontWeight: 600, color: flashColor, transition: 'color 0.3s' }}>
              {fmtPrice(price, item.market)}
            </div>
            <div style={{ fontSize: 11, color: sparkUp ? 'var(--up)' : 'var(--blue)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {sparkUp ? '▲' : '▼'} {fmt.pct(pct ?? 0)}
            </div>
            {item.last_signal_date && (
              <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                {item.last_signal_date}
              </div>
            )}
          </div>
          <MiniCandles data={candles} w={140} h={40} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center" style={{ gap: 10, fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-2)' }}>
              {item.rsi != null && (
                <span>RSI <span style={{ color: item.rsi > 60 ? 'var(--warn)' : item.rsi < 30 ? 'var(--up)' : 'var(--fg-0)' }}>{item.rsi.toFixed(0)}</span></span>
              )}
              <span>Trend <span style={{ color: trend.color }}>{trend.label}</span></span>
            </div>
            {indicators.length > 0 && (
              <div className="flex flex-wrap" style={{ gap: 4, marginTop: 6 }}>
                {indicators.map(t => (
                  <span key={t.label} className="chip chip-ghost" style={{ fontSize: 9.5 }}>{t.label}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
