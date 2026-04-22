import ConditionsSection from '../components/conditions/ConditionsSection'
import {
  BUY_PIPELINE_STEPS,
  BUY_PIPELINE_MERMAID,
  SELL_FLOWCHART_STEPS,
  SELL_FLOWCHART_MERMAID,
  CONDITION_VALUES,
} from '../constants/conditions'
import { Bell, CheckCircle, ChevronDown, ChevronUp, Clock, Loader2, RefreshCw, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchFullScanHistory, fetchFullScanLatest, fetchFullScanStatus, fetchSnapshotBuyItems, triggerFullScan } from '../api/client'

const SELL_GUIDANCE =
  'SELL 라벨은 추천종목·눌림목 스냅샷 생성에는 사용되지 않습니다. ' +
  '관심종목(Watchlist) 등록 종목 대상으로 (1) 상태 전환 시 즉시 텔레그램 알림, ' +
  '(2) 정기 SELL 알림(KR: 09:00~15:30 KST 30분 주기 / US: 20:00·04:00 KST)으로 사용됩니다.'

// ── 스캔 스케줄 ────────────────────────────────────────────────

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
        ...slots[best], status: 'completed',
        completedAt: item.completed_at,
        scannedCount: item.scanned_count,
        buyCount: item.buy_count,
        elapsedSeconds: item.elapsed_seconds,
        snapshotId: item.id,
      }
    }
  }
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

// ── 슬롯 카드 ──────────────────────────────────────────────────

function SlotCard({ slot, onClick }: { slot: ScanSlot; onClick?: () => void }) {
  const isKR = slot.market === 'KR'
  const clickable = slot.status === 'completed' && !!slot.snapshotId
  const base = `flex flex-col items-center justify-center w-full h-[88px] md:h-[96px] rounded-xl border px-2 py-2 transition-all ${clickable ? 'cursor-pointer hover:scale-105 hover:shadow-lg' : ''}`
  if (slot.status === 'completed') {
    return (
      <div className={`${base} border-green-500/40 bg-green-500/10 hover:border-green-400/70`} onClick={clickable ? onClick : undefined} title={clickable ? 'BUY 종목 보기' : ''}>
        <CheckCircle size={16} className="text-green-400 mb-1" />
        <span className="text-label font-bold text-green-400">{slot.label}</span>
        <span className="text-caption text-green-400/70">{isKR ? '국내' : '미국'}</span>
        {slot.buyCount != null && <span className="text-caption text-green-300 mt-0.5">BUY {slot.buyCount}개</span>}
      </div>
    )
  }
  if (slot.status === 'running') {
    return (
      <div className={`${base} border-orange-500/60 bg-orange-500/10 animate-pulse`}>
        <RefreshCw size={16} className="text-orange-400 mb-1 animate-spin" />
        <span className="text-label font-bold text-orange-400">{slot.label}</span>
        <span className="text-caption text-orange-400/70">{isKR ? '국내' : '미국'}</span>
        <span className="text-caption text-orange-300 mt-0.5">진행중</span>
      </div>
    )
  }
  return (
    <div className={`${base} border-[var(--border)] bg-[var(--bg)]`}>
      <Clock size={16} className="text-[var(--muted)] mb-1" />
      <span className="text-label font-bold text-[var(--muted)]">{slot.label}</span>
      <span className="text-caption text-[var(--muted)]/60">{isKR ? '국내' : '미국'}</span>
      <span className="text-caption text-[var(--muted)]/50 mt-0.5">예정</span>
    </div>
  )
}

