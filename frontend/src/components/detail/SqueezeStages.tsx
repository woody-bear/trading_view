/* SQZ Terminal — SqueezeStages (Phase 12)
   원본: /tmp/design_extract/asst/project/pc-detail.jsx SqueezeStages
   현재 squeeze_level (0~3) 을 4단계로 시각화. */

interface Props {
  level?: number | null  // 0=NO SQ, 1=LOW, 2=MID, 3=HIGH
  bandwidthPct?: number | null
}

const STAGES = [
  { n: '1', label: 'NO SQ', color: 'var(--up)' },
  { n: '2', label: 'LOW',   color: 'var(--warn)' },
  { n: '3', label: 'MID',   color: 'oklch(0.7 0.2 45)' },
  { n: '4', label: 'HIGH',  color: 'var(--down)' },
]

export default function SqueezeStages({ level = 0, bandwidthPct = null }: Props) {
  const activeIdx = Math.min(3, Math.max(0, level ?? 0))

  return (
    <div className="panel" style={{ padding: 0 }}>
      <div
        className="flex justify-between"
        style={{
          padding: '10px 14px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <div className="label">SQUEEZE · 4 STAGES</div>
        {bandwidthPct != null && (
          <span style={{ fontSize: 10, color: 'var(--fg-3)', fontFamily: 'var(--font-mono)' }}>
            BW {bandwidthPct.toFixed(2)}%
          </span>
        )}
      </div>
      <div className="flex" style={{ padding: 12, gap: 0 }}>
        {STAGES.map((st, i) => {
          const active = i === activeIdx
          return (
            <div key={st.n} style={{ flex: 1, textAlign: 'center', position: 'relative' }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  margin: '0 auto',
                  background: active ? st.color : 'transparent',
                  border: `1.5px solid ${st.color}`,
                  color: active ? 'var(--bg-1)' : st.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 700,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {st.n}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  marginTop: 4,
                  color: active ? st.color : 'var(--fg-3)',
                  fontWeight: 600,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.04em',
                }}
              >
                {st.label}
              </div>
              {i < 3 && (
                <div
                  style={{
                    position: 'absolute',
                    top: 14,
                    right: -8,
                    width: 16,
                    height: 1,
                    background: 'var(--border)',
                  }}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
