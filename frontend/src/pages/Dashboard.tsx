import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, RefreshCw, Search, Trash2, TrendingUp, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { addSymbol, deleteSymbol, fetchBatchPrices, fetchSignals, fetchUnifiedCache, runUnifiedScan, searchSymbols } from '../api/client'
import SignalCard from '../components/SignalCard'
import { usePriceFlash } from '../hooks/usePriceFlash'
import { useSignalStore } from '../stores/signalStore'
import type { Signal } from '../types'
import { fmtPrice } from '../utils/format'

interface SearchResult {
  symbol: string; name: string; market: string; market_type: string; display: string
}

const sqColors: Record<number, string> = { 0: '#22c55e', 1: '#eab308', 2: '#f97316', 3: '#ef4444' }
const sqLabels: Record<number, string> = { 0: 'NO SQ', 1: 'LOW SQ', 2: 'MID SQ', 3: 'MAX SQ' }

export default function Dashboard() {
  const qc = useQueryClient()
  const nav = useNavigate()
  const { data, isLoading } = useQuery<Signal[]>({ queryKey: ['signals'], queryFn: fetchSignals })
  const { signals, setSignals } = useSignalStore()

  // 검색 상태
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [showDropdown, setShowDropdown] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [addMsg, setAddMsg] = useState('')
  const searchBoxRef = useRef<HTMLDivElement>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // 외부 클릭 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) setShowDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAddFromSearch = async (r: SearchResult) => {
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

  const isMarketOpen = (market: string) => {
    const now = new Date()
    if (market === 'CRYPTO') return true
    if (market === 'KR') {
      const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
      const day = kst.getDay()
      const h = kst.getHours(), m = kst.getMinutes()
      if (day === 0 || day === 6) return false
      if (h < 9 || (h === 15 && m > 30) || h > 15) return false
      return true
    }
    if (market === 'US') {
      const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
      const day = et.getDay()
      const h = et.getHours(), m = et.getMinutes()
      if (day === 0 || day === 6) return false
      if (h < 9 || (h === 9 && m < 30) || h >= 16) return false
      return true
    }
    return false
  }

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">

      {/* ── 종목 검색 + 추가 ── */}
      <div ref={searchBoxRef} className="relative mb-3 md:mb-5 sticky top-0 z-30 md:static bg-[var(--bg)] pt-1 pb-1 md:pt-0 md:pb-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => searchResults.length && setShowDropdown(true)}
            placeholder="종목 검색 (예: 삼성전자, AAPL, BTC)"
            autoComplete="off"
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

        {showDropdown && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-[#1e293b] border border-[var(--border)] rounded-lg shadow-xl max-h-64 overflow-y-auto">
            {searchResults.map((r) => (
              <div key={`${r.market}-${r.symbol}`}
                className="flex items-center justify-between px-4 py-2.5 hover:bg-[var(--border)] transition">
                <button onClick={() => nav(`/${r.symbol.replace(/\//g, '_')}?market=${r.market_type || r.market}`)}
                  className="flex-1 text-left">
                  <span className="text-white text-sm">{r.name}</span>
                  <span className="text-[var(--muted)] text-xs ml-2">{r.symbol}</span>
                  <span className="text-[10px] text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded ml-2">
                    {r.market_type}
                  </span>
                </button>
                <button
                  onClick={() => handleAddFromSearch(r)}
                  disabled={adding === r.symbol}
                  className="shrink-0 ml-3 flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-md disabled:opacity-50 transition"
                >
                  <Plus size={12} />
                  {adding === r.symbol ? '추가 중...' : '추가'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

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
                {isMarketOpen(market) ? (
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
                      onClick={(e) => { e.stopPropagation(); if(confirm(`${s.display_name || s.symbol} 삭제?`)) deleteMut.mutate(s.watchlist_id) }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 bg-red-500/80 rounded text-white hover:bg-red-600 transition"
                      title="워치리스트에서 삭제"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null
        )}
      </div>

      {/* ── 전체 시장 스캔 (PC만 표시, 모바일은 /scan 탭) ── */}
      <div className="hidden md:block">
        <div className="border-t border-[var(--border)] my-8" />
        <MarketScanBox nav={nav} qc={qc} />
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// 통합 시장 스캔 박스 (1회 다운로드, 3개 결과 동시 생성)
// ══════════════════════════════════════════════════════════════
export function MarketScanBox({ nav, qc }: { nav: any; qc: any }) {
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const autoLoaded = useRef(false)

  const [picks, setPicks] = useState<any>(null)
  const [maxSq, setMaxSq] = useState<any>(null)
  const [buyItems, setBuyItems] = useState<any[]>([])

  // 실시간 가격 캐시: {symbol: {price, change_pct, ...}}
  const [livePrices, setLivePrices] = useState<Record<string, any>>({})
  const priceTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyResult = (result: any) => {
    if (result?.picks) setPicks(result.picks)
    if (result?.max_sq) setMaxSq(result.max_sq)
    if (result?.chart_buy) setBuyItems(result.chart_buy.items || [])
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
    return syms
  }, [picks, maxSq, buyItems])

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
  }, [picks, maxSq, buyItems])

  const runScan = async () => {
    setScanning(true)
    setScanMsg('전체 시장 스캔 중...')
    try {
      const result = await runUnifiedScan()
      applyResult(result)
      setScanMsg('스캔 완료')
      setTimeout(() => setScanMsg(''), 3000)
    } catch { setScanMsg('스캔 실패') }
    finally { setScanning(false) }
  }

  useEffect(() => {
    if (autoLoaded.current) return
    autoLoaded.current = true
    fetchUnifiedCache().then(r => applyResult(r)).catch(() => {})
    runScan()
  }, [])

  const hasPicks = picks && (picks.kospi?.length > 0 || picks.kosdaq?.length > 0 || picks.us?.length > 0 || picks.crypto?.length > 0)
  const hasMaxSq = maxSq && (maxSq.kospi?.length > 0 || maxSq.kosdaq?.length > 0 || maxSq.us?.length > 0 || maxSq.crypto?.length > 0)

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-3 md:p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={18} className="text-orange-400" />
          <h1 className="text-base md:text-xl font-bold text-white">전체 시장 스캔</h1>
          <span className="text-[10px] text-[var(--muted)] bg-[var(--bg)] px-2 py-0.5 rounded border border-[var(--border)]">
            코스피 54 · 코스닥 30 · 미국 65 · 코인 10
          </span>
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

      {scanning && !hasPicks && !hasMaxSq && buyItems.length === 0 && (
        <div className="text-center py-8 text-[var(--muted)]">
          <RefreshCw size={20} className="animate-spin mx-auto mb-2 text-orange-400" />
          <p className="text-sm">전체 시장 스캔 중... (약 30초~1분)</p>
        </div>
      )}

      {/* 1. 추천 종목 */}
      {hasPicks && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-bold text-orange-400">추천 종목</h2>
            <span className="text-[9px] text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded">MID/MAX SQ + 상승추세 + 데드크로스 제외 · 강도순 시장별 Top 3</span>
            {Object.keys(livePrices).length > 0 && (
              <span className="text-[9px] text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                실시간 가격 반영중
              </span>
            )}
          </div>
          <div className="space-y-3">
            {picks.kospi?.length > 0 && <PickSection title="코스피" picks={picks.kospi} nav={nav} qc={qc} livePrices={livePrices} />}
            {picks.kosdaq?.length > 0 && <PickSection title="코스닥" picks={picks.kosdaq} nav={nav} qc={qc} livePrices={livePrices} />}
            {picks.us?.length > 0 && <PickSection title="미국" picks={picks.us} nav={nav} qc={qc} livePrices={livePrices} />}
            {picks.crypto?.length > 0 && <PickSection title="암호화폐" picks={picks.crypto} nav={nav} qc={qc} livePrices={livePrices} />}
          </div>
        </div>
      )}

      {/* 2. MAX SQ 폭발 임박 */}
      <div className="border-t border-[var(--border)] my-4" />
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold text-red-400">MAX SQ 폭발 임박</h2>
          <span className="text-[9px] text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded">MAX SQ + 상승추세 + 데드크로스 제외 · 시장별 Top 5</span>
          {Object.keys(livePrices).length > 0 && (
            <span className="text-[9px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              실시간 가격 반영중
            </span>
          )}
        </div>
        {hasMaxSq ? (
          <div className="space-y-3">
            {maxSq.kospi?.length > 0 && <PickSection title="코스피" picks={maxSq.kospi} nav={nav} qc={qc} livePrices={livePrices} />}
            {maxSq.kosdaq?.length > 0 && <PickSection title="코스닥" picks={maxSq.kosdaq} nav={nav} qc={qc} livePrices={livePrices} />}
            {maxSq.us?.length > 0 && <PickSection title="미국" picks={maxSq.us} nav={nav} qc={qc} livePrices={livePrices} />}
            {maxSq.crypto?.length > 0 && <PickSection title="암호화폐" picks={maxSq.crypto} nav={nav} qc={qc} livePrices={livePrices} />}
          </div>
        ) : !scanning ? (
          <p className="text-[var(--muted)] text-xs text-center py-4">MAX SQ + 상승추세 + 데드크로스 제외 조건에 해당하는 종목이 없습니다</p>
        ) : null}
      </div>

      {/* 3. 차트 BUY 신호 */}
      <div className="border-t border-[var(--border)] my-4" />
      <div className="mb-2">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm font-bold text-green-400">차트 BUY 신호</h2>
          <span className="text-[9px] text-[var(--muted)] bg-[var(--bg)] px-1.5 py-0.5 rounded">일봉 3일 이내 + 데드크로스 제외 · 한국 2 + 미국 2</span>
          {Object.keys(livePrices).length > 0 && (
            <span className="text-[9px] text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
              실시간 가격 반영중
            </span>
          )}
        </div>
        {buyItems.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {[...buyItems].sort((a: any, b: any) => (b.trend === 'BULL' ? 1 : 0) - (a.trend === 'BULL' ? 1 : 0)).map((item: any, i: number) => (
              <BuyCard key={item.symbol} item={item} index={i} livePrice={livePrices[item.symbol]} nav={nav} />
            ))}
          </div>
        ) : !scanning ? (
          <p className="text-[var(--muted)] text-xs text-center py-4">3일 이내 BUY 신호 종목이 없습니다</p>
        ) : null}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// Pick 섹션 (추천/MAX SQ 공용)
// ══════════════════════════════════════════════════════════════
interface Pick {
  symbol: string; name: string; price: number; change_pct: number;
  rsi: number; bb_pct_b: number; squeeze_level: number; volume_ratio: number; confidence: number;
  market_type?: string; trend?: string; trend_label?: string;
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
          <span className="text-white font-semibold text-base md:text-sm truncate">{p.name}</span>
          <span className="text-[var(--muted)] text-[11px] md:text-[10px] shrink-0">{p.symbol}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {p.trend === 'BULL' && (
            <span className="text-[10px] md:text-[9px] font-bold text-green-400 bg-green-400/10 px-1.5 md:px-1 py-0.5 rounded">상승추세</span>
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
            <span className="text-[10px] md:text-[9px] text-green-400">추가됨</span>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-lg md:text-sm font-mono font-semibold transition-colors duration-300 ${flashClass}`}>
            {fmtPrice(price, p.market_type)}
          </span>
          <span className={`text-[11px] md:text-[10px] font-mono ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pct >= 0 ? '+' : ''}{pct}%
          </span>
        </div>
        <div className="flex items-center gap-2.5 md:gap-2 text-[11px] md:text-[9px]">
          <span className="text-[var(--muted)]">RSI <span className="text-white font-mono">{p.rsi}</span></span>
          <span className="text-[var(--muted)]">%B <span className="text-white font-mono">{p.bb_pct_b}%</span></span>
          <span className="text-[var(--muted)]">Vol <span className="text-white font-mono">{p.volume_ratio}x</span></span>
        </div>
      </div>
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

  return (
    <div onClick={() => nav(`/${item.symbol.replace(/\//g, '_')}?market=${item.market_type || item.market}`)}
      className="bg-[var(--bg)] border border-[var(--border)] rounded-lg p-3.5 md:p-2.5 cursor-pointer hover:border-green-500/50 transition active:scale-[0.98]">
      <div className="flex items-center justify-between mb-1.5 md:mb-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] md:text-[10px] bg-[var(--border)] text-white w-5 h-5 md:w-4 md:h-4 rounded flex items-center justify-center font-mono">{index + 1}</span>
          <span className="text-white font-semibold text-base md:text-sm truncate">{item.display_name}</span>
          <span className="text-[var(--muted)] text-[11px] md:text-[10px] shrink-0">{item.symbol}</span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {item.trend === 'BULL' && (
            <span className="text-[10px] md:text-[9px] font-bold text-green-400 bg-green-400/10 px-1.5 md:px-1 py-0.5 rounded">상승추세</span>
          )}
          <span className={`text-[10px] md:text-[9px] font-bold px-1.5 md:px-1 py-0.5 rounded ${
            item.last_signal === 'SQZ BUY' ? 'bg-cyan-500/20 text-cyan-400' : 'bg-green-500/20 text-green-400'
          }`}>{item.last_signal}</span>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-1.5">
          <span className={`text-lg md:text-sm font-mono font-semibold transition-colors duration-300 ${flashClass}`}>
            {fmtPrice(price, item.market)}
          </span>
          <span className={`text-[11px] md:text-[10px] font-mono ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {pct >= 0 ? '+' : ''}{pct}%
          </span>
        </div>
        <div className="flex items-center gap-2.5 md:gap-2 text-[11px] md:text-[9px]">
          <span className="text-[var(--muted)]">{item.last_signal_date}</span>
          {item.rsi != null && <span className="text-[var(--muted)]">RSI <span className="text-white font-mono">{item.rsi?.toFixed(0)}</span></span>}
        </div>
      </div>
    </div>
  )
}
