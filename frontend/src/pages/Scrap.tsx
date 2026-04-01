import { BookMarked, ChevronDown, ChevronUp, Edit3, Plus, Trash2, X, TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { fetchPatternCases, createPatternCase, updatePatternCase, deletePatternCase } from '../api/client'
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
  exit_price: number | null
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

// ── 빈 폼 ────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: '', symbol: '', stock_name: '', market: 'KR', market_type: '',
  pattern_type: 'custom', signal_date: new Date().toISOString().slice(0, 10),
  entry_price: '', exit_price: '', result_pct: '', hold_days: '',
  rsi: '', bb_pct_b: '', bb_width: '', macd_hist: '', volume_ratio: '',
  ema_alignment: 'BULL', squeeze_level: '0', conditions_met: '',
  tags: '', notes: '',
}

// ── 툴팁 ─────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip inline-block">
      {children}
      <div className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-56 bg-[#1a2035] border border-[var(--border)] rounded-lg px-3 py-2 text-[11px] text-white/85 leading-relaxed hidden group-hover/tip:block z-50 shadow-xl whitespace-pre-line">
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
          <tr className="bg-[var(--navy)] text-[10px] text-[var(--muted)]">
            <th className="text-left px-3 py-1.5 border-b border-[var(--border)]">지표</th>
            <th className="text-right px-3 py-1.5 border-b border-[var(--border)]">시그널 시점 값</th>
            <th className="text-left px-3 py-1.5 border-b border-[var(--border)]">기준</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} className="border-b border-[var(--border)]/40 hover:bg-white/3">
              <td className="px-3 py-1.5 text-[11px] text-[var(--muted)]">{r.label}</td>
              <td className={`px-3 py-1.5 text-right text-[12px] font-mono font-semibold ${
                r.good === true ? 'text-green-400' : r.good === false ? 'text-orange-400' : 'text-white'
              }`}>
                {r.tooltip ? (
                  <Tooltip text={r.tooltip}>
                    <span className="underline decoration-dotted decoration-white/30 cursor-help">{r.value}</span>
                  </Tooltip>
                ) : r.value}
              </td>
              <td className="px-3 py-1.5 text-[10px] text-[var(--muted)]/60">{r.hint}</td>
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
        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold shrink-0 ${ptColor}`}>
          {PATTERN_LABEL[c.pattern_type] ?? c.pattern_type}
        </span>
        {/* 출처 뱃지 */}
        <span className="text-[9px] px-1.5 py-0.5 bg-[var(--border)]/60 rounded text-[var(--muted)] shrink-0">
          {c.source === 'chart' ? '📊 차트' : '✏️ 수동'}
        </span>

        {/* 제목 & 종목 */}
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-white truncate">{c.title}</div>
          <div className="text-[10px] text-[var(--muted)] flex items-center gap-1.5 mt-0.5">
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
            <div className={`flex items-center gap-1 text-sm font-bold ${resultColor}`}>
              {c.result_pct > 0 ? <TrendingUp size={14} /> : c.result_pct < 0 ? <TrendingDown size={14} /> : <Minus size={14} />}
              {c.result_pct > 0 ? '+' : ''}{c.result_pct.toFixed(1)}%
            </div>
          ) : (
            <span className="text-[11px] text-[var(--muted)]">진행중</span>
          )}
          {c.hold_days != null && (
            <div className="text-[10px] text-[var(--muted)]">{c.hold_days}일 보유</div>
          )}
        </div>

        {/* 태그들 (PC) */}
        <div className="hidden md:flex gap-1 shrink-0">
          {c.tags.slice(0, 3).map(t => (
            <span key={t} className="text-[9px] px-1.5 py-0.5 bg-[var(--border)] rounded text-[var(--muted)]">{t}</span>
          ))}
        </div>

        {/* 삭제 버튼 (항상 노출) */}
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <span className="text-[11px] text-red-400">삭제?</span>
              <button
                onClick={() => onDelete(c.id)}
                className="text-[11px] text-red-400 hover:text-red-300 px-1.5 py-0.5 border border-red-500/40 rounded"
              >확인</button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[11px] text-[var(--muted)] hover:text-white px-1.5 py-0.5 border border-[var(--border)] rounded"
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
          {/* 진입가 정보 */}
          {(c.entry_price != null || c.exit_price != null) && (
            <div className="flex gap-4 px-4 py-3 border-b border-[var(--border)]/50">
              {c.entry_price != null && (
                <div>
                  <div className="text-[10px] text-[var(--muted)]">진입가</div>
                  <div className="text-sm font-mono font-bold text-white">
                    {c.market === 'US' ? `$${c.entry_price.toLocaleString()}` : `${c.entry_price.toLocaleString()}원`}
                  </div>
                </div>
              )}
              {c.exit_price != null && (
                <div>
                  <div className="text-[10px] text-[var(--muted)]">청산가</div>
                  <div className="text-sm font-mono font-bold text-white">
                    {c.market === 'US' ? `$${c.exit_price.toLocaleString()}` : `${c.exit_price.toLocaleString()}원`}
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
              <div className="text-[10px] text-[var(--muted)]">분석 메모</div>
              {notesStatus === 'saving' && <span className="text-[10px] text-[var(--muted)]">저장 중...</span>}
              {notesStatus === 'saved' && <span className="text-[10px] text-green-400">저장됨</span>}
            </div>
            <textarea
              className="w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-2 text-[12px] text-white/90 focus:outline-none focus:border-[var(--gold)] resize-none leading-relaxed"
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
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-[var(--border)]/60 rounded text-[var(--muted)]">#{t}</span>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              {/* 차트 보기 버튼 */}
              <button
                onClick={e => { e.stopPropagation(); nav(`/${c.symbol}?market=${c.market_type || c.market}&highlightDate=${c.signal_date}`) }}
                className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-blue-400 transition-colors px-2 py-1"
              >
                <BarChart2 size={12} /> 차트
              </button>
              <button
                onClick={() => onEdit(c)}
                className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors px-2 py-1"
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

// ── 추가/수정 폼 모달 ─────────────────────────────────────────────

function CaseFormModal({
  initial, onSave, onClose,
}: {
  initial: PatternCase | null
  onSave: (data: any) => Promise<void>
  onClose: () => void
}) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY_FORM
    return {
      title: initial.title,
      symbol: initial.symbol,
      stock_name: initial.stock_name,
      market: initial.market,
      market_type: initial.market_type ?? '',
      pattern_type: initial.pattern_type,
      signal_date: initial.signal_date,
      entry_price: initial.entry_price?.toString() ?? '',
      exit_price: initial.exit_price?.toString() ?? '',
      result_pct: initial.result_pct?.toString() ?? '',
      hold_days: initial.hold_days?.toString() ?? '',
      rsi: initial.rsi?.toString() ?? '',
      bb_pct_b: initial.bb_pct_b?.toString() ?? '',
      bb_width: initial.bb_width?.toString() ?? '',
      macd_hist: initial.macd_hist?.toString() ?? '',
      volume_ratio: initial.volume_ratio?.toString() ?? '',
      ema_alignment: initial.ema_alignment ?? 'BULL',
      squeeze_level: initial.squeeze_level?.toString() ?? '0',
      conditions_met: initial.conditions_met?.toString() ?? '',
      tags: initial.tags.join(', '),
      notes: initial.notes ?? '',
    }
  })
  const [saving, setSaving] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const num = (v: string) => v === '' ? null : parseFloat(v)
  const int = (v: string) => v === '' ? null : parseInt(v)

  const handleSubmit = async () => {
    if (!form.title || !form.symbol || !form.stock_name) return
    setSaving(true)
    try {
      await onSave({
        title: form.title,
        symbol: form.symbol,
        stock_name: form.stock_name,
        market: form.market,
        market_type: form.market_type || null,
        pattern_type: form.pattern_type,
        signal_date: form.signal_date,
        entry_price: num(form.entry_price),
        exit_price: num(form.exit_price),
        result_pct: num(form.result_pct),
        hold_days: int(form.hold_days),
        rsi: num(form.rsi),
        bb_pct_b: num(form.bb_pct_b),
        bb_width: num(form.bb_width),
        macd_hist: num(form.macd_hist),
        volume_ratio: num(form.volume_ratio),
        ema_alignment: form.ema_alignment || null,
        squeeze_level: int(form.squeeze_level),
        conditions_met: int(form.conditions_met),
        tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
        notes: form.notes || null,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const inp = "w-full bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-[12px] text-white focus:outline-none focus:border-[var(--gold)]"
  const lbl = "text-[10px] text-[var(--muted)] mb-0.5 block"

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[var(--card)] border border-[var(--border)] rounded-xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--gold)]">
            {initial ? '사례 수정' : '새 BUY 사례 스크랩'}
          </h2>
          <button onClick={onClose} className="text-[var(--muted)] hover:text-white"><X size={16} /></button>
        </div>

        {/* 바디 */}
        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          {/* 기본 정보 */}
          <div>
            <label className={lbl}>제목 *</label>
            <input className={inp} value={form.title} onChange={e => set('title', e.target.value)} placeholder="예: 펄어비스 급락 반등 BUY" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>종목코드 *</label>
              <input className={inp} value={form.symbol} onChange={e => set('symbol', e.target.value)} placeholder="263750 / AAPL" />
            </div>
            <div>
              <label className={lbl}>종목명 *</label>
              <input className={inp} value={form.stock_name} onChange={e => set('stock_name', e.target.value)} placeholder="펄어비스" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>시장</label>
              <select className={inp} value={form.market} onChange={e => set('market', e.target.value)}>
                <option value="KR">KR 국내</option>
                <option value="US">US 미국</option>
              </select>
            </div>
            <div>
              <label className={lbl}>구분</label>
              <input className={inp} value={form.market_type} onChange={e => set('market_type', e.target.value)} placeholder="KOSDAQ / NASDAQ100" />
            </div>
            <div>
              <label className={lbl}>패턴 유형</label>
              <select className={inp} value={form.pattern_type} onChange={e => set('pattern_type', e.target.value)}>
                <option value="squeeze_breakout">스퀴즈 이탈</option>
                <option value="oversold_bounce">과매도 반등</option>
                <option value="custom">직접 입력</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={lbl}>시그널 날짜</label>
              <input type="date" className={inp} value={form.signal_date} onChange={e => set('signal_date', e.target.value)} />
            </div>
            <div>
              <label className={lbl}>충족 조건수 (1~4)</label>
              <input type="number" className={inp} value={form.conditions_met} onChange={e => set('conditions_met', e.target.value)} min={1} max={4} placeholder="3" />
            </div>
          </div>

          {/* 진입/청산 */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={lbl}>진입가</label>
              <input type="number" className={inp} value={form.entry_price} onChange={e => set('entry_price', e.target.value)} placeholder="50200" />
            </div>
            <div>
              <label className={lbl}>청산가</label>
              <input type="number" className={inp} value={form.exit_price} onChange={e => set('exit_price', e.target.value)} placeholder="67600" />
            </div>
            <div>
              <label className={lbl}>수익률 (%)</label>
              <input type="number" className={inp} value={form.result_pct} onChange={e => set('result_pct', e.target.value)} placeholder="34.5" step="0.1" />
            </div>
          </div>

          {/* 지표값 */}
          <div className="p-3 bg-[var(--bg)] rounded-lg border border-[var(--border)]/50">
            <div className="text-[10px] text-[var(--gold)] font-semibold mb-2">시그널 발생 시점 지표값</div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { k: 'rsi',          label: 'RSI',          ph: '46.5' },
                { k: 'bb_pct_b',     label: 'BB %B (%)',    ph: '33.7' },
                { k: 'bb_width',     label: 'BBW (%)',       ph: '63.2' },
                { k: 'macd_hist',    label: 'MACD hist',    ph: '-2414' },
                { k: 'volume_ratio', label: '거래량 배율',   ph: '3.91' },
                { k: 'hold_days',    label: '보유일수',      ph: '5' },
              ].map(f => (
                <div key={f.k}>
                  <label className={lbl}>{f.label}</label>
                  <input type="number" className={inp} value={(form as any)[f.k]} onChange={e => set(f.k, e.target.value)} placeholder={f.ph} step="any" />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className={lbl}>EMA 배열</label>
                <select className={inp} value={form.ema_alignment} onChange={e => set('ema_alignment', e.target.value)}>
                  <option value="BULL">BULL (정배열)</option>
                  <option value="NEUTRAL">NEUTRAL (횡보)</option>
                  <option value="BEAR">BEAR (역배열)</option>
                </select>
              </div>
              <div>
                <label className={lbl}>스퀴즈 레벨</label>
                <select className={inp} value={form.squeeze_level} onChange={e => set('squeeze_level', e.target.value)}>
                  <option value="0">0 (없음)</option>
                  <option value="1">1 (약)</option>
                  <option value="2">2 (중)</option>
                  <option value="3">3 (강)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 태그 & 메모 */}
          <div>
            <label className={lbl}>태그 (쉼표 구분)</label>
            <input className={inp} value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="과매도반등, 정배열, KOSDAQ" />
          </div>
          <div>
            <label className={lbl}>분석 메모</label>
            <textarea
              className={`${inp} resize-none`} rows={4}
              value={form.notes} onChange={e => set('notes', e.target.value)}
              placeholder="시그널 발생 배경, 진입 이유, 결과 분석..."
            />
          </div>
        </div>

        {/* 푸터 */}
        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-[var(--border)]">
          <button onClick={onClose} className="px-4 py-1.5 text-sm text-[var(--muted)] hover:text-white transition-colors">취소</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.title || !form.symbol || !form.stock_name}
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
  const [cases, setCases] = useState<PatternCase[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('all')
  const [showForm, setShowForm] = useState(false)
  const [editTarget, setEditTarget] = useState<PatternCase | null>(null)

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

  const filtered = useMemo(() =>
    activeType === 'all' ? cases : cases.filter(c => c.pattern_type === activeType),
    [cases, activeType]
  )

  // 통계
  const stats = useMemo(() => {
    const wins = cases.filter(c => c.result_pct != null && c.result_pct > 0)
    const avgReturn = wins.length > 0
      ? wins.reduce((sum, c) => sum + (c.result_pct ?? 0), 0) / wins.length
      : 0
    const winRate = cases.filter(c => c.result_pct != null).length > 0
      ? Math.round(wins.length / cases.filter(c => c.result_pct != null).length * 100)
      : null
    return { total: cases.length, wins: wins.length, avgReturn, winRate }
  }, [cases])

  const handleSave = async (data: any) => {
    if (editTarget) {
      const updated = await updatePatternCase(editTarget.id, data)
      setCases(prev => prev.map(c => c.id === editTarget.id ? updated : c))
    } else {
      const created = await createPatternCase(data)
      setCases(prev => [created, ...prev])
    }
    setEditTarget(null)
    setShowForm(false)
  }

  const handleEdit = (c: PatternCase) => {
    setEditTarget(c)
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    await deletePatternCase(id)
    setCases(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto">
      {/* 제목 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BookMarked size={20} className="text-[var(--gold)]" />
          <h1 className="text-lg font-bold text-white">BUY 사례 스크랩</h1>
          <span className="text-xs text-[var(--muted)]">승률 높은 조건 기록</span>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowForm(true) }}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--gold)] text-black text-xs font-bold rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus size={13} /> 새 사례 추가
        </button>
      </div>

      {/* 통계 배너 */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        {[
          { label: '총 사례', value: stats.total.toString(), color: 'text-white' },
          { label: '수익 사례', value: stats.wins.toString(), color: 'text-green-400' },
          { label: '승률', value: stats.winRate != null ? `${stats.winRate}%` : '-', color: 'text-cyan-400' },
          { label: '평균 수익률', value: stats.avgReturn > 0 ? `+${stats.avgReturn.toFixed(1)}%` : '-', color: 'text-[var(--gold)]' },
        ].map(s => (
          <div key={s.label} className="bg-[var(--card)] border border-[var(--border)] rounded-lg p-2.5 text-center">
            <div className={`text-base font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-[var(--muted)]">{s.label}</div>
          </div>
        ))}
      </div>

      {/* 패턴 타입 탭 */}
      <div className="flex gap-1 mb-4 border-b border-[var(--border)] pb-0">
        {PATTERN_TYPES.map(pt => {
          const cnt = pt.key === 'all' ? cases.length : cases.filter(c => c.pattern_type === pt.key).length
          return (
            <button
              key={pt.key}
              onClick={() => setActiveType(pt.key)}
              className={`px-3 py-2 text-[12px] font-semibold border-b-2 transition-colors -mb-px ${
                activeType === pt.key
                  ? `border-[var(--gold)] ${pt.color}`
                  : 'border-transparent text-[var(--muted)] hover:text-white'
              }`}
            >
              {pt.label}
              <span className="ml-1 text-[10px] opacity-60">({cnt})</span>
            </button>
          )
        })}
      </div>

      {/* 사례 목록 */}
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
          <button
            onClick={() => { setEditTarget(null); setShowForm(true) }}
            className="mt-3 text-xs text-[var(--gold)] hover:underline"
          >
            첫 사례 추가하기
          </button>
        </div>
      ) : (
        <div>
          {filtered.map(c => (
            <CaseAccordion key={c.id} c={c} onEdit={handleEdit} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {/* 폼 모달 */}
      {showForm && (
        <CaseFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditTarget(null) }}
        />
      )}
    </div>
  )
}
