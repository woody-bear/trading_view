import type { Step, StepKind } from '../../constants/conditions'

interface ConditionStepTableProps {
  steps: readonly Step[]
  title: string
  guidance?: string
}

const KIND_LABEL: Record<StepKind, string> = {
  entry:     '시작',
  condition: '조건',
  branch:    '분기',
  merge:     '합류',
  success:   '결과',
  reject:    '제외',
  note:      '참고',
}

const KIND_CHIP: Record<StepKind, string> = {
  entry:     'chip chip-ghost',
  condition: 'chip chip-ghost',
  branch:    'chip chip-warn',
  merge:     'chip chip-ghost',
  success:   'chip chip-up',
  reject:    'chip chip-down',
  note:      'chip chip-accent',
}

function buildLabelMap(steps: readonly Step[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const s of steps) map[s.id] = s.label
  return map
}

export default function ConditionStepTable({ steps, title, guidance }: ConditionStepTableProps) {
  const labelMap = buildLabelMap(steps)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label={`${title} 조건표`}>
      {guidance && (
        <div className="panel" style={{ background: 'var(--accent-bg, #eff6ff)', borderColor: 'var(--accent)', padding: '10px 14px' }}>
          <p style={{ fontSize: 11, color: 'var(--accent)', lineHeight: 1.6 }}>{guidance}</p>
        </div>
      )}
      <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {steps.map((step, index) => (
          <li key={step.id} className="panel" style={{ padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
              {/* 순번 */}
              <span
                className="mono"
                style={{
                  minWidth: 22,
                  height: 22,
                  borderRadius: '50%',
                  background: 'var(--bg-3)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: 'var(--fg-1)',
                  flexShrink: 0,
                }}
              >
                {index + 1}
              </span>
              {/* 종류 칩 */}
              <span className={KIND_CHIP[step.kind]} style={{ flexShrink: 0, marginTop: 2 }}>
                {KIND_LABEL[step.kind]}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-0)', lineHeight: 1.35, margin: 0 }}>
                  {step.label}
                </p>
                {step.description && (
                  <p className="mono" style={{ fontSize: 11, color: 'var(--fg-2)', marginTop: 4 }}>
                    {step.description}
                  </p>
                )}
                {step.branches && step.branches.length > 0 && (
                  <ul style={{ marginTop: 6, listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {step.branches.map((branch) => (
                      <li key={branch.targetId} style={{ display: 'flex', gap: 6, fontSize: 11 }}>
                        <span style={{ color: 'var(--fg-4)', flexShrink: 0 }}>└</span>
                        <span>
                          <span style={{ color: 'var(--fg-1)', fontWeight: 600 }}>{branch.label}</span>
                          <span style={{ color: 'var(--fg-3)' }}> → {labelMap[branch.targetId] ?? branch.targetId}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {step.note && (
                  <p style={{ fontSize: 11, color: 'var(--accent)', marginTop: 6, fontStyle: 'italic' }}>
                    ※ {step.note}
                  </p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
