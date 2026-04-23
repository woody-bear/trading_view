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

const PATTERN_TYPES: { key: string; label: string }[] = [
  { key: 'all',              label: '전체' },
  { key: 'squeeze_breakout', label: '스퀴즈 이탈' },
  { key: 'oversold_bounce',  label: '과매도 반등' },
  { key: 'custom',           label: '직접 입력' },
  { key: 'chart',            label: '차트 BUY' },
]

const PATTERN_LABEL: Record<string, string> = {
  squeeze_breakout: '스퀴즈 이탈',
  oversold_bounce:  '과매도 반등',
  custom:           '직접 입력',
  chart:            '차트 BUY',
}

// SQZ Terminal 칩 클래스
const PATTERN_CHIP: Record<string, string> = {
  squeeze_breakout: 'chip chip-warn',
  oversold_bounce:  'chip chip-ghost',
  custom:           'chip chip-accent',
  chart:            'chip chip-up',
}

// ── 툴팁 ─────────────────────────────────────────────────────────

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <div className="relative group/tip inline-block">
      {children}
      <div
        className="pointer-events-none absolute bottom-full right-0 mb-1.5 w-56 rounded px-3 py-2 hidden group-hover/tip:block z-50 shadow-xl whitespace-pre-line"
        style={{
          background: 'var(--bg-1)',
          border: '1px solid var(--border)',
          fontSize: 11,
          color: 'var(--fg-1)',
          lineHeight: 1.6,
        }}
      >
        {text}
        <div className="absolute top-full right-3 border-4 border-transparent" style={{ borderTopColor: 'var(--bg-1)' }} />
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
  if (v < 0)  return `BB %B ${v.toFixed(1)}% — 하단 밴드 이탈\n극단적 과매도. 강한 반등 신호.`
  if (v < 20) return `BB %B ${v.toFixed(1)}% — 하단 밴드 근접\n매수 최적 구간.`
  if (v < 35) return `BB %B ${v.toFixed(1)}% — 하단 접근\n매수 고려 구간.`
  if (v < 65) return `BB %B ${v.toFixed(1)}% — 중간 구간\n중립.`
  return `BB %B ${v.toFixed(1)}% — 상단 밴드 근접\n과매수 구간. 매수 부적합.`
}
function bbwTooltip(v: number) {
  if (v < 10) return `BBW ${v.toFixed(1)}% — 강한 밴드 수축\n폭발적 방향성 이탈 임박.`
  if (v < 30) return `BBW ${v.toFixed(1)}% — 밴드 수축 중\n에너지 축적 단계.`
  if (v < 60) return `BBW ${v.toFixed(1)}% — 일반 변동성\n특별한 수축 없음.`
  return `BBW ${v.toFixed(1)}% — 밴드 확장\n변동성이 이미 방출 중.`
}
function macdTooltip(v: number) {
  if (v < -500) return `MACD Hist ${v.toFixed(0)} — 강한 하락 모멘텀`
  if (v < 0) return `MACD Hist ${v.toFixed(0)} — 약한 하락 모멘텀`
  if (v === 0) return `MACD Hist 0 — 제로 크로스`
  return `MACD Hist +${v.toFixed(0)} — 상승 모멘텀`
}
function volumeTooltip(v: number) {
  if (v < 1.0) return `거래량 ${v.toFixed(2)}x — 거래량 부족`
  if (v < 1.5) return `거래량 ${v.toFixed(2)}x — 보통 수준 (1.5x 기준 미달)`
  if (v < 3.0) return `거래량 ${v.toFixed(2)}x — 유효 거래량`
  return `거래량 ${v.toFixed(2)}x — 강한 거래량 폭발`
}
function emaTooltip(v: string) {
  if (v === 'BULL') return `EMA 배열: BULL (정배열)\nEMA20 > EMA50 > EMA200 상승 추세`
  if (v === 'BEAR') return `EMA 배열: BEAR (역배열)\nEMA20 < EMA50 < EMA200 하락 추세`
  return `EMA 배열: NEUTRAL (횡보)\n추세 방향성 불명확`
}
function squeezeTooltip(v: number) {
  const desc: Record<number, string> = {
    0: `Lv0 — 수축 없음\n평범한 상태. 스퀴즈 조건 미충족.`,
    1: `Lv1 — 약한 수축\n에너지 축적 시작.`,
    2: `Lv2 — 중간 수축\n폭발 준비 단계.`,
    3: `Lv3 — 강한 수축\n이탈 시 강한 방향성 가능성 높음.`,
  }
  return desc[v] ?? `스퀴즈 Lv${v}`
}
function conditionsTooltip(v: number) {
  if (v <= 1) return `${v}/4 조건 충족 — 신호 약함`
  if (v === 2) return `${v}/4 조건 충족 — 참고 수준`
  if (v === 3) return `${v}/4 조건 충족 — 매수 고려`
  return `${v}/4 조건 충족 — 강한 매수 신호`
}

