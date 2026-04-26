import type { SwingPivotInfo } from '../../api/client'

interface Props {
  high?: SwingPivotInfo
  low?: SwingPivotInfo
  useOverall?: boolean   // true → overall_direction/overall_points 사용 (장기용)
  termLabel: string      // '단기' | '장기'
  periodLabel: string    // '3m' | '12m'
  footnote?: string
}

interface TermDef {
  code: string
  label: string
  color: string
  meaning: string
  detail: string
  type: 'high' | 'low'
  dir: 'up' | 'down'
}

const TERMS: TermDef[] = [
  {
    code: 'HH',
    label: 'Higher High · 고점 상승',
    color: '#15803d',
    meaning: '매번 더 높은 고점 형성',
    detail: '상승추세 저항선 — 강세 구간',
    type: 'high',
    dir: 'up',
  },
  {
    code: 'HL',
    label: 'Higher Low · 저점 상승',
    color: '#222222',
    meaning: '하락해도 더 높은 저점 유지',
    detail: '상승추세 지지선 — 매수세 유지',
    type: 'low',
    dir: 'up',
  },
  {
    code: 'LH',
    label: 'Lower High · 고점 하락',
    color: '#b8860b',
    meaning: '반등마다 더 낮은 고점 형성',
    detail: '하락추세 저항선 — 매도 압력',
    type: 'high',
    dir: 'down',
  },
  {
    code: 'LL',
    label: 'Lower Low · 저점 하락',
    color: '#b91c1c',
    meaning: '하락마다 더 낮은 저점 기록',
    detail: '하락추세 지지선 — 추가 하락 위험',
    type: 'low',
    dir: 'down',
  },
]

function getActive(high: SwingPivotInfo | undefined, low: SwingPivotInfo | undefined, useOverall: boolean): Set<string> {
  const hDir = useOverall ? high?.overall_direction : high?.direction
  const lDir = useOverall ? low?.overall_direction : low?.direction
  const s = new Set<string>()
  if (hDir === 'up') s.add('HH')
  if (hDir === 'down') s.add('LH')
  if (lDir === 'up') s.add('HL')
  if (lDir === 'down') s.add('LL')
  return s
}

function stageText(high: SwingPivotInfo | undefined, low: SwingPivotInfo | undefined, useOverall: boolean) {
  const h = useOverall ? high?.overall_direction : high?.direction
  const l = useOverall ? low?.overall_direction : low?.direction
  if (h === 'up' && l === 'up') return { label: '상승추세', sub: 'HH + HL — 고점·저점 모두 상승' }
  if (h === 'down' && l === 'down') return { label: '하락추세', sub: 'LH + LL — 고점·저점 모두 하락' }
  if (h === 'up' && l === 'down') return { label: '발산 패턴', sub: 'HH + LL — 변동폭 확대' }
  if (h === 'down' && l === 'up') return { label: '수렴 패턴', sub: 'LH + HL — 삼각수렴 가능성' }
  return null
}

export default function TrendlineGlossaryPanel({ high, low, useOverall = false, termLabel, periodLabel, footnote }: Props) {
  const active = getActive(high, low, useOverall)
  const stage  = stageText(high, low, useOverall)

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div className="label">
          {termLabel} 추세선 가이드{' '}
          <span style={{ fontSize: 9, fontFamily: 'var(--font-mono)', color: 'var(--fg-4)', fontWeight: 400 }}>{periodLabel}</span>
        </div>
      </div>

      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {TERMS.map((t) => {
          const isActive = active.has(t.code)
          return (
            <div
              key={t.code}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                padding: '7px 9px',
                borderRadius: 5,
                background: isActive ? `color-mix(in oklch, ${t.color} 8%, var(--bg-1))` : 'var(--bg-2)',
                border: `1px solid ${isActive ? t.color : 'var(--border)'}`,
                opacity: isActive ? 1 : 0.5,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0, paddingTop: 1 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: t.color }} />
                <span style={{ fontSize: 9, fontWeight: 800, fontFamily: 'var(--font-mono)', color: t.color, letterSpacing: '0.03em' }}>
                  {t.code}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: isActive ? 'var(--fg-0)' : 'var(--fg-3)' }}>
                  {t.label}
                </span>
                <span style={{ fontSize: 9.5, color: isActive ? 'var(--fg-1)' : 'var(--fg-4)', lineHeight: 1.4 }}>
                  {t.meaning}
                </span>
                <span style={{ fontSize: 9, color: isActive ? t.color : 'var(--fg-4)', fontFamily: 'var(--font-mono)' }}>
                  {t.detail}
                </span>
              </div>

              {isActive && (
                <div style={{ marginLeft: 'auto', flexShrink: 0, paddingTop: 1 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: t.color, background: `color-mix(in oklch, ${t.color} 15%, transparent)`, padding: '1px 5px', borderRadius: 3, border: `1px solid ${t.color}` }}>
                    현재
                  </span>
                </div>
              )}
            </div>
          )
        })}

        {stage && (
          <div style={{ marginTop: 2, padding: '7px 10px', borderRadius: 5, background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-0)' }}>{termLabel} {stage.label}</div>
            <div style={{ fontSize: 9.5, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>{stage.sub}</div>
          </div>
        )}

        {/* 교과서 패턴 설명 */}
        <div style={{ marginTop: 4, padding: '8px 10px', borderRadius: 5, background: 'var(--bg-2)', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 7 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-2)', marginBottom: 1 }}>추세 판단 기준</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#15803d' }}>▲ 교과서적 상승추세</span>
            </div>
            <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: 'var(--fg-3)' }}>
                <span style={{ width: 10, height: 1.5, background: '#15803d', display: 'inline-block', flexShrink: 0 }} />
                <span>HH — 고점이 계속 높아짐</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: 'var(--fg-3)' }}>
                <span style={{ width: 10, height: 1.5, background: '#222222', display: 'inline-block', flexShrink: 0 }} />
                <span>HL — 저점도 함께 높아짐</span>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 }}>
              <span style={{ fontSize: 9.5, fontWeight: 700, color: '#b91c1c' }}>▼ 교과서적 하락추세</span>
            </div>
            <div style={{ paddingLeft: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: 'var(--fg-3)' }}>
                <span style={{ width: 10, height: 1.5, background: '#b8860b', display: 'inline-block', flexShrink: 0 }} />
                <span>LH — 고점이 계속 낮아짐</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9.5, color: 'var(--fg-3)' }}>
                <span style={{ width: 10, height: 1.5, background: '#b91c1c', display: 'inline-block', flexShrink: 0 }} />
                <span>LL — 저점도 함께 낮아짐</span>
              </div>
            </div>
          </div>
        </div>

        <div style={{ fontSize: 9, color: 'var(--fg-4)', paddingTop: 2, lineHeight: 1.5 }}>
          {footnote ?? `* 최근 2개 스윙 포인트 방향 기준`}
        </div>
      </div>
    </div>
  )
}
