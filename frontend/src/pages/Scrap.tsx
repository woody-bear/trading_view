import { BookMarked, ChevronDown, ChevronUp, Edit3, Trash2, X, TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchPatternCases, updatePatternCase, deletePatternCase } from '../api/client'
import { useAuthStore } from '../store/authStore'

// ── 타입 ────────────────────────────────────────────────────────

interface PatternCase {
  id: number
  title: string
  symbol: string
  stock_name: string
  market: string
  market_type: string | null
  pattern_type: string
  signal_date: string
  entry_price: number | null
  profit_krw: number | null
  result_pct: number | null
  hold_days: number | null
  rsi: number | null
  bb_pct_b: number | null
  bb_width: number | null
  macd_hist: number | null
  volume_ratio: number | null
  ema_alignment: string | null
  squeeze_level: number | null
  conditions_met: number | null
  tags: string[]
  notes: string | null
  source: string
  created_at: string
}

const PATTERN_TYPES: { key: string; label: string; color: string }[] = [
  { key: 'all',               label: '전체',         color: 'text-white' },
  { key: 'squeeze_breakout',  label: '스퀴즈 이탈',   color: 'text-yellow-400' },
  { key: 'oversold_bounce',   label: '과매도 반등',   color: 'text-cyan-400' },
  { key: 'custom',            label: '직접 입력',     color: 'text-purple-400' },
  { key: 'chart',             label: '차트 BUY',      color: 'text-green-400' },
]

const PATTERN_LABEL: Record<string, string> = {
  squeeze_breakout: '스퀴즈 이탈',
  oversold_bounce:  '과매도 반등',
  custom:           '직접 입력',
}
const PATTERN_COLOR: Record<string, string> = {
  squeeze_breakout: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  oversold_bounce:  'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  custom:           'bg-purple-500/20 text-purple-400 border-purple-500/30',
}

// ── 툴팁 ─────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip inline-block">
      {children}
      <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-56 bg-[#1a2035] border border-[var(--border)] rounded-lg px-3 py-2 text-caption text-white/85 leading-relaxed hidden group-hover/tip:block z-50 shadow-xl whitespace-pre-line">
        {text}
        <div className="absolute top-full right-3 border-4 border-transparent border-t-[#1a2035]" />
      </div>
    </div>
  )
}

function rsiTooltip(v: number) {
  if (v < 30) return `RSI ${v.toFixed(1)} — 극도 과매도\n강한 반등 후보. 매수 최적 구간.`
  if (v < 45) return `RSI ${v.toFixed(1)} — 과매도권\n매수 적합 구간 (30~45). BUY 시그널 핵심 조건.`
  if (v < 55) return `RSI ${v.toFixed(1)} — 중립\n매수 가능하지만 모멘텀 확인 필요.`
  if (v < 70) return `RSI ${v.toFixed(1)} — 과매수 주의\n추격 매수 위험. 조정 후 진입 고려.`
  return `RSI ${v.toFixed(1)} — 과매수\n매수 위험 구간. 단기 고점 가능성.`
}

function bbPctBTooltip(v: number) {
  if (v < 0) return `BB %B ${v.toFixed(1)}% — 하단 밴드 이탈\n극단적 과매도. 강한 반등 신호.`
  if (v < 20) return `BB %B ${v.toFixed(1)}% — 하단 밴드 근접\n매수 최적 구간. 하단 지지 테스트 중.`
  if (v < 35) return `BB %B ${v.toFixed(1)}% — 하단 접근\n매수 고려 구간. 하단 밴드 방향으로 진행 중.`
  if (v < 65) return `BB %B ${v.toFixed(1)}% — 중간 구간\n중립. 상·하단 방향성 확인 필요.`
  return `BB %B ${v.toFixed(1)}% — 상단 밴드 근접\n과매수 구간. 매수 부적합.`
}

function bbwTooltip(v: number) {
  if (v < 10) return `BBW ${v.toFixed(1)}% — 강한 밴드 수축\n변동성 압축 극단. 스퀴즈 Lv3 수준.\n폭발적 방향성 이탈 임박.`
  if (v < 30) return `BBW ${v.toFixed(1)}% — 밴드 수축 중\n에너지 축적 단계. 이탈 방향 주목.`
  if (v < 60) return `BBW ${v.toFixed(1)}% — 일반 변동성\n특별한 수축 없음. 일반 매매 환경.`
  return `BBW ${v.toFixed(1)}% — 밴드 확장\n변동성이 이미 방출 중. 추세 진행 중.`
}

