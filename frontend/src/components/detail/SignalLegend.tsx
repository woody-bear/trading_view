/* SQZ Terminal — SignalLegend
   SQZ BUY/SELL 설명 + 스퀴즈 4단계 (통합 패널) */

interface Props {
  level?: number | null
  bandwidthPct?: number | null
}

const STAGES = [
  { label: 'NO SQ',  sub: '돌파 임박',    color: 'var(--up)' },
  { label: 'LOW SQ', sub: '경계 수위',     color: 'var(--warn)' },
  { label: 'MID SQ', sub: '에너지 축적',   color: 'oklch(0.7 0.2 45)' },
  { label: 'MAX SQ', sub: '폭발 직전',     color: 'var(--down)' },
]

export default function SignalLegend({ level = 0, bandwidthPct = null }: Props) {
  const activeIdx = Math.min(3, Math.max(0, level ?? 0))

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div
        className="flex justify-between items-center"
        style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}
      >
        <div className="label">SIGNAL LEGEND</div>
        {bandwidthPct != null && (
          <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            BW {bandwidthPct.toFixed(2)}%
          </span>
        )}
      </div>

      <div className="flex flex-col" style={{ padding: 12, gap: 10 }}>
        {/* SQZ BUY / SELL */}
        <div>
          <div className="flex" style={{ gap: 10, fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 11 }}>
            <span style={{ color: 'var(--mag)' }}>▲ SQZ BUY</span>
            <span style={{ color: 'var(--mag)' }}>▼ SQZ SELL</span>
          </div>
          <div style={{ color: 'var(--fg-2)', marginTop: 4, fontSize: 10.5, lineHeight: 1.5 }}>
            스퀴즈 해제 순간 + 모멘텀 방향성으로 발생. 에너지 압축 후 폭발적 방향
            전환 — 추세 시작 신호로 신뢰도 높음.
          </div>
        </div>

        <div style={{ height: 1, background: 'var(--border)' }} />

        {/* 스퀴즈 4단계 */}
        <div>
          <div className="label" style={{ fontSize: 9.5, marginBottom: 10 }}>SQUEEZE · 4 STAGES</div>
          <div className="flex flex-col" style={{ gap: 6 }}>
            {STAGES.map((st, i) => {
              const active = i === activeIdx
              return (
                <div
                  key={st.label}
                  className="flex items-center"
                  style={{ gap: 10 }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: active ? st.color : 'transparent',
                      border: `1.5px solid ${st.color}`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      fontWeight: 700,
                      color: active ? st.color : 'var(--fg-2)',
                      width: 52,
                    }}
                  >
                    {st.label}
                  </span>
                  <span style={{ fontSize: 10.5, color: active ? 'var(--fg-0)' : 'var(--fg-3)' }}>
                    {st.sub}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