// ── 슬롯 BUY 종목 모달 ────────────────────────────────────────

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
        <div className="overflow-y-auto flex-1 p-2">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-[var(--gold)]" /></div>
          ) : items.length === 0 ? (
            <p className="text-center py-8 text-sm text-[var(--muted)]">이 스캔에서 BUY 신호 종목이 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-caption text-[var(--muted)] border-b border-[var(--border)]">
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
                    <td className="px-2 py-1.5 text-caption text-[var(--muted)]">{i + 1}</td>
                    <td className="px-2 py-1.5 text-caption text-[var(--gold)] font-mono">{item.symbol}</td>
                    <td className="px-2 py-1.5 text-label text-white truncate max-w-[140px]">{item.name}</td>
                    <td className="px-2 py-1.5 text-right text-caption text-cyan-400">{item.rsi?.toFixed(0)}</td>
                    <td className={`px-2 py-1.5 text-right text-caption font-bold ${sqColor[item.squeeze_level ?? 0]}`}>Lv{item.squeeze_level}</td>
                    <td className="px-2 py-1.5 text-right text-caption text-[var(--muted)]">{item.last_signal_date ?? '-'}</td>
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

// ── 신호 조회 조건 패널 ────────────────────────────────────────

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
        { label: '거래량 조건', value: '신호일 거래량 > 직전 5거래일 평균' },
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
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/3 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-semibold text-white">신호 조회 조건</span>
        <div className="flex items-center gap-2">
          <span className="text-caption text-[var(--muted)]">
            {open ? '접기' : '펼쳐서 상세 조건 보기'}
          </span>
          {open ? <ChevronUp size={14} className="text-[var(--muted)]" /> : <ChevronDown size={14} className="text-[var(--muted)]" />}
        </div>
      </button>
      {open && (
        <div className="border-t border-[var(--border)] p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {COND_BLOCKS.map(block => (
            <div key={block.title} className={`rounded-lg border ${block.border} ${block.bg} p-3`}>
              <div className={`text-caption font-bold mb-2 ${block.color}`}>{block.title}</div>
              <table className="w-full text-caption">
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

// ── 스캔 스케줄 현황 섹션 ──────────────────────────────────────

function ScanScheduleSection() {
  const nav = useNavigate()
  const [scanSlots, setScanSlots] = useState<ScanSlot[]>(
    SCAN_SCHEDULE.map(s => ({ ...s, status: 'pending' as const }))
  )
  const [scanStatus, setScanStatus] = useState<any>(null)
  const [scanBoardLoading, setScanBoardLoading] = useState(true)
  const [selectedSlot, setSelectedSlot] = useState<ScanSlot | null>(null)
  const [autoInfo, setAutoInfo] = useState<{ type: 'prev' | 'trigger'; label: string } | null>(null)
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [historyData, status] = await Promise.all([
          fetchFullScanHistory(20),
          fetchFullScanStatus(),
        ])
        const history = historyData.history || []
        setScanStatus(status)
        const slots = buildScanSlots(history, status)
        setScanSlots(slots)

        const allPending = slots.every(s => s.status === 'pending')
        if (allPending && !status?.running) {
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
            await triggerFullScan()
            setAutoInfo({ type: 'trigger', label: '데이터 없음 → 스캔을 자동 시작했습니다' })
            setScanStatus((prev: any) => ({ ...prev, running: true }))
          }
        }
      } catch {}
      finally { setScanBoardLoading(false) }
    }
    load()
  }, [])

  const refreshStatus = useCallback(async () => {
    try {
      const [history, status] = await Promise.all([fetchFullScanHistory(20), fetchFullScanStatus()])
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

  const krSlots = scanSlots.filter(s => s.market === 'KR')
  const usSlots = scanSlots.filter(s => s.market === 'US')

  return (
    <>
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

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 md:p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-white">스캔 스케줄 현황</h2>
          {scanBoardLoading ? (
            <Loader2 size={12} className="animate-spin text-[var(--muted)]" />
          ) : scanStatus?.running && (
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-caption text-orange-400 flex items-center gap-1">
                <RefreshCw size={10} className="animate-spin" />
                스캔 진행중
                {scanStatus.progress_pct > 0 && ` ${scanStatus.progress_pct}%`}
              </span>
              {scanStatus.scanned_count > 0 && (
                <span className="text-micro text-[var(--muted)]">
                  {scanStatus.scanned_count.toLocaleString()} / {scanStatus.total_symbols?.toLocaleString()}종목
                </span>
              )}
            </div>
          )}
        </div>

        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-caption text-blue-400 font-semibold">🇰🇷 국내 스캔</span>
            <span className="text-caption text-[var(--muted)] leading-relaxed">평일 매시 :30 (9:30~15:30) · 완료 슬롯 탭 → BUY 종목 확인</span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {krSlots.map(slot => <SlotCard key={slot.time} slot={slot} onClick={() => setSelectedSlot(slot)} />)}
          </div>
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-caption text-emerald-400 font-semibold">🇺🇸 미국+암호화폐 스캔</span>
            <span className="text-micro text-[var(--muted)]">19:50 / 03:50 KST</span>
          </div>
          <div className="flex gap-2">
            {usSlots.map(slot => <SlotCard key={slot.time} slot={slot} onClick={() => setSelectedSlot(slot)} />)}
          </div>
        </div>
      </div>

      {selectedSlot && (
        <SlotBuyModal slot={selectedSlot} onClose={() => setSelectedSlot(null)} nav={nav} />
      )}
    </>
  )
}

// ── 텔레그램 알림 스케줄 ──────────────────────────────────────

function TelegramScheduleSection() {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-3 md:p-4">
      <div className="flex items-center gap-2 mb-3">
        <Bell size={14} className="text-sky-400" />
        <h2 className="text-sm font-semibold text-white">텔레그램 자동 알림 스케줄</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <div className="text-caption text-green-400 font-semibold mb-2">🟢 BUY 신호 알림 (전체 시장 스캔 후 발송)</div>
          <div className="space-y-1.5">
            {[
              { time: '평일 10:30', label: '국내 BUY 신호', color: 'text-green-400' },
              { time: '평일 15:00', label: '국내 BUY 신호', color: 'text-green-400' },
              { time: '평일 20:00', label: '미국 BUY 신호', color: 'text-emerald-400' },
              { time: '화~토 04:00', label: '미국 장중 BUY 신호', color: 'text-emerald-400' },
            ].map(row => (
              <div key={row.time} className="flex items-start gap-3 py-0.5">
                <span className={`font-mono font-semibold shrink-0 whitespace-nowrap text-caption ${row.color}`}>{row.time}</span>
                <span className="text-[var(--muted)]">{row.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-caption text-red-400 font-semibold mb-2">🔴 SELL 체크 (관심종목 대상)</div>
          <div className="space-y-1.5">
            {[
              { time: '평일 09:00~15:30', label: '국내 관심종목 (30분마다 · 14회)', color: 'text-yellow-400' },
              { time: '평일 20:00', label: '미국 관심종목 SELL 체크', color: 'text-orange-400' },
              { time: '화~토 04:00', label: '미국 장중 SELL 체크', color: 'text-orange-400' },
            ].map(row => (
              <div key={row.time} className="flex items-start gap-3 py-0.5">
                <span className={`font-mono font-semibold shrink-0 whitespace-nowrap text-caption ${row.color}`}>{row.time}</span>
                <span className="text-[var(--muted)]">{row.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="text-caption text-[var(--muted)] mt-3 pt-2 border-t border-[var(--border)]/40">
        ※ 텔레그램 봇 설정은 설정 페이지에서 관리 · BUY 알림은 스캔 완료 후 자동 발송
      </p>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────

export default function ScanConditions() {
  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* 헤더 */}
      <header>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-0)', margin: 0 }}>파이프라인</h1>
        <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6 }}>
          차트 라벨과 추천종목·눌림목 스냅샷이 생성되는 조건을 단계별로 공개합니다.
          PC(1280px+)는 플로우차트, 모바일/태블릿은 카드형 조건표로 표시합니다.
        </p>
      </header>

      {/* 신호 조회 조건 */}
      <ScanConditionPanel />

      {/* 스캔 스케줄 현황 */}
      <ScanScheduleSection />

      {/* 텔레그램 자동 알림 스케줄 */}
      <TelegramScheduleSection />

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* BUY 파이프라인 */}
      <ConditionsSection
        title="매수 통합 파이프라인"
        description="BUY·SQZ BUY 라벨 판정부터 추천종목·눌림목 확정까지의 전체 흐름"
        steps={BUY_PIPELINE_STEPS}
        pcDiagram={BUY_PIPELINE_MERMAID}
        pcDiagramId="buy-pipeline"
      />

      {/* RSI 민감도 프리셋 테이블 */}
      <section>
        <div className="label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 10 }}>
          RSI 민감도 프리셋
        </div>
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--fg-3)' }}>프리셋</th>
                <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--fg-3)' }}>BUY RSI 임계값</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(CONDITION_VALUES.RSI_BUY_PRESETS) as [string, number][]).map(([name, value], i, arr) => (
                <tr key={name} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '9px 14px', color: 'var(--fg-1)', fontWeight: 500 }}>
                    {{ strict: '엄격', normal: '보통', sensitive: '민감' }[name] ?? name}
                  </td>
                  <td className="mono" style={{ padding: '9px 14px', color: 'var(--fg-0)' }}>RSI &lt; {value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
          SELL 라벨의 RSI 기준은 민감도 프리셋과 무관하게 항상 60으로 고정됩니다.
        </p>
      </section>

      {/* 추천종목·눌림목 선정 조건 테이블 */}
      <section>
        <div className="label" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)', marginBottom: 10 }}>
          추천종목 · 눌림목 선정 조건
        </div>
        <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
                <th style={{ textAlign: 'left', padding: '8px 14px', fontSize: 11, fontWeight: 600, color: 'var(--fg-3)' }}>조건</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', width: 80 }}>추천종목</th>
                <th style={{ textAlign: 'center', padding: '8px 10px', fontSize: 11, fontWeight: 600, color: 'var(--fg-3)', width: 80 }}>눌림목</th>
              </tr>
            </thead>
            <tbody>
              {[
                { label: 'BUY 또는 SQZ BUY 라벨 발생', sub: 'BB 터치/복귀 + RSI 필터 + 모멘텀 / 스퀴즈 해제', buy: true, pull: true },
                { label: 'EMA 5선 미역배열', sub: 'EMA5 < EMA10 < EMA20 < EMA60 < EMA120 전체 역배열이면 제외', buy: true, pull: true },
                { label: '데이터 소스 신선도', sub: '마지막 봉이 오늘 기준 7 달력일 이내 (거래정지·상장폐지 차단)', buy: true, pull: true },
                { label: '신호 신선도', sub: '신호 발생 봉이 최근 20 거래일 이내', buy: true, pull: true },
                { label: '장기 상승추세', sub: 'EMA20 > EMA60 > EMA120', buy: false, pull: true },
                { label: '단기 눌림', sub: 'EMA5 현재값 < 직전값 (단기 하락 중)', buy: false, pull: true },
                { label: '대형주', sub: 'KR: KOSPI200·KOSDAQ150 포함 / US: S&P500 포함 (ETF 제외)', buy: false, pull: true },
              ].map(({ label, sub, buy, pull }, i, arr) => (
                <tr key={label} style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ fontSize: 13, color: 'var(--fg-0)', fontWeight: 500 }}>{label}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 3 }}>{sub}</div>
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 10px' }}>
                    {buy ? <span className="chip chip-up">✓</span> : <span style={{ color: 'var(--fg-4)', fontSize: 14 }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', padding: '10px 10px' }}>
                    {pull ? <span className="chip chip-up">✓</span> : <span style={{ color: 'var(--fg-4)', fontSize: 14 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: 'var(--fg-3)', marginTop: 6 }}>
          눌림목은 추천종목 조건을 모두 충족한 뒤 장기 상승추세 + 단기 눌림 + 대형주 조건을 추가로 통과한 종목입니다.
        </p>
      </section>

      <div style={{ borderTop: '1px solid var(--border)' }} />

      {/* SELL 파이프라인 */}
      <ConditionsSection
        title="SELL 라벨 (별도)"
        description="매도 신호 차트 마커 생성 조건"
        steps={SELL_FLOWCHART_STEPS}
        pcDiagram={SELL_FLOWCHART_MERMAID}
        pcDiagramId="sell-flowchart"
        guidance={SELL_GUIDANCE}
      />
    </div>
  )
}
