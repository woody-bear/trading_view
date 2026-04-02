import { Bell, CheckCircle, ChevronDown, ChevronUp, Clock, Loader2, RefreshCw, Search, TrendingUp, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFullScanHistory, fetchFullScanLatest, fetchFullScanStatus, fetchScanSymbols, fetchSnapshotBuyItems, triggerFullScan } from '../api/client'

// ── 타입 정의 ────────────────────────────────────────────────

interface StockSymbol {
  symbol: string
  name: string
  market: string
  market_type: string
  is_etf: boolean
  indices?: string[]
}

interface Breakdown {
  kospi: number
  kospi_etf: number
  kosdaq: number
  nasdaq100: number
  sp500: number
  russell1000: number
  us_etf: number
}

interface ScanSlot {
  time: string
  label: string
  market: 'KR' | 'US'
  status: 'completed' | 'running' | 'pending'
  completedAt?: string
  scannedCount?: number
  buyCount?: number
  elapsedSeconds?: number
  snapshotId?: number
}

// ── 스캔 스케줄 정의 (9개 슬롯) ─────────────────────────────

const SCAN_SCHEDULE: { time: string; label: string; market: 'KR' | 'US' }[] = [
  { time: '09:30', label: '09:30', market: 'KR' },
  { time: '10:30', label: '10:30', market: 'KR' },
  { time: '11:30', label: '11:30', market: 'KR' },
  { time: '12:30', label: '12:30', market: 'KR' },
  { time: '13:30', label: '13:30', market: 'KR' },
  { time: '14:30', label: '14:30', market: 'KR' },
  { time: '15:30', label: '15:30', market: 'KR' },
  { time: '19:50', label: '19:50', market: 'US' },
  { time: '03:50', label: '03:50', market: 'US' },
]

// ── 슬롯 매핑 유틸 ───────────────────────────────────────────

function toKSTMinutes(isoStr: string): number {
  const d = new Date(isoStr)
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000)
  return kst.getUTCHours() * 60 + kst.getUTCMinutes()
}

function slotMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function buildScanSlots(history: any[], status: any | null): ScanSlot[] {
  const slots: ScanSlot[] = SCAN_SCHEDULE.map(s => ({
    time: s.time, label: s.label, market: s.market, status: 'pending',
  }))

  // 완료된 스캔을 슬롯에 매핑 (±20분)
  const matched = new Set<number>()
  for (const item of history) {
    if (item.status !== 'completed') continue
    const startMin = toKSTMinutes(item.started_at)
    let best = -1, bestDiff = 999
    slots.forEach((s, i) => {
      if (matched.has(i)) return
      const diff = Math.abs(slotMinutes(s.time) - startMin)
      if (diff < 20 && diff < bestDiff) { bestDiff = diff; best = i }
    })
    if (best >= 0) {
      matched.add(best)
      slots[best] = {
        ...slots[best],
        status: 'completed',
        completedAt: item.completed_at,
        scannedCount: item.scanned_count,
        buyCount: item.buy_count,
        elapsedSeconds: item.elapsed_seconds,
        snapshotId: item.id,
      }
    }
  }

  // 진행 중인 슬롯
  if (status?.running) {
    const nowKST = toKSTMinutes(new Date().toISOString())
    let closest = -1, closestDiff = 999
    slots.forEach((s, i) => {
      if (matched.has(i)) return
      const diff = Math.abs(slotMinutes(s.time) - nowKST)
      if (diff < closestDiff) { closestDiff = diff; closest = i }
    })
    if (closest >= 0) slots[closest] = { ...slots[closest], status: 'running', elapsedSeconds: status.elapsed_seconds }
  }

  return slots
}

// ── 조회 조건 패널 ───────────────────────────────────────────