function macdTooltip(v: number) {
  if (v < -500) return `MACD Hist ${v.toFixed(0)} — 강한 하락 모멘텀\n음수값 크지만 회복 시 강한 매수 신호.\n히스토그램 상승 반전 여부가 핵심.`
  if (v < 0) return `MACD Hist ${v.toFixed(0)} — 약한 하락 모멘텀\n음수 + 상승 전환 시 BUY 시그널 조건 충족.`
  if (v === 0) return `MACD Hist 0 — 제로 크로스\n매수·매도 전환점.`
  return `MACD Hist +${v.toFixed(0)} — 상승 모멘텀\n양수 구간. 상승 추세 유지 중.`
}

function volumeTooltip(v: number) {
  if (v < 1.0) return `거래량 ${v.toFixed(2)}x — 거래량 부족\n신호 신뢰도 낮음. 관망 권장.`
  if (v < 1.5) return `거래량 ${v.toFixed(2)}x — 보통 수준\n유효 신호 기준(1.5x) 미달. 참고 수준.`
  if (v < 3.0) return `거래량 ${v.toFixed(2)}x — 유효 거래량\n매수 세력 유입 확인. BUY 조건 충족.`
  return `거래량 ${v.toFixed(2)}x — 강한 거래량 폭발\n세력 개입 가능성. 강한 방향성 신호.`
}

function emaTooltip(v: string) {
  if (v === 'BULL') return `EMA 배열: BULL (정배열)\nEMA20 > EMA50 > EMA200\n상승 추세 구조. 매수 유리한 배열.`
  if (v === 'BEAR') return `EMA 배열: BEAR (역배열)\nEMA20 < EMA50 < EMA200\n하락 추세. 매수 위험. 데드크로스 상태.`
  return `EMA 배열: NEUTRAL (횡보)\n추세 방향성 불명확. 돌파 방향 확인 필요.`
}

function squeezeTooltip(v: number) {
  const desc: Record<number, string> = {
    0: `Lv0 — 수축 없음\nBB 폭이 넓음. 변동성이 이미 확장 중이거나\n평범한 상태. 스퀴즈 조건 미충족.`,
    1: `Lv1 — 약한 수축\nBB가 약하게 수축 중. 에너지 축적 시작.\n이탈 시 소폭 상승 기대.`,
    2: `Lv2 — 중간 수축\nBB가 의미있게 수축. 폭발 준비 단계.\n이탈 방향에 강한 모멘텀 예상.`,
    3: `Lv3 — 강한 수축\nBB가 극도로 수축. 폭발 직전.\n이탈 시 강한 방향성 발생 가능성 높음.`,
  }
  return desc[v] ?? `스퀴즈 Lv${v}`
}

function conditionsTooltip(v: number) {
  if (v <= 1) return `${v}/4 조건 충족 — 신호 약함\nBUY 조건 불충분. 단독 진입 부적합.`
  if (v === 2) return `${v}/4 조건 충족 — 참고 수준\n기본 조건은 갖춤. 다른 신호와 병행 확인 권장.`
  if (v === 3) return `${v}/4 조건 충족 — 매수 고려\n권장 기준(3개+) 충족. 진입 적합.`
  return `${v}/4 조건 충족 — 강한 매수 신호\n전 조건 충족. 최상의 진입 환경.`
}

// ── 지표 테이블 ──────────────────────────────────────────────────

