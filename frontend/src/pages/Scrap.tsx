import { BookMarked, ChevronDown, ChevronUp, Edit3, Plus, Trash2, X, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { fetchPatternCases, createPatternCase, updatePatternCase, deletePatternCase } from '../api/client'

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
  created_at: string
}

const PATTERN_TYPES: { key: string; label: string; color: string }[] = [
  { key: 'all',               label: '전체',         color: 'text-white' },
  { key: 'squeeze_breakout',  label: '스퀴즈 이탈',   color: 'text-yellow-400' },
  { key: 'oversold_bounce',   label: '과매도 반등',   color: 'text-cyan-400' },
  { key: 'custom',            label: '직접 입력',     color: 'text-purple-400' },
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

// ── 지표 테이블 ──────────────────────────────────────────────────

function IndicatorTable({ c }: { c: PatternCase }) {
  const rows = [
    { label: 'RSI', value: c.rsi?.toFixed(1), good: c.rsi != null && c.rsi >= 30 && c.rsi <= 55, hint: '30~55 매수권' },
    { label: 'BB %B', value: c.bb_pct_b != null ? `${c.bb_pct_b.toFixed(1)}%` : null, good: c.bb_pct_b != null && c.bb_pct_b < 35, hint: '< 35% 하단밴드' },
    { label: 'BBW', value: c.bb_width != null ? `${c.bb_width.toFixed(1)}%` : null, good: null, hint: '변동성 폭' },
    { label: 'MACD hist', value: c.macd_hist?.toFixed(0), good: c.macd_hist != null && c.macd_hist < 0, hint: '음수 + 회복 중' },
    { label: '거래량 배율', value: c.volume_ratio != null ? `${c.volume_ratio.toFixed(2)}x` : null, good: c.volume_ratio != null && c.volume_ratio >= 1.5, hint: '≥ 1.5x 유효' },
    { label: 'EMA 배열', value: c.ema_alignment, good: c.ema_alignment === 'BULL', hint: 'BULL = 정배열' },
    { label: '스퀴즈 레벨', value: c.squeeze_level != null ? `Lv${c.squeeze_level}` : null, good: null, hint: '0~3' },
    { label: '충족 조건수', value: c.conditions_met != null ? `${c.conditions_met}/4` : null, good: c.conditions_met != null && c.conditions_met >= 3, hint: '3개+ 권장' },
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
              }`}>{r.value}</td>
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

  const resultColor = c.result_pct == null ? 'text-[var(--muted)]'
    : c.result_pct > 0 ? 'text-green-400' : 'text-red-400'

  const marketLabel = c.market === 'KR' ? '🇰🇷' : '🇺🇸'
  const ptColor = PATTERN_COLOR[c.pattern_type] || PATTERN_COLOR.custom

  return (
    <div className="border border-[var(--border)] rounded-lg overflow-hidden mb-2">
      {/* 헤더 */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/3 transition-colors select-none"
        onClick={() => setOpen(o => !o)}
      >
        {/* 패턴 뱃지 */}
        <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold shrink-0 ${ptColor}`}>
          {PATTERN_LABEL[c.pattern_type] ?? c.pattern_type}
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

          {/* 분석 메모 */}
          {c.notes && (
            <div className="px-4 py-3 border-t border-[var(--border)]/50">
              <div className="text-[10px] text-[var(--muted)] mb-1">분석 메모</div>
              <p className="text-[12px] text-white/80 leading-relaxed whitespace-pre-wrap">{c.notes}</p>
            </div>
          )}

          {/* 태그 + 액션 */}
          <div className="px-4 py-3 border-t border-[var(--border)]/50 flex items-center justify-between">
            <div className="flex flex-wrap gap-1">
              {c.tags.map(t => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 bg-[var(--border)]/60 rounded text-[var(--muted)]">#{t}</span>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onEdit(c)}
                className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-[var(--gold)] transition-colors px-2 py-1"
              >
                <Edit3 size={12} /> 수정
              </button>
              <button
                onClick={() => onDelete(c.id)}
                className="flex items-center gap-1 text-[11px] text-[var(--muted)] hover:text-red-400 transition-colors px-2 py-1"
              >
                <Trash2 size={12} /> 삭제
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

  useEffect(() => { load() }, [])

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
    if (!window.confirm('이 케이스를 삭제하시겠습니까?')) return
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
      {loading ? (
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