function ScanConditionPanel() {
  const [open, setOpen] = useState(false)

  const COND_BLOCKS = [
    {
      title: '📊 차트 BUY 신호',
      color: 'text-green-400',
      border: 'border-green-500/20',
      bg: 'bg-green-500/5',
      rows: [
        { label: '기준 봉', value: '일봉 (1D)' },
        { label: '신호 유효기간', value: '3일 이내' },
        { label: '데드크로스 제외', value: 'EMA20 < EMA50 → 종목 제외' },
        { label: '사전 필터', value: 'RSI < 55 또는 스퀴즈 Lv ≥ 1' },
        { label: 'BUY 판정', value: 'Pine Script 시뮬레이션 — BUY / SQZ BUY 마커' },
      ],
    },
    {
      title: '⭐ 추천 종목',
      color: 'text-yellow-400',
      border: 'border-yellow-500/20',
      bg: 'bg-yellow-500/5',
      rows: [
        { label: '스퀴즈', value: 'Lv 1 이상 (밴드 수축 중)' },
        { label: 'EMA 배열', value: 'BULL 정배열 (EMA20 > EMA50 > EMA200)' },
        { label: '점수 산정', value: 'SQ×25 + BULL+15 + RSI<40+10 + BB<30%+5 + MACD>0+5 + Vol>1+5' },
      ],
    },
    {
      title: '🔥 투자과열 신호',
      color: 'text-orange-400',
      border: 'border-orange-500/20',
      bg: 'bg-orange-500/5',
      rows: [
        { label: '대상', value: '국내 개별주 (ETF 제외)' },
        { label: '조건 A', value: 'RSI ≥ 70' },
        { label: '조건 B', value: 'RSI ≥ 65 + 거래량비율 ≥ 2.0x (OR)' },
      ],
    },
  ]

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg mb-4 overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-semibold text-white">신호 조회 조건</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-[var(--muted)]">
            {open ? '접기' : '펼쳐서 상세 조건 보기'}
          </span>
          {open ? <ChevronUp size={14} className="text-[var(--muted)]" /> : <ChevronDown size={14} className="text-[var(--muted)]" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-[var(--border)] p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {COND_BLOCKS.map(block => (
            <div key={block.title} className={`rounded-lg border ${block.border} ${block.bg} p-3`}>
              <div className={`text-[11px] font-bold mb-2 ${block.color}`}>{block.title}</div>
              <table className="w-full text-[10px]">
                <tbody>
                  {block.rows.map(row => (
                    <tr key={row.label} className="border-b border-white/5 last:border-0">
                      <td className="py-1 pr-2 text-[var(--muted)] whitespace-nowrap align-top w-24">{row.label}</td>
                      <td className="py-1 text-white/80 leading-relaxed">{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 지수 뱃지 ────────────────────────────────────────────────

const INDEX_BADGE: Record<string, { label: string; cls: string }> = {
  SP500:      { label: 'S&P500',    cls: 'bg-emerald-500/20 text-emerald-300' },
  NASDAQ100:  { label: 'NQ100',     cls: 'bg-blue-500/20 text-blue-300' },
  RUSSELL1000:{ label: 'R1000',     cls: 'bg-orange-500/20 text-orange-300' },
}

// ── 카테고리 테이블 컴포넌트 ─────────────────────────────────

function SymbolTable({ title, items, onRowClick }: {
  title: string; items: StockSymbol[]; onRowClick: (s: StockSymbol) => void
}) {
  if (items.length === 0) return null
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-2 px-1">
        <h3 className="text-sm font-semibold text-[var(--muted)]">{title}</h3>
        <span className="text-xs text-[var(--muted)] bg-[var(--border)] px-1.5 py-0.5 rounded">{items.length.toLocaleString()}개</span>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--navy)]">
              <th className="text-left px-3 py-2 text-[10px] text-[var(--muted)] w-10">#</th>
              <th className="text-left px-3 py-2 text-[10px] text-[var(--muted)] w-24">코드</th>
              <th className="text-left px-3 py-2 text-[10px] text-[var(--muted)]">종목명</th>
              <th className="text-left px-3 py-2 text-[10px] text-[var(--muted)]">지수</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => (
              <tr
                key={item.symbol}
                onClick={() => onRowClick(item)}
                className="border-b border-[var(--border)]/50 hover:bg-white/5 cursor-pointer transition-colors active:bg-white/10"
              >
                <td className="px-3 py-2 text-[11px] text-[var(--muted)] font-mono">{i + 1}</td>
                <td className="px-3 py-2 text-[11px] text-[var(--gold)] font-mono">{item.symbol}</td>
                <td className="px-3 py-2 text-[12px] text-white">{item.name}</td>
                <td className="px-3 py-2">
                  <div className="flex flex-wrap gap-1">
                    {item.is_etf && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-purple-500/20 text-purple-400">ETF</span>
                    )}
                    {item.indices && item.indices.map(idx => {
                      const b = INDEX_BADGE[idx]
                      return b ? (
                        <span key={idx} className={`text-[9px] px-1 py-0.5 rounded ${b.cls}`}>{b.label}</span>
                      ) : null
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── 스냅샷 BUY 종목 모달 ────────────────────────────────────

function SlotBuyModal({ slot, onClose, nav }: { slot: ScanSlot; onClose: () => void; nav: (p: string) => void }) {
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!slot.snapshotId) { setLoading(false); return }
    fetchSnapshotBuyItems(slot.snapshotId)
      .then(r => setItems(r.items || []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [slot.snapshotId])

  const kstLabel = slot.completedAt
    ? (() => {
        const d = new Date(slot.completedAt.endsWith('Z') ? slot.completedAt : slot.completedAt + 'Z')
        const kst = new Date(d.getTime() + 9 * 3600000)
        return `${kst.getMonth() + 1}/${kst.getDate()} ${String(kst.getHours()).padStart(2, '0')}:${String(kst.getMinutes()).padStart(2, '0')}`
      })()
    : slot.label

  const sqColor: Record<number, string> = { 0: 'text-gray-400', 1: 'text-yellow-400', 2: 'text-orange-400', 3: 'text-red-400' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div>
            <span className="text-sm font-bold text-green-400">차트 BUY 신호</span>
            <span className="text-xs text-[var(--muted)] ml-2">{kstLabel} · {slot.market === 'KR' ? '국내' : '미국'}</span>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded font-mono">{items.length}종목</span>}
            <button onClick={onClose} className="text-[var(--muted)] hover:text-white"><X size={16} /></button>
          </div>
        </div>
        {/* 바디 */}
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[var(--gold)]" /></div>
          ) : items.length === 0 ? (
            <p className="text-center py-8 text-sm text-[var(--muted)]">이 스캔에서 BUY 신호 종목이 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] text-[var(--muted)] border-b border-[var(--border)]">
                  <th className="text-left px-2 py-1.5">#</th>
                  <th className="text-left px-2 py-1.5">코드</th>
                  <th className="text-left px-2 py-1.5">종목명</th>
                  <th className="text-right px-2 py-1.5">RSI</th>
                  <th className="text-right px-2 py-1.5">SQ</th>
                  <th className="text-right px-2 py-1.5">BUY날짜</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, i) => (
                  <tr key={item.symbol}
                    onClick={() => { nav(`/${item.symbol}?market=${item.market_type}`); onClose() }}
                    className="border-b border-[var(--border)]/40 hover:bg-white/5 cursor-pointer transition-colors">
                    <td className="px-2 py-1.5 text-[11px] text-[var(--muted)]">{i + 1}</td>
                    <td className="px-2 py-1.5 text-[11px] text-[var(--gold)] font-mono">{item.symbol}</td>
                    <td className="px-2 py-1.5 text-[12px] text-white truncate max-w-[140px]">{item.name}</td>
                    <td className="px-2 py-1.5 text-right text-[11px] text-cyan-400">{item.rsi?.toFixed(0)}</td>
                    <td className={`px-2 py-1.5 text-right text-[11px] font-bold ${sqColor[item.squeeze_level ?? 0]}`}>Lv{item.squeeze_level}</td>
                    <td className="px-2 py-1.5 text-right text-[10px] text-[var(--muted)]">{item.last_signal_date ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 스캔 슬롯 카드 ───────────────────────────────────────────

function SlotCard({ slot, onClick }: { slot: ScanSlot; onClick?: () => void }) {
  const isKR = slot.market === 'KR'
  const clickable = slot.status === 'completed' && !!slot.snapshotId
  const base = `flex flex-col items-center justify-center w-full h-[68px] md:h-[76px] rounded-lg border px-2 py-1.5 transition-all ${clickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : ''}`

  if (slot.status === 'completed') {
    return (
      <div className={`${base} border-green-500/40 bg-green-500/10 hover:border-green-400/70`} onClick={clickable ? onClick : undefined} title={clickable ? 'BUY 종목 보기' : ''}>
        <CheckCircle size={14} className="text-green-400 mb-1" />
        <span className="text-[11px] font-bold text-green-400">{slot.label}</span>
        <span className="text-[9px] text-green-400/70">{isKR ? '국내' : '미국'}</span>
        {slot.buyCount != null && (
          <span className="text-[9px] text-green-300 mt-0.5">BUY {slot.buyCount}개</span>
        )}
      </div>
    )
  }

  if (slot.status === 'running') {
    return (
      <div className={`${base} border-orange-500/60 bg-orange-500/10 animate-pulse`}>
        <RefreshCw size={14} className="text-orange-400 mb-1 animate-spin" />
        <span className="text-[11px] font-bold text-orange-400">{slot.label}</span>
        <span className="text-[9px] text-orange-400/70">{isKR ? '국내' : '미국'}</span>
        <span className="text-[9px] text-orange-300 mt-0.5">진행중</span>
      </div>
    )
  }

  return (
    <div className={`${base} border-[var(--border)] bg-[var(--bg)]`}>
      <Clock size={14} className="text-[var(--muted)] mb-1" />
      <span className="text-[11px] font-bold text-[var(--muted)]">{slot.label}</span>
      <span className="text-[9px] text-[var(--muted)]/60">{isKR ? '국내' : '미국'}</span>
      <span className="text-[9px] text-[var(--muted)]/50 mt-0.5">예정</span>
    </div>
  )
}

// ── 메인 페이지 ──────────────────────────────────────────────

export default function BuyList() {
  const nav = useNavigate()
  const [symbols, setSymbols] = useState<StockSymbol[]>([])
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null)
  const [activeTab, setActiveTab] = useState<'KR' | 'US'>('KR')
  const [searchQuery, setSearchQuery] = useState('')

  const [scanSlots, setScanSlots] = useState<ScanSlot[]>(
    SCAN_SCHEDULE.map(s => ({ ...s, status: 'pending' as const }))
  )
  const [scanStatus, setScanStatus] = useState<any>(null)
  const [scanBoardLoading, setScanBoardLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<ScanSlot | null>(null)
  const [autoInfo, setAutoInfo] = useState<{ type: 'prev' | 'trigger'; label: string } | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  // 종목 목록 로드 (인증 불필요, plain fetch)
  useEffect(() => {
    fetchScanSymbols()
      .then(symData => {
        setSymbols(symData.symbols || [])
        setBreakdown(symData.breakdown || null)
      })
      .catch(e => console.error('fetchScanSymbols error:', e))
  }, [])

  // 스캔 상황판 별도 로드 + 빈 상황판 자동 처리
  useEffect(() => {
    const loadScanBoard = async () => {
      try {
        const [historyData, status] = await Promise.all([
          fetchFullScanHistory(20),
          fetchFullScanStatus(),
        ])
        const history = historyData.history || []
        setScanStatus(status)
        const slots = buildScanSlots(history, status)
        setScanSlots(slots)

        // 모든 슬롯이 예정 상태이고, 스캔 실행 중이 아닐 때 자동 처리
        const allPending = slots.every(s => s.status === 'pending')
        if (allPending && !status?.running) {
          // KST 현재 시간 (분)
          const nowKST = (() => {
            const d = new Date()
            const kst = new Date(d.getTime() + 9 * 3600000)
            return kst.getUTCHours() * 60 + kst.getUTCMinutes()
          })()

          const schedMins = [9*60+30, 10*60+30, 11*60+30, 12*60+30, 13*60+30, 14*60+30, 15*60+30, 19*60+50, 3*60+50]
          const past = schedMins.filter(m => m <= nowKST)
          const future = schedMins.filter(m => m > nowKST)

          const prevDiff = past.length > 0 ? nowKST - Math.max(...past) : Infinity
          const nextDiff = future.length > 0 ? Math.min(...future) - nowKST : Infinity

          if (history.length > 0 && prevDiff <= nextDiff) {
            // 이전 스냅샷이 더 가까움 → 최신 스냅샷 자동 로드
            const latest = await fetchFullScanLatest()
            if (latest && latest.status !== 'no_data') {
              const fakeSlot: ScanSlot = {
                time: '00:00', label: '이전 스캔', market: 'KR',
                status: 'completed',
                completedAt: latest.completed_at,
                scannedCount: latest.scanned_count,
                buyCount: latest.buy_count,
                snapshotId: latest.snapshot_id,
              }
              setSelectedSlot(fakeSlot)
              setAutoInfo({ type: 'prev', label: `이전 스캔 기록 자동 로드 (${latest.completed_at?.slice(0, 10) ?? ''})` })
            }
          } else {
            // 다음 스케줄이 더 가까움 → 스캔 즉시 실행
            await triggerFullScan()
            setAutoInfo({ type: 'trigger', label: '데이터 없음 → 스캔을 자동 시작했습니다' })
            setScanStatus((prev: any) => ({ ...prev, running: true }))
          }
        }
      } catch (e) {
        console.error('scanBoard load error:', e)
      } finally {
        setScanBoardLoading(false)
      }
    }
    loadScanBoard()
  }, [])

  // 스캔 진행중일 때 5초 폴링
  const refreshStatus = useCallback(async () => {
    try {
      const [history, status] = await Promise.all([
        fetchFullScanHistory(20),
        fetchFullScanStatus(),
      ])
      setScanStatus(status)
      setScanSlots(buildScanSlots(history.history || [], status))
    } catch {}
  }, [])

  useEffect(() => {
    if (!scanStatus?.running) {
      if (pollTimer.current) { clearInterval(pollTimer.current); pollTimer.current = null }
      return
    }
    pollTimer.current = setInterval(refreshStatus, 5000)
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [scanStatus?.running, refreshStatus])

  // 종목 검색 필터 (클라이언트 사이드)
  const filteredSymbols = useMemo(() => {
    if (!searchQuery.trim()) return symbols
    const q = searchQuery.trim().toUpperCase()
    return symbols.filter(s =>
      s.name.toUpperCase().includes(q) ||
      s.symbol.toUpperCase().includes(q)
    )
  }, [symbols, searchQuery])

  // 카테고리별 분류
  const byCategory = useMemo(() => ({
    kospi:       filteredSymbols.filter(s => s.market_type === 'KOSPI' && !s.is_etf),
    kospiEtf:    filteredSymbols.filter(s => s.market_type === 'KOSPI' && s.is_etf),
    kosdaq:      filteredSymbols.filter(s => s.market_type === 'KOSDAQ'),
    nasdaq100:   filteredSymbols.filter(s => s.market_type === 'NASDAQ100'),
    sp500:       filteredSymbols.filter(s => s.market_type === 'SP500'),
    russell1000: filteredSymbols.filter(s => s.market_type === 'RUSSELL1000'),
    usEtf:       filteredSymbols.filter(s => s.market_type === 'ETF' || s.market_type === 'NYSE'),
  }), [filteredSymbols])

  const hasSearchResult = filteredSymbols.length > 0
  const krTotal = (breakdown?.kospi ?? 0) + (breakdown?.kospi_etf ?? 0) + (breakdown?.kosdaq ?? 0)
  const usTotal = (breakdown?.nasdaq100 ?? 0) + (breakdown?.sp500 ?? 0) + (breakdown?.russell1000 ?? 0) + (breakdown?.us_etf ?? 0)
  const total = breakdown ? krTotal + usTotal : 0

  const handleRowClick = (item: StockSymbol) => {
    const market = item.market_type || item.market
    nav(`/${item.symbol}?market=${market}`)
  }

  // KR 슬롯과 US 슬롯 분리
  const krSlots = scanSlots.filter(s => s.market === 'KR')
  const usSlots = scanSlots.filter(s => s.market === 'US')

  return (
    <div className="p-3 md:p-6 max-w-7xl mx-auto">
      {/* 페이지 제목 */}
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp size={20} className="text-cyan-400" />
        <h1 className="text-lg font-bold text-white">BUY 조회종목 리스트</h1>
        <span className="text-xs text-[var(--muted)]">전체 스캔 대상 종목</span>
      </div>

      {/* ── 총 종목수 요약 배너 ── */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
          <div className="text-2xl md:text-xl font-bold text-white font-mono">{total.toLocaleString()}</div>
          <div className="text-[10px] md:text-[10px] text-[var(--muted)]">총 스캔 종목</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
          <div className="text-2xl md:text-xl font-bold text-blue-400 font-mono">{krTotal.toLocaleString()}</div>
          <div className="text-[10px] md:text-[10px] text-[var(--muted)]">국내 (9:30~15:30)</div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 text-center">
          <div className="text-2xl md:text-xl font-bold text-emerald-400 font-mono">{usTotal.toLocaleString()}</div>
          <div className="text-[10px] md:text-[10px] text-[var(--muted)]">미국 (19:50/03:50)</div>
        </div>
      </div>

      {/* ── 스캔 범위 설명 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2">
          <div className="text-[10px] font-semibold text-blue-400 mb-1.5">🇰🇷 국내 스캔 대상</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: '코스피200', count: breakdown?.kospi ?? 0, color: 'bg-blue-500/20 text-blue-300' },
              { label: '코스닥150', count: breakdown?.kosdaq ?? 0, color: 'bg-cyan-500/20 text-cyan-300' },
              { label: 'KRX반도체/2차전지', count: (krTotal - (breakdown?.kospi ?? 0) - (breakdown?.kosdaq ?? 0)), color: 'bg-indigo-500/20 text-indigo-300' },
            ].map(b => (
              <span key={b.label} className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${b.color}`}>
                {b.label} {b.count > 0 ? `${b.count}` : ''}
              </span>
            ))}
          </div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
          <div className="text-[10px] font-semibold text-emerald-400 mb-1.5">🇺🇸 미국+암호화폐 스캔 대상</div>
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: 'S&P 500', count: breakdown?.sp500 ?? 0, color: 'bg-emerald-500/20 text-emerald-300' },
              { label: '나스닥100 단독', count: breakdown?.nasdaq100 ?? 0, color: 'bg-green-500/20 text-green-300' },
              { label: 'Russell1000 단독', count: breakdown?.russell1000 ?? 0, color: 'bg-orange-500/20 text-orange-300' },
            ].map(b => (
              <span key={b.label} className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${b.color}`}>
                {b.label} {b.count > 0 ? `${b.count}` : ''}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── 조회 조건 ── */}
      <ScanConditionPanel />

      {/* ── 자동 처리 안내 배너 ── */}
      {autoInfo && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg mb-3 text-xs ${
          autoInfo.type === 'trigger'
            ? 'bg-orange-500/10 border border-orange-500/30 text-orange-300'
            : 'bg-blue-500/10 border border-blue-500/30 text-blue-300'
        }`}>
          <Zap size={12} className="shrink-0" />
          <span>{autoInfo.label}</span>
          <button onClick={() => setAutoInfo(null)} className="ml-auto opacity-60 hover:opacity-100"><X size={12} /></button>
        </div>
      )}

      {/* ── 스캔 상황판 ── */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 md:p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">스캔 스케줄 현황</h2>
          {scanBoardLoading ? (
            <Loader2 size={12} className="animate-spin text-[var(--muted)]" />
          ) : scanStatus?.running && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[10px] text-orange-400 flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" />
                스캔 진행중
                {scanStatus.progress_pct > 0 && ` ${scanStatus.progress_pct}%`}
              </span>
              {scanStatus.scanned_count > 0 && (
                <span className="text-[9px] text-[var(--muted)]">
                  {scanStatus.scanned_count.toLocaleString()} / {scanStatus.total_symbols?.toLocaleString()}종목
                </span>
              )}
            </div>
          )}
        </div>

        {/* 국내 슬롯 */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-blue-400 font-semibold">🇰🇷 국내 스캔</span>
            <span className="text-[10px] text-[var(--muted)] leading-relaxed">평일 매시 :30 (9:30~15:30) · 완료 슬롯 탭 → BUY 종목 확인</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {krSlots.map(slot => <SlotCard key={slot.time} slot={slot} onClick={() => setSelectedSlot(slot)} />)}
          </div>
        </div>

        {/* 미국 슬롯 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-emerald-400 font-semibold">🇺🇸 미국+암호화폐 스캔</span>
            <span className="text-[9px] text-[var(--muted)]">19:50 / 03:50 KST · S&P500+나스닥100+Russell1000+암호화폐</span>
          </div>
          <div className="flex gap-2">
            {usSlots.map(slot => <SlotCard key={slot.time} slot={slot} onClick={() => setSelectedSlot(slot)} />)}
          </div>
        </div>
      </div>

      {/* ── 슬롯 BUY 종목 모달 ── */}
      {selectedSlot && (
        <SlotBuyModal slot={selectedSlot} onClose={() => setSelectedSlot(null)} nav={nav} />
      )}

      {/* ── 텔레그램 알림 스케줄 ── */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 md:p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Bell size={14} className="text-sky-400" />
          <h2 className="text-sm font-semibold text-white">텔레그램 자동 알림 스케줄</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {/* BUY 신호 알림 */}
          <div>
            <div className="text-[10px] text-green-400 font-semibold mb-2">🟢 BUY 신호 알림 (전체 시장 스캔 후 발송)</div>
            <div className="space-y-1.5">
              {[
                { time: '평일 10:30', label: '국내 BUY 신호', color: 'text-green-400' },
                { time: '평일 15:00', label: '국내 BUY 신호', color: 'text-green-400' },
                { time: '평일 20:00', label: '미국 BUY 신호', color: 'text-emerald-400' },
                { time: '화~토 04:00', label: '미국 장중 BUY 신호', color: 'text-emerald-400' },
              ].map(row => (
                <div key={row.time} className="flex items-start gap-3 py-0.5">
                  <span className={`font-mono font-semibold shrink-0 whitespace-nowrap text-[11px] ${row.color}`}>{row.time}</span>
                  <span className="text-[var(--muted)]">{row.label}</span>
                </div>
              ))}
            </div>
          </div>
          {/* SELL 체크 알림 */}
          <div>
            <div className="text-[10px] text-red-400 font-semibold mb-2">🔴 SELL 체크 (관심종목 대상)</div>
            <div className="space-y-1.5">
              {[
                { time: '평일 09:00~15:30', label: '국내 관심종목 (30분마다 · 14회)', color: 'text-yellow-400' },
                { time: '평일 20:00', label: '미국 관심종목 SELL 체크', color: 'text-orange-400' },
                { time: '화~토 04:00', label: '미국 장중 SELL 체크', color: 'text-orange-400' },
              ].map(row => (
                <div key={row.time} className="flex items-start gap-3 py-0.5">
                  <span className={`font-mono font-semibold shrink-0 whitespace-nowrap text-[11px] ${row.color}`}>{row.time}</span>
                  <span className="text-[var(--muted)]">{row.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p className="text-[10px] text-[var(--muted)] mt-3 pt-2 border-t border-[var(--border)]/40">
          ※ 텔레그램 봇 설정은 설정 페이지에서 관리 · BUY 알림은 스캔 완료 후 자동 발송
        </p>
      </div>

      {/* ── 검색창 ── */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
        <input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="종목명 또는 코드 검색... (예: 삼성전자, AAPL)"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-form-type="other"
          name="buy-symbol-search"
          className="w-full pl-9 pr-8 py-2.5 bg-[var(--card)] border border-[var(--border)] rounded-lg text-white text-sm placeholder:text-slate-500 focus:border-cyan-500/50 focus:outline-none"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)] hover:text-white"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* ── 국내/미국 탭 ── */}
      {!searchQuery && (
        <div className="flex border-b border-[var(--border)] mb-4">
          {(['KR', 'US'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[var(--gold)] text-[var(--gold)]'
                  : 'border-transparent text-[var(--muted)] hover:text-white'
              }`}
            >
              {tab === 'KR' ? `국내 (${krTotal.toLocaleString()})` : `미국 (${usTotal.toLocaleString()})`}
            </button>
          ))}
        </div>
      )}

      {/* ── 종목 테이블 ── */}
      {searchQuery ? (
        // 검색 결과: 탭 없이 전체 표시
        <div>
          {hasSearchResult ? (
            <>
              {byCategory.kospi.length > 0 && <SymbolTable title="코스피" items={byCategory.kospi} onRowClick={handleRowClick} />}
              {byCategory.kospiEtf.length > 0 && <SymbolTable title="코스피 ETF" items={byCategory.kospiEtf} onRowClick={handleRowClick} />}
              {byCategory.kosdaq.length > 0 && <SymbolTable title="코스닥" items={byCategory.kosdaq} onRowClick={handleRowClick} />}
              {byCategory.nasdaq100.length > 0 && <SymbolTable title="NASDAQ 100 (QQQ)" items={byCategory.nasdaq100} onRowClick={handleRowClick} />}
              {byCategory.sp500.length > 0 && <SymbolTable title="S&P 500" items={byCategory.sp500} onRowClick={handleRowClick} />}
              {byCategory.russell1000.length > 0 && <SymbolTable title="Russell 1000 단독" items={byCategory.russell1000} onRowClick={handleRowClick} />}
              {byCategory.usEtf.length > 0 && <SymbolTable title="미국 ETF" items={byCategory.usEtf} onRowClick={handleRowClick} />}
            </>
          ) : (
            <div className="text-center py-12 text-[var(--muted)]">
              <p className="text-sm">"{searchQuery}"에 해당하는 종목이 없습니다</p>
            </div>
          )}
        </div>
      ) : activeTab === 'KR' ? (
        // 국내 탭
        <>
          <SymbolTable title="코스피" items={byCategory.kospi} onRowClick={handleRowClick} />
          <SymbolTable title="코스닥" items={byCategory.kosdaq} onRowClick={handleRowClick} />
          <SymbolTable title="코스피 ETF" items={byCategory.kospiEtf} onRowClick={handleRowClick} />
        </>
      ) : (
        // 미국 탭 (NASDAQ 100 / S&P 500 / Russell1000 / ETF)
        <>
          <SymbolTable title="NASDAQ 100 (QQQ)" items={byCategory.nasdaq100} onRowClick={handleRowClick} />
          <SymbolTable title="S&P 500" items={byCategory.sp500} onRowClick={handleRowClick} />
          <SymbolTable title="Russell 1000 단독" items={byCategory.russell1000} onRowClick={handleRowClick} />
          <SymbolTable title="미국 ETF" items={byCategory.usEtf} onRowClick={handleRowClick} />
        </>
      )}
    </div>
  )
}