function IndicatorTable({ c }: { c: PatternCase }) {
  const rows = [
    {
      label: 'RSI', hint: '30~55 매수권',
      value: c.rsi?.toFixed(1),
      good: c.rsi != null && c.rsi >= 30 && c.rsi <= 55,
      tooltip: c.rsi != null ? rsiTooltip(c.rsi) : null,
    },
    {
      label: 'BB %B', hint: '< 35% 하단밴드',
      value: c.bb_pct_b != null ? `${c.bb_pct_b.toFixed(1)}%` : null,
      good: c.bb_pct_b != null && c.bb_pct_b < 35,
      tooltip: c.bb_pct_b != null ? bbPctBTooltip(c.bb_pct_b) : null,
    },
    {
      label: 'BBW', hint: '변동성 폭',
      value: c.bb_width != null ? `${c.bb_width.toFixed(1)}%` : null,
      good: null,
      tooltip: c.bb_width != null ? bbwTooltip(c.bb_width) : null,
    },
    {
      label: 'MACD hist', hint: '음수 + 회복 중',
      value: c.macd_hist?.toFixed(0),
      good: c.macd_hist != null && c.macd_hist < 0,
      tooltip: c.macd_hist != null ? macdTooltip(c.macd_hist) : null,
    },
    {
      label: '거래량 배율', hint: '≥ 1.5x 유효',
      value: c.volume_ratio != null ? `${c.volume_ratio.toFixed(2)}x` : null,
      good: c.volume_ratio != null && c.volume_ratio >= 1.5,
      tooltip: c.volume_ratio != null ? volumeTooltip(c.volume_ratio) : null,
    },
    {
      label: 'EMA 배열', hint: 'BULL = 정배열',
      value: c.ema_alignment,
      good: c.ema_alignment === 'BULL',
      tooltip: c.ema_alignment ? emaTooltip(c.ema_alignment) : null,
    },
    {
      label: '스퀴즈 레벨', hint: 'Lv0~3',
      value: c.squeeze_level != null ? `Lv${c.squeeze_level}` : null,
      good: null,
      tooltip: c.squeeze_level != null ? squeezeTooltip(c.squeeze_level) : null,
    },
    {
      label: '충족 조건수', hint: '3개+ 권장',
      value: c.conditions_met != null ? `${c.conditions_met}/4` : null,
      good: c.conditions_met != null && c.conditions_met >= 3,
      tooltip: c.conditions_met != null ? conditionsTooltip(c.conditions_met) : null,
    },
  ].filter(r => r.value != null)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[var(--navy)] text-caption text-[var(--muted)]">
            <th className="text-left px-3 py-1.5 border-b border-[var(--border)]">지표</th>
            <th className="text-right px-3 py-1.5 border-b border-[var(--border)]">시그널 시점 값</th>
            <th className="text-left px-3 py-1.5 border-b border-[var(--border)]">기준</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className="border-b border-[var(--border)]/40 hover:bg-white/3">
              <td className="px-3 py-1.5 text-caption text-[var(--muted)]">{r.label}</td>
              <td className={`px-3 py-1.5 text-right text-label font-mono font-semibold ${
                r.good === true ? 'text-green-400' : r.good === false ? 'text-orange-400' : 'text-white'
              }`}>
                {r.tooltip ? (
                  <Tooltip text={r.tooltip}>
                    <span className="underline decoration-dotted decoration-white/30 cursor-help">{r.value}</span>
                  </Tooltip>
                ) : r.value}
              </td>
              <td className="px-3 py-1.5 text-caption text-[var(--muted)]/60">{r.hint}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── 아코디언 아이템 ───────────────────────────────────────────────

function CaseAccordion({ c, onEdit, onDelete }: {
  c: PatternCase
  onEdit: (c: PatternCase) => void
  onDelete: (id: number) => void
}) {
  const [open, setOpen] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [notesDraft, setNotesDraft] = useState(c.notes ?? '')
  const [notesStatus, setNotesStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nav = useNavigate()

  const resultColor = c.result_pct == null ? 'text-[var(--muted)]'
    : c.result_pct > 0 ? 'text-green-400' : 'text-red-400'

  const marketLabel = c.market === 'KR' ? '🇰🇷' : '🇺🇸'
  const ptColor = PATTERN_COLOR[c.pattern_type] || PATTERN_COLOR.custom

  const handleNotesChange = (value: string) => {
    setNotesDraft(value)
    setNotesStatus('idle')
    if (notesTimer.current) clearTimeout(notesTimer.current)
    notesTimer.current = setTimeout(async () => {
      setNotesStatus('saving')
      try {
        await updatePatternCase(c.id, { notes: value })
        setNotesStatus('saved')
        setTimeout(() => setNotesStatus('idle'), 3000)
      } catch {
        setNotesStatus('idle')
      }
    }, 1500)
  }

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden mb-2">
      {/* 헤더 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors select-none"
        onClick={() => { if (!confirmDelete) setOpen(o => !o) }}
      >
        {/* 패턴 뱃지 */}
        <span className={`text-xs px-2 py-0.5 rounded border font-semibold shrink-0 ${ptColor}`}>
          {PATTERN_LABEL[c.pattern_type] ?? c.pattern_type}
        </span>
        {/* 출처 뱃지 */}
        <span className="text-caption px-1.5 py-0.5 bg-[var(--border)]/60 rounded text-[var(--muted)] shrink-0">
          {c.source === 'chart' ? '📊 차트' : '✏️ 수동'}
        </span>

        {/* 제목 & 종목 */}
        <div className="flex-1 min-w-0">
          <div className="text-body font-semibold text-white truncate">{c.title}</div>
          <div className="text-xs text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
            <span>{marketLabel} {c.stock_name}</span>
            <span className="text-[var(--border)]">·</span>
            <span className="font-mono text-[var(--gold)]">{c.symbol}</span>
            <span className="text-[var(--border)]">·</span>
            <span>{c.signal_date}</span>
          </div>
        </div>

        {/* 수익률 */}
        <div className="text-right shrink-0">
          {c.result_pct != null ? (
            <div className={`flex items-center gap-1 text-base font-bold ${resultColor}`}>
              {c.result_pct > 0 ? <TrendingUp size={15} /> : c.result_pct < 0 ? <TrendingDown size={15} /> : <Minus size={15} />}
              {c.result_pct > 0 ? '+' : ''}{c.result_pct.toFixed(1)}%
            </div>
          ) : (
            <span className="text-xs text-[var(--muted)]">진행중</span>
          )}
          {c.hold_days != null && (
            <div className="text-xs text-[var(--muted)]">{c.hold_days}일 보유</div>
          )}
        </div>

        {/* 태그들 (PC) */}
        <div className="hidden md:flex gap-1 shrink-0">
          {c.tags.slice(0, 3).map(t => (
            <span key={t} className="text-micro px-1.5 py-0.5 bg-[var(--border)] rounded text-[var(--muted)]">{t}</span>
          ))}
        </div>

        {/* 삭제 버튼 (항상 노출) */}
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-caption text-red-400">삭제?</span>
              <button
                onClick={() => onDelete(c.id)}
                className="text-caption text-red-400 hover:text-red-300 px-1.5 py-0.5 border border-red-500/40 rounded"
              >확인</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-caption text-[var(--muted)] hover:text-white px-1.5 py-0.5 border border-[var(--border)] rounded"
              >취소</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 text-[var(--muted)] hover:text-red-400 transition-colors rounded hover:bg-red-500/10"
              title="삭제"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* 열기/닫기 */}
        <div className="text-[var(--muted)] shrink-0">
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* 바디 (아코디언 펼침) */}
      {open && (
        <div className="border-t border-[var(--border)] bg-[var(--bg)]/60">
          {/* 진입가 / 매도수익금 */}
          {(c.entry_price != null || c.profit_krw != null) && (
            <div className="flex gap-4 px-4 py-3 border-b border-[var(--border)]/50">
              {c.entry_price != null && (
                <div>
                  <div className="text-caption text-[var(--muted)]">진입가</div>
                  <div className="text-sm font-mono font-bold text-white">
                    {c.market === 'US' ? `$${c.entry_price.toLocaleString()}` : `${c.entry_price.toLocaleString()}원`}
                  </div>
                </div>
              )}
              {c.profit_krw != null && (
                <div>
                  <div className="text-caption text-[var(--muted)]">매도수익금</div>
                  <div className={`text-sm font-mono font-bold ${c.profit_krw > 0 ? 'text-green-400' : c.profit_krw < 0 ? 'text-red-400' : 'text-white'}`}>
                    {c.profit_krw > 0 ? '+' : ''}{c.profit_krw.toLocaleString()}원
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 지표 테이블 */}
          <IndicatorTable c={c} />

          {/* 메모 인라인 편집 (T014) */}
          <div className="px-4 py-3 border-t border-[var(--border)]/50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-caption text-[var(--muted)]">분석 메모</div>
              {notesStatus === 'saving' && <span className="text-caption text-[var(--muted)]">저장 중...</span>}
              {notesStatus === 'saved' && <span className="text-caption text-green-400">저장됨</span>}
            </div>
            <textarea
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-2 text-label text-white/90 focus:outline-none focus:border-[var(--gold)] resize-none leading-relaxed"
              rows={3}
              value={notesDraft}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="매수 이유, 패턴 특징, 향후 활용 방안..."
            />
          </div>

          {/* 태그 + 액션 */}
          <div className="px-4 py-3 border-t border-[var(--border)]/50 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {c.tags.map(t => (
                <span key={t} className="text-caption px-1.5 py-0.5 bg-[var(--border)]/60 rounded text-[var(--muted)]">#{t}</span>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              {/* 차트 보기 버튼 */}
              <button
                onClick={e => { e.stopPropagation(); nav(`/${c.symbol}?market=${c.market_type || c.market}&highlightDate=${c.signal_date}`) }}
                className="flex items-center gap-1 text-caption text-[var(--muted)] hover:text-blue-400 transition-colors px-2 py-1"
              >
                <BarChart2 size={12} /> 차트
              </button>
              <button
                onClick={() => onEdit(c)}
                className="flex items-center gap-1 text-caption text-[var(--muted)] hover:text-[var(--gold)] transition-colors px-2 py-1"
              >
                <Edit3 size={12} /> 수정
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── 매도 정보 입력 모달 ───────────────────────────────────────────

function SellInfoModal({
  initial, onSave, onClose,
}: {
  initial: PatternCase
  onSave: (data: any) => Promise<void>
  onClose: () => void
}) {
  const [profitKrw, setProfitKrw] = useState(initial.profit_krw?.toString() ?? '')
  const [resultPct, setResultPct] = useState(initial.result_pct?.toString() ?? '')
  const [holdDays, setHoldDays] = useState(initial.hold_days?.toString() ?? '')
  const [saving, setSaving] = useState(false)

  const num = (v: string) => v === '' ? null : parseFloat(v)
  const int = (v: string) => v === '' ? null : parseInt(v)

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await onSave({
        profit_krw: num(profitKrw),
        result_pct: num(resultPct),
        hold_days: int(holdDays),
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inp = "w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-label text-white focus:outline-none focus:border-[var(--gold)]"
  const lbl = "text-caption text-[var(--muted)] mb-0.5 block"
  const ro = "text-sm text-white font-mono"
  const roLbl = "text-caption text-[var(--muted)]"

  const priceFmt = (v: number | null) =>
    v == null ? '-' : initial.market === 'US' ? `$${v.toLocaleString()}` : `${v.toLocaleString()}원`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--gold)]">매도 정보 입력</h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white"><X size={16} /></button>
        </div>

        {/* 바디 */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* 스크랩 정보 (읽기 전용) */}
          <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]/50 space-y-3">
            <div className="text-caption text-[var(--gold)] font-semibold">스크랩 정보</div>

            <div>
              <div className={roLbl}>제목</div>
              <div className={ro}>{initial.title}</div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className={roLbl}>종목</div>
                <div className={ro}>{initial.stock_name} ({initial.symbol})</div>
              </div>
              <div>
                <div className={roLbl}>시장</div>
                <div className={ro}>{initial.market}{initial.market_type ? ` · ${initial.market_type}` : ''}</div>
              </div>
              <div>
                <div className={roLbl}>패턴</div>
                <div className={ro}>{PATTERN_LABEL[initial.pattern_type] ?? initial.pattern_type}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className={roLbl}>시그널 날짜</div>
                <div className={ro}>{initial.signal_date}</div>
              </div>
              <div>
                <div className={roLbl}>진입가</div>
                <div className={ro}>{priceFmt(initial.entry_price)}</div>
              </div>
              <div>
                <div className={roLbl}>충족 조건</div>
                <div className={ro}>{initial.conditions_met != null ? `${initial.conditions_met}/4` : '-'}</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className={roLbl}>RSI</div>
                <div className={ro}>{initial.rsi?.toFixed(1) ?? '-'}</div>
              </div>
              <div>
                <div className={roLbl}>BB %B</div>
                <div className={ro}>{initial.bb_pct_b != null ? `${initial.bb_pct_b.toFixed(1)}%` : '-'}</div>
              </div>
              <div>
                <div className={roLbl}>BBW</div>
                <div className={ro}>{initial.bb_width != null ? `${initial.bb_width.toFixed(1)}%` : '-'}</div>
              </div>
              <div>
                <div className={roLbl}>MACD hist</div>
                <div className={ro}>{initial.macd_hist?.toFixed(0) ?? '-'}</div>
              </div>
              <div>
                <div className={roLbl}>거래량 배율</div>
                <div className={ro}>{initial.volume_ratio != null ? `${initial.volume_ratio.toFixed(2)}x` : '-'}</div>
              </div>
              <div>
                <div className={roLbl}>EMA 배열</div>
                <div className={ro}>{initial.ema_alignment ?? '-'}</div>
              </div>
              <div>
                <div className={roLbl}>스퀴즈</div>
                <div className={ro}>{initial.squeeze_level != null ? `Lv${initial.squeeze_level}` : '-'}</div>
              </div>
            </div>

            {initial.tags.length > 0 && (
              <div>
                <div className={roLbl}>태그</div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {initial.tags.map(t => (
                    <span key={t} className="text-caption px-1.5 py-0.5 bg-[var(--border)]/60 rounded text-[var(--muted)]">#{t}</span>
                  ))}
                </div>
              </div>
            )}

            {initial.notes && (
              <div>
                <div className={roLbl}>분석 메모</div>
                <div className="text-label text-white/85 whitespace-pre-wrap leading-relaxed">{initial.notes}</div>
              </div>
            )}
          </div>

          {/* 매도 입력 3필드 */}
          <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--gold)]/30">
            <div className="text-caption text-[var(--gold)] font-semibold mb-2">매도 정보</div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={lbl}>매도수익금 (원)</label>
                <input
                  type="number" className={inp} value={profitKrw}
                  onChange={e => setProfitKrw(e.target.value)}
                  placeholder="150000" step="any"
                />
              </div>
              <div>
                <label className={lbl}>매도수익률 (%)</label>
                <input
                  type="number" className={inp} value={resultPct}
                  onChange={e => setResultPct(e.target.value)}
                  placeholder="34.5" step="0.1"
                />
              </div>
              <div>
                <label className={lbl}>보유기간 (일)</label>
                <input
                  type="number" className={inp} value={holdDays}
                  onChange={e => setHoldDays(e.target.value)}
                  placeholder="5"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-[var(--muted)] hover:text-white transition-colors">취소</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-1.5 text-sm bg-[var(--gold)] text-black font-semibold rounded hover:opacity-90 disabled:opacity-40 transition-opacity"
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────


export default function Scrap() {
  const { user } = useAuthStore()
  const nav = useNavigate()
  const [cases, setCases] = useState<PatternCase[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('all')
  const [soldOnly, setSoldOnly] = useState(false)

  // 타입 탭 선택 시 매도 필터 해제 (상호 배타)
  const selectType = (key: string) => {
    setActiveType(key)
    setSoldOnly(false)
  }
  // 매도 사례 카드 클릭 — 타입 탭도 전체로 리셋
  const selectSoldOnly = () => {
    setSoldOnly(true)
    setActiveType('all')
  }
  // 총 사례 카드 클릭 — 전부 해제
  const selectAll = () => {
    setSoldOnly(false)
    setActiveType('all')
  }
  const [editTarget, setEditTarget] = useState<PatternCase | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const listAtTop = useRef(true)
  const listAtBottom = useRef(true)
  const listRef = useRef<HTMLDivElement>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchPatternCases()
      setCases(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (user) load()
    else setLoading(false)
  }, [user])

  const filtered = useMemo(() => {
    let list = cases
    if (soldOnly) list = list.filter(c => c.profit_krw != null)
    if (activeType !== 'all') list = list.filter(c => c.pattern_type === activeType)
    return list
  }, [cases, activeType, soldOnly])

  const handleSwipe = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    // 수평 스와이프: 탭 전환
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) < 60) return
      const idx = PATTERN_TYPES.findIndex(t => t.key === activeType)
      if (dx < 0 && idx < PATTERN_TYPES.length - 1) selectType(PATTERN_TYPES[idx + 1].key)
      else if (dx > 0 && idx > 0) selectType(PATTERN_TYPES[idx - 1].key)
    } else {
      // 수직 스와이프: 페이지 이동 (touchstart 시점 경계 기준)
      if (Math.abs(dy) < 90) return
      if (dy > 0 && listAtTop.current) nav('/buy-list')
      else if (dy < 0 && listAtBottom.current) nav('/settings')
    }
  }

  // 통계
  const stats = useMemo(() => {
    const wins = cases.filter(c => c.result_pct != null && c.result_pct > 0)
    const avgReturn = wins.length > 0
      ? wins.reduce((sum, c) => sum + (c.result_pct ?? 0), 0) / wins.length
      : 0
    const winRate = cases.filter(c => c.result_pct != null).length > 0
      ? Math.round(wins.length / cases.filter(c => c.result_pct != null).length * 100)
      : null
    // 매도 완료 사례 = profit_krw 입력된 사례
    const soldCases = cases.filter(c => c.profit_krw != null)
    const sumProfit = soldCases.reduce((sum, c) => sum + (c.profit_krw ?? 0), 0)
    const holdDaysCases = soldCases.filter(c => c.hold_days != null)
    const avgHoldDays = holdDaysCases.length > 0
      ? holdDaysCases.reduce((sum, c) => sum + (c.hold_days ?? 0), 0) / holdDaysCases.length
      : null
    return {
      total: cases.length, wins: wins.length, avgReturn, winRate,
      sumProfit, avgHoldDays, sold: soldCases.length,
    }
  }, [cases])

  const fmtProfit = (v: number) => {
    const sign = v > 0 ? '+' : ''
    return `${sign}${Math.round(v).toLocaleString()}원`
  }
  const profitColor = stats.sumProfit > 0 ? 'text-green-400'
    : stats.sumProfit < 0 ? 'text-red-400' : 'text-white'

  const handleSave = async (data: any) => {
    if (!editTarget) return
    const updated = await updatePatternCase(editTarget.id, data)
    setCases(prev => prev.map(c => c.id === editTarget.id ? updated : c))
    setEditTarget(null)
  }

  const handleEdit = (c: PatternCase) => {
    setEditTarget(c)
  }

  const handleDelete = async (id: number) => {
    await deletePatternCase(id)
    setCases(prev => prev.filter(c => c.id !== id))
  }

  const totalActive = !soldOnly && activeType === 'all'
  const soldActive = soldOnly

  const statCards: Array<{
    label: string; value: string; color: string; nowrap?: boolean;
    onClick?: () => void; active?: boolean;
  }> = [
    { label: '총 사례', value: stats.total.toString(), color: 'text-white', onClick: selectAll, active: totalActive },
    { label: '승률', value: stats.winRate != null ? `${stats.winRate}%` : '-', color: 'text-cyan-400' },
    { label: '평균 수익률', value: stats.avgReturn > 0 ? `+${stats.avgReturn.toFixed(1)}%` : '-', color: 'text-[var(--gold)]' },
    { label: '매도 수익합', value: stats.sold > 0 ? fmtProfit(stats.sumProfit) : '-', color: profitColor, nowrap: true },
    { label: '매도 사례', value: stats.sold.toString(), color: 'text-green-400', onClick: selectSoldOnly, active: soldActive },
    { label: '평균 보유일', value: stats.avgHoldDays != null ? `${stats.avgHoldDays.toFixed(1)}일` : '-', color: 'text-white' },
  ]

  const renderStatCard = (s: typeof statCards[number]) => {
    const clickable = !!s.onClick
    const activeCls = s.active ? 'border-[var(--gold)] bg-[var(--gold)]/10' : 'border-[var(--border)]'
    const hoverCls = clickable ? 'cursor-pointer hover:border-[var(--gold)]/60 transition-colors' : ''
    return (
      <div
        key={s.label}
        onClick={s.onClick}
        className={`bg-[var(--card)] border rounded-lg p-2.5 text-center ${activeCls} ${hoverCls}`}
      >
        <div className={`text-base font-bold font-mono ${s.color} ${s.nowrap ? 'whitespace-nowrap' : ''}`}>
          {s.value}
        </div>
        <div className="text-xs text-[var(--muted)] mt-0.5">{s.label}</div>
      </div>
    )
  }

  const statsBanner = (
    <div className="grid grid-cols-3 gap-2">
      {statCards.map(renderStatCard)}
    </div>
  )

  const typeTabs = (
    <div className="flex gap-1 border-b border-[var(--border)] pb-0 overflow-x-auto">
      {PATTERN_TYPES.map(pt => {
        const cnt = pt.key === 'all' ? cases.length : cases.filter(c => c.pattern_type === pt.key).length
        return (
          <button
            key={pt.key}
            onClick={() => selectType(pt.key)}
            className={`px-3 py-2 text-sm font-semibold border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeType === pt.key
                ? `border-[var(--gold)] ${pt.color}`
                : 'border-transparent text-[var(--muted)] hover:text-white'
            }`}
          >
            {pt.label}
            <span className="ml-1 text-xs opacity-60">({cnt})</span>
          </button>
        )
      })}
    </div>
  )

  const caseList = (
    <>
      {!user ? (
        <div className="text-center py-16">
          <BookMarked size={36} className="text-[var(--border)] mx-auto mb-3" />
          <p className="text-sm text-[var(--muted)] mb-1">로그인 후 나만의 BUY 사례를 관리할 수 있습니다</p>
          <p className="text-xs text-[var(--muted)]/60">우측 상단 메뉴에서 Google 로그인</p>
        </div>
      ) : loading ? (
        <div className="flex justify-center py-16">
          <div className="text-sm text-[var(--muted)]">불러오는 중...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <BookMarked size={36} className="text-[var(--border)] mx-auto mb-3" />
          <p className="text-sm text-[var(--muted)]">
            {activeType === 'all' ? '아직 스크랩된 사례가 없습니다.' : '이 유형의 사례가 없습니다.'}
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]/70">차트 화면에서 BUY 시그널을 스크랩하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div>
          {filtered.map(c => (
            <CaseAccordion key={c.id} c={c} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      {/* ── Mobile layout ── */}
      <div className="md:hidden fixed inset-x-0 top-0 flex flex-col bg-[var(--bg)]"
        style={{ bottom: '64px' }}>
        {/* 고정 헤더 */}
        <div className="shrink-0 flex items-center gap-2 px-3 pt-3 pb-2 border-b border-[var(--border)]/50">
          <BookMarked size={16} className="text-[var(--gold)]" />
          <h2 className="text-display font-bold text-[var(--text)]">BUY 사례 스크랩</h2>
        </div>
        {/* 고정 통계 */}
        <div className="shrink-0 px-3 pt-2">
          {statsBanner}
        </div>
        {/* 고정 탭 (좌우 스와이프 힌트) */}
        <div className="shrink-0 px-3 pt-2 pb-0">
          {typeTabs}
        </div>
        {/* 스크롤 가능 사례 목록 (좌우 스와이프로 탭 전환) */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-3 pb-3 pt-2"
          style={{ overscrollBehaviorY: 'contain' } as any}
          onTouchStart={e => {
            touchStartX.current = e.touches[0].clientX
            touchStartY.current = e.touches[0].clientY
            const el = listRef.current
            if (el) {
              listAtTop.current = el.scrollTop <= 2
              listAtBottom.current = el.scrollTop >= el.scrollHeight - el.clientHeight - 2
            }
          }}
          onTouchEnd={handleSwipe}
        >
          {caseList}
        </div>
      </div>

      {/* ── PC layout ── */}
      <div className="hidden md:block p-3 md:p-6 max-w-4xl mx-auto">
        {/* 제목 */}
        <div className="flex items-center gap-2 mb-4">
          <BookMarked size={20} className="text-[var(--gold)]" />
          <h1 className="text-lg font-bold text-white">BUY 사례 스크랩</h1>
          <span className="text-xs text-[var(--muted)]">승률 높은 조건 기록</span>
        </div>
        <div className="grid grid-cols-6 gap-2 mb-4">
          {statCards.map(renderStatCard)}
        </div>
        <div className="flex gap-1 mb-4 border-b border-[var(--border)] pb-0">
          {PATTERN_TYPES.map(pt => {
            const cnt = pt.key === 'all' ? cases.length : cases.filter(c => c.pattern_type === pt.key).length
            return (
              <button key={pt.key} onClick={() => selectType(pt.key)}
                className={`px-3 py-2 text-label font-semibold border-b-2 transition-colors -mb-px ${
                  activeType === pt.key ? `border-[var(--gold)] ${pt.color}` : 'border-transparent text-[var(--muted)] hover:text-white'
                }`}>
                {pt.label}<span className="ml-1 text-caption opacity-60">({cnt})</span>
              </button>
            )
          })}
        </div>
        {caseList}
      </div>

      {/* 매도 정보 입력 모달 */}
      {editTarget && (
        <SellInfoModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => setEditTarget(null)}
        />
      )}
    </>
  )
}