// ── 지표 테이블 ──────────────────────────────────────────────────

function IndicatorTable({ c }: { c: PatternCase }) {
  const rows = [
    { label: 'RSI', hint: '30~55 매수권', value: c.rsi?.toFixed(1), good: c.rsi != null && c.rsi >= 30 && c.rsi <= 55, tooltip: c.rsi != null ? rsiTooltip(c.rsi) : null },
    { label: 'BB %B', hint: '< 35% 하단밴드', value: c.bb_pct_b != null ? `${c.bb_pct_b.toFixed(1)}%` : null, good: c.bb_pct_b != null && c.bb_pct_b < 35, tooltip: c.bb_pct_b != null ? bbPctBTooltip(c.bb_pct_b) : null },
    { label: 'BBW', hint: '변동성 폭', value: c.bb_width != null ? `${c.bb_width.toFixed(1)}%` : null, good: null, tooltip: c.bb_width != null ? bbwTooltip(c.bb_width) : null },
    { label: 'MACD hist', hint: '음수 + 회복 중', value: c.macd_hist?.toFixed(0), good: c.macd_hist != null && c.macd_hist < 0, tooltip: c.macd_hist != null ? macdTooltip(c.macd_hist) : null },
    { label: '거래량 배율', hint: '≥ 1.5x 유효', value: c.volume_ratio != null ? `${c.volume_ratio.toFixed(2)}x` : null, good: c.volume_ratio != null && c.volume_ratio >= 1.5, tooltip: c.volume_ratio != null ? volumeTooltip(c.volume_ratio) : null },
    { label: 'EMA 배열', hint: 'BULL = 정배열', value: c.ema_alignment, good: c.ema_alignment === 'BULL', tooltip: c.ema_alignment ? emaTooltip(c.ema_alignment) : null },
    { label: '스퀴즈 레벨', hint: 'Lv0~3', value: c.squeeze_level != null ? `Lv${c.squeeze_level}` : null, good: null, tooltip: c.squeeze_level != null ? squeezeTooltip(c.squeeze_level) : null },
    { label: '충족 조건수', hint: '3개+ 권장', value: c.conditions_met != null ? `${c.conditions_met}/4` : null, good: c.conditions_met != null && c.conditions_met >= 3, tooltip: c.conditions_met != null ? conditionsTooltip(c.conditions_met) : null },
  ].filter(r => r.value != null)

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
            <th style={{ textAlign: 'left', padding: '6px 14px', fontSize: 10, fontWeight: 600, color: 'var(--fg-3)' }}>지표</th>
            <th style={{ textAlign: 'right', padding: '6px 14px', fontSize: 10, fontWeight: 600, color: 'var(--fg-3)' }}>시그널 시점 값</th>
            <th style={{ textAlign: 'left', padding: '6px 14px', fontSize: 10, fontWeight: 600, color: 'var(--fg-3)' }}>기준</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.label} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '6px 14px', color: 'var(--fg-2)' }}>{r.label}</td>
              <td className="mono" style={{
                padding: '6px 14px', textAlign: 'right', fontWeight: 600,
                color: r.good === true ? 'var(--up)' : r.good === false ? 'var(--warn)' : 'var(--fg-0)',
              }}>
                {r.tooltip ? (
                  <Tooltip text={r.tooltip}>
                    <span style={{ textDecoration: 'underline', textDecorationStyle: 'dotted', textDecorationColor: 'var(--fg-3)', cursor: 'help' }}>{r.value}</span>
                  </Tooltip>
                ) : r.value}
              </td>
              <td style={{ padding: '6px 14px', color: 'var(--fg-4)', fontSize: 11 }}>{r.hint}</td>
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

  const resultColor = c.result_pct == null ? 'var(--fg-3)' : c.result_pct > 0 ? 'var(--up)' : 'var(--down)'
  const marketLabel = c.market === 'KR' ? '🇰🇷' : '🇺🇸'
  const chipClass = PATTERN_CHIP[c.pattern_type] || 'chip chip-ghost'

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
      } catch { setNotesStatus('idle') }
    }, 1500)
  }

  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 6 }}>
      {/* 헤더 */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => { if (!confirmDelete) setOpen(o => !o) }}
      >
        <span className={chipClass} style={{ flexShrink: 0 }}>
          {PATTERN_LABEL[c.pattern_type] ?? c.pattern_type}
        </span>
        <span className="chip chip-ghost" style={{ flexShrink: 0, fontSize: 10 }}>
          {c.source === 'chart' ? '📊 차트' : '✏️ 수동'}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
          <div className="mono" style={{ fontSize: 11, color: 'var(--fg-3)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <span>{marketLabel} {c.stock_name}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span style={{ color: 'var(--accent)' }}>{c.symbol}</span>
            <span style={{ color: 'var(--border)' }}>·</span>
            <span>{c.signal_date}</span>
          </div>
        </div>

        {/* 수익률 */}
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          {c.result_pct != null ? (
            <div className="mono" style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 700, fontSize: 14, color: resultColor }}>
              {c.result_pct > 0 ? <TrendingUp size={13} /> : c.result_pct < 0 ? <TrendingDown size={13} /> : <Minus size={13} />}
              {c.result_pct > 0 ? '+' : ''}{c.result_pct.toFixed(1)}%
            </div>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--fg-3)' }}>진행중</span>
          )}
          {c.hold_days != null && (
            <div style={{ fontSize: 10, color: 'var(--fg-4)' }}>{c.hold_days}일 보유</div>
          )}
        </div>

        {/* 태그들 (PC) */}
        <div className="hidden xl:flex" style={{ gap: 4, flexShrink: 0 }}>
          {c.tags.slice(0, 3).map(t => (
            <span key={t} className="chip chip-ghost" style={{ fontSize: 10 }}>#{t}</span>
          ))}
        </div>

        {/* 삭제 버튼 */}
        <div style={{ flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          {confirmDelete ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 11, color: 'var(--down)' }}>삭제?</span>
              <button
                onClick={() => onDelete(c.id)}
                style={{ fontSize: 11, color: 'var(--down)', padding: '2px 8px', border: '1px solid var(--down)', borderRadius: 3, background: 'var(--down-bg)', cursor: 'pointer' }}
              >확인</button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ fontSize: 11, color: 'var(--fg-3)', padding: '2px 8px', border: '1px solid var(--border)', borderRadius: 3, background: 'transparent', cursor: 'pointer' }}
              >취소</button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              style={{ padding: 6, color: 'var(--fg-3)', background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: 4 }}
              title="삭제"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>

        <div style={{ color: 'var(--fg-3)', flexShrink: 0 }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </div>

      {/* 바디 */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-2)' }}>
          {/* 진입가 / 수익금 */}
          {(c.entry_price != null || c.profit_krw != null) && (
            <div style={{ display: 'flex', gap: 20, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
              {c.entry_price != null && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>진입가</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-0)' }}>
                    {c.market === 'US' ? `$${c.entry_price.toLocaleString()}` : `${c.entry_price.toLocaleString()}원`}
                  </div>
                </div>
              )}
              {c.profit_krw != null && (
                <div>
                  <div style={{ fontSize: 10, color: 'var(--fg-3)', marginBottom: 2 }}>매도수익금</div>
                  <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: c.profit_krw > 0 ? 'var(--up)' : c.profit_krw < 0 ? 'var(--down)' : 'var(--fg-0)' }}>
                    {c.profit_krw > 0 ? '+' : ''}{c.profit_krw.toLocaleString()}원
                  </div>
                </div>
              )}
            </div>
          )}

          <IndicatorTable c={c} />

          {/* 메모 */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 10, color: 'var(--fg-3)', fontWeight: 600 }}>분석 메모</div>
              {notesStatus === 'saving' && <span style={{ fontSize: 10, color: 'var(--fg-3)' }}>저장 중...</span>}
              {notesStatus === 'saved' && <span style={{ fontSize: 10, color: 'var(--up)' }}>저장됨</span>}
            </div>
            <textarea
              style={{
                width: '100%', background: 'var(--bg-1)', border: '1px solid var(--border)', borderRadius: 4,
                padding: '8px 10px', fontSize: 12, color: 'var(--fg-0)', outline: 'none', resize: 'none',
                lineHeight: 1.6, fontFamily: 'var(--font-sans)', boxSizing: 'border-box',
              }}
              rows={3}
              value={notesDraft}
              onChange={e => handleNotesChange(e.target.value)}
              placeholder="매수 이유, 패턴 특징, 향후 활용 방안..."
            />
          </div>

          {/* 태그 + 액션 */}
          <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {c.tags.map(t => (
                <span key={t} className="chip chip-ghost" style={{ fontSize: 10 }}>#{t}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
              <button
                onClick={e => { e.stopPropagation(); nav(`/${c.symbol}?market=${c.market_type || c.market}&highlightDate=${c.signal_date}`) }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
              >
                <BarChart2 size={12} /> 차트
              </button>
              <button
                onClick={() => onEdit(c)}
                style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--fg-3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px 8px' }}
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

function SellInfoModal({ initial, onSave, onClose }: {
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
      await onSave({ profit_krw: num(profitKrw), result_pct: num(resultPct), hold_days: int(holdDays) })
      onClose()
    } finally { setSaving(false) }
  }

  const inpStyle: React.CSSProperties = {
    width: '100%', background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 4,
    padding: '6px 10px', fontSize: 12, color: 'var(--fg-0)', outline: 'none', boxSizing: 'border-box',
  }
  const ro: React.CSSProperties = { fontSize: 13, color: 'var(--fg-0)', fontFamily: 'var(--font-mono)' }
  const roLbl: React.CSSProperties = { fontSize: 10, color: 'var(--fg-3)', marginBottom: 3 }
  const priceFmt = (v: number | null) =>
    v == null ? '-' : initial.market === 'US' ? `$${v.toLocaleString()}` : `${v.toLocaleString()}원`

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(0,0,0,0.5)' }}
      onClick={onClose}
    >
      <div
        className="panel"
        style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <span className="label" style={{ color: 'var(--accent)' }}>매도 정보 입력</span>
          <button onClick={onClose} style={{ color: 'var(--fg-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
        </div>

        <div style={{ overflowY: 'auto', flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* 읽기 전용 */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="label" style={{ color: 'var(--accent)' }}>스크랩 정보</div>
            <div><div style={roLbl}>제목</div><div style={ro}>{initial.title}</div></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div><div style={roLbl}>종목</div><div style={ro}>{initial.stock_name} ({initial.symbol})</div></div>
              <div><div style={roLbl}>시장</div><div style={ro}>{initial.market}</div></div>
              <div><div style={roLbl}>패턴</div><div style={ro}>{PATTERN_LABEL[initial.pattern_type] ?? initial.pattern_type}</div></div>
              <div><div style={roLbl}>시그널 날짜</div><div style={ro}>{initial.signal_date}</div></div>
              <div><div style={roLbl}>진입가</div><div style={ro}>{priceFmt(initial.entry_price)}</div></div>
              <div><div style={roLbl}>충족 조건</div><div style={ro}>{initial.conditions_met != null ? `${initial.conditions_met}/4` : '-'}</div></div>
              <div><div style={roLbl}>RSI</div><div style={ro}>{initial.rsi?.toFixed(1) ?? '-'}</div></div>
              <div><div style={roLbl}>BB %B</div><div style={ro}>{initial.bb_pct_b != null ? `${initial.bb_pct_b.toFixed(1)}%` : '-'}</div></div>
              <div><div style={roLbl}>BBW</div><div style={ro}>{initial.bb_width != null ? `${initial.bb_width.toFixed(1)}%` : '-'}</div></div>
            </div>
            {initial.tags.length > 0 && (
              <div>
                <div style={roLbl}>태그</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {initial.tags.map(t => <span key={t} className="chip chip-ghost" style={{ fontSize: 10 }}>#{t}</span>)}
                </div>
              </div>
            )}
            {initial.notes && (
              <div><div style={roLbl}>분석 메모</div><div style={{ ...ro, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{initial.notes}</div></div>
            )}
          </div>

          {/* 매도 입력 */}
          <div style={{ background: 'var(--bg-2)', border: '1px solid var(--accent)', borderRadius: 6, padding: 12 }}>
            <div className="label" style={{ color: 'var(--accent)', marginBottom: 10 }}>매도 정보</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ ...roLbl, display: 'block' }}>매도수익금 (원)</label>
                <input type="number" style={inpStyle} value={profitKrw} onChange={e => setProfitKrw(e.target.value)} placeholder="150000" />
              </div>
              <div>
                <label style={{ ...roLbl, display: 'block' }}>매도수익률 (%)</label>
                <input type="number" style={inpStyle} value={resultPct} onChange={e => setResultPct(e.target.value)} placeholder="34.5" step="0.1" />
              </div>
              <div>
                <label style={{ ...roLbl, display: 'block' }}>보유기간 (일)</label>
                <input type="number" style={inpStyle} value={holdDays} onChange={e => setHoldDays(e.target.value)} placeholder="5" />
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '10px 16px', borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} style={{ padding: '6px 16px', fontSize: 12, color: 'var(--fg-3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>취소</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ padding: '6px 20px', fontSize: 12, fontWeight: 700, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: saving ? 0.5 : 1 }}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 스켈레톤 ─────────────────────────────────────────────────────

function ScrapSkeleton({ mobile }: { mobile: boolean }) {
  const sk = (w: number | string, h: number, r = 4) => (
    <div className="skeleton" style={{ width: w, height: h, borderRadius: r, flexShrink: 0 }} />
  )

  const kpiGrid = (cols: number) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: mobile ? 6 : 8 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="panel" style={{ padding: mobile ? '10px 14px' : '10px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          {sk('55%', 18, 3)}
          {sk('65%', 10, 3)}
        </div>
      ))}
    </div>
  )

  const tabRow = (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', paddingBottom: 1 }}>
      {[60, 80, 64, 72, 68].map((w, i) => (
        <div key={i} style={{ padding: '8px 14px', borderBottom: i === 0 ? '2px solid var(--accent)' : '2px solid transparent' }}>
          {sk(w, 11, 3)}
        </div>
      ))}
    </div>
  )

  const accordionItems = Array.from({ length: mobile ? 5 : 7 }).map((_, i) => (
    <div key={i} className="panel" style={{ padding: 0, overflow: 'hidden', marginBottom: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        {sk(64, 18, 3)}
        {sk(42, 18, 3)}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {sk('50%', 13, 3)}
          {sk('35%', 10, 3)}
        </div>
        {sk(40, 16, 3)}
        {sk(14, 14, 3)}
      </div>
    </div>
  ))

  if (mobile) {
    return (
      <>
        <div style={{ flexShrink: 0, padding: '12px 14px 0' }}>{kpiGrid(3)}</div>
        <div style={{ flexShrink: 0, padding: '8px 14px 0' }}>{tabRow}</div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 14px 14px' }}>{accordionItems}</div>
      </>
    )
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        {sk(18, 18, 9)}
        {sk(120, 20, 3)}
        {sk(100, 12, 3)}
      </div>
      <div style={{ marginBottom: 16 }}>{kpiGrid(6)}</div>
      <div style={{ marginBottom: 12 }}>{tabRow}</div>
      <div style={{ paddingTop: 8 }}>{accordionItems}</div>
    </div>
  )
}

// ── 메인 ─────────────────────────────────────────────────────────

export default function Scrap() {
  const { user, loading: authLoading } = useAuthStore()
  const nav = useNavigate()
  const [cases, setCases] = useState<PatternCase[]>([])
  const [loading, setLoading] = useState(true)
  const [activeType, setActiveType] = useState('all')
  const [soldOnly, setSoldOnly] = useState(false)
  const [editTarget, setEditTarget] = useState<PatternCase | null>(null)
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)
  const listAtTop = useRef(true)
  const listAtBottom = useRef(true)
  const listRef = useRef<HTMLDivElement>(null)

  const selectType = (key: string) => { setActiveType(key); setSoldOnly(false) }
  const selectSoldOnly = () => { setSoldOnly(true); setActiveType('all') }
  const selectAll = () => { setSoldOnly(false); setActiveType('all') }

  const load = async () => {
    setLoading(true)
    try { setCases(await fetchPatternCases()) } catch { /* ignore */ } finally { setLoading(false) }
  }

  // authLoading 체크: 인증 초기화 전에 쿼리 발사하면 토큰 없이 요청됨 (새로고침 시 race condition 방지)
  useEffect(() => {
    if (authLoading) return
    if (user) load()
    else setLoading(false)
  }, [user?.id, authLoading])

  const filtered = useMemo(() => {
    let list = cases
    if (soldOnly) list = list.filter(c => c.profit_krw != null)
    if (activeType !== 'all') list = list.filter(c => c.pattern_type === activeType)
    return list
  }, [cases, activeType, soldOnly])

  const handleSwipe = (e: React.TouchEvent) => {
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) < 60) return
      const idx = PATTERN_TYPES.findIndex(t => t.key === activeType)
      if (dx < 0 && idx < PATTERN_TYPES.length - 1) selectType(PATTERN_TYPES[idx + 1].key)
      else if (dx > 0 && idx > 0) selectType(PATTERN_TYPES[idx - 1].key)
    } else {
      if (Math.abs(dy) < 90) return
      if (dy > 0 && listAtTop.current) nav('/buy-list')
      else if (dy < 0 && listAtBottom.current) nav('/settings')
    }
  }

  // 통계
  const stats = useMemo(() => {
    const resolved = cases.filter(c => c.result_pct != null)
    const wins = resolved.filter(c => (c.result_pct ?? 0) > 0)
    const avgReturn = wins.length > 0 ? wins.reduce((s, c) => s + (c.result_pct ?? 0), 0) / wins.length : 0
    const winRate = resolved.length > 0 ? Math.round(wins.length / resolved.length * 100) : null
    const sold = cases.filter(c => c.profit_krw != null)
    const sumProfit = sold.reduce((s, c) => s + (c.profit_krw ?? 0), 0)
    const holdArr = sold.filter(c => c.hold_days != null)
    const avgHoldDays = holdArr.length > 0 ? holdArr.reduce((s, c) => s + (c.hold_days ?? 0), 0) / holdArr.length : null
    return { total: cases.length, wins: wins.length, avgReturn, winRate, sumProfit, avgHoldDays, sold: sold.length }
  }, [cases])

  const fmtProfit = (v: number) => `${v > 0 ? '+' : ''}${Math.round(v).toLocaleString()}원`
  const profitColor = stats.sumProfit > 0 ? 'var(--up)' : stats.sumProfit < 0 ? 'var(--down)' : 'var(--fg-0)'

  const handleSave = async (data: any) => {
    if (!editTarget) return
    const updated = await updatePatternCase(editTarget.id, data)
    setCases(prev => prev.map(c => c.id === editTarget.id ? updated : c))
    setEditTarget(null)
  }

  // KPI 카드 데이터
  const statCards = [
    { label: '총 사례', value: stats.total.toString(), color: 'var(--fg-0)', onClick: selectAll, active: !soldOnly && activeType === 'all' },
    { label: '승률', value: stats.winRate != null ? `${stats.winRate}%` : '—', color: 'var(--accent)' },
    { label: '평균 수익률', value: stats.avgReturn > 0 ? `+${stats.avgReturn.toFixed(1)}%` : '—', color: 'var(--up)' },
    { label: '매도 수익합', value: stats.sold > 0 ? fmtProfit(stats.sumProfit) : '—', color: profitColor, nowrap: true },
    { label: '매도 사례', value: stats.sold.toString(), color: 'var(--up)', onClick: selectSoldOnly, active: soldOnly },
    { label: '평균 보유일', value: stats.avgHoldDays != null ? `${stats.avgHoldDays.toFixed(1)}일` : '—', color: 'var(--fg-0)' },
  ]

  const renderKpiCard = (s: typeof statCards[number]) => (
    <div
      key={s.label}
      onClick={s.onClick}
      className="panel"
      style={{
        padding: '10px 14px',
        textAlign: 'center',
        cursor: s.onClick ? 'pointer' : 'default',
        borderColor: s.active ? 'var(--accent)' : 'var(--border)',
        background: s.active ? 'var(--accent-bg, #eff6ff)' : 'var(--bg-1)',
      }}
    >
      <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: s.color, whiteSpace: (s as any).nowrap ? 'nowrap' : undefined }}>
        {s.value}
      </div>
      <div style={{ fontSize: 10, color: 'var(--fg-3)', marginTop: 3 }}>{s.label}</div>
    </div>
  )

  const tabs = (tabStyle: 'mobile' | 'pc') => (
    <div style={{ display: 'flex', gap: tabStyle === 'pc' ? 0 : 2, borderBottom: '1px solid var(--border)', overflowX: 'auto' }}>
      {PATTERN_TYPES.map(pt => {
        const cnt = pt.key === 'all' ? cases.length : cases.filter(c => c.pattern_type === pt.key).length
        const active = activeType === pt.key
        return (
          <button
            key={pt.key}
            onClick={() => selectType(pt.key)}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: active ? 700 : 400,
              color: active ? 'var(--accent)' : 'var(--fg-3)',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              marginBottom: -1,
            }}
          >
            {pt.label}
            <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.6 }}>({cnt})</span>
          </button>
        )
      })}
    </div>
  )

  const caseList = (
    <>
      {!user ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <BookMarked size={32} style={{ color: 'var(--fg-4)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 4 }}>로그인 후 나만의 BUY 사례를 관리할 수 있습니다</p>
          <p style={{ fontSize: 11, color: 'var(--fg-4)' }}>우측 상단 메뉴에서 Google 로그인</p>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <BookMarked size={32} style={{ color: 'var(--fg-4)', margin: '0 auto 12px' }} />
          <p style={{ fontSize: 13, color: 'var(--fg-3)' }}>
            {activeType === 'all' ? '아직 스크랩된 사례가 없습니다.' : '이 유형의 사례가 없습니다.'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--fg-4)', marginTop: 6 }}>차트 화면에서 BUY 시그널을 스크랩하면 여기에 표시됩니다.</p>
        </div>
      ) : (
        <div style={{ paddingTop: 8 }}>
          {filtered.map(c => (
            <CaseAccordion key={c.id} c={c} onEdit={setEditTarget} onDelete={async (id) => {
              await deletePatternCase(id)
              setCases(prev => prev.filter(c => c.id !== id))
            }} />
          ))}
        </div>
      )}
    </>
  )

  return (
    <>
      {/* ── 모바일 레이아웃 ── */}
      <div className="md:hidden fixed inset-x-0 top-0 flex flex-col" style={{ bottom: 64, background: 'var(--bg-0)' }}>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
          <BookMarked size={15} style={{ color: 'var(--accent)' }} />
          <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)', margin: 0 }}>BUY 사례 스크랩</h2>
        </div>
        {loading && user ? (
          <ScrapSkeleton mobile />
        ) : (
          <>
            <div style={{ flexShrink: 0, padding: '12px 14px 0' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                {statCards.map(renderKpiCard)}
              </div>
            </div>
            <div style={{ flexShrink: 0, padding: '8px 14px 0' }}>
              {tabs('mobile')}
            </div>
            <div
              ref={listRef}
              style={{ flex: 1, overflowY: 'auto', padding: '0 14px 14px' }}
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
          </>
        )}
      </div>

      {/* ── PC 레이아웃 ── */}
      <div className="hidden md:block" style={{ maxWidth: 900, margin: '0 auto', padding: '24px 20px' }}>
        {loading && user ? (
          <ScrapSkeleton mobile={false} />
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <BookMarked size={18} style={{ color: 'var(--accent)' }} />
              <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--fg-0)', margin: 0 }}>BUY 사례 스크랩</h1>
              <span style={{ fontSize: 12, color: 'var(--fg-3)' }}>승률 높은 조건 기록</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 16 }}>
              {statCards.map(renderKpiCard)}
            </div>
            <div style={{ marginBottom: 12 }}>
              {tabs('pc')}
            </div>
            {caseList}
          </>
        )}
      </div>

      {editTarget && (
        <SellInfoModal initial={editTarget} onSave={handleSave} onClose={() => setEditTarget(null)} />
      )}
    </>
  )
}
