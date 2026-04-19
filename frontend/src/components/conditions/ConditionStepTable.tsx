import type { Step, StepKind } from '../../constants/conditions'

interface ConditionStepTableProps {
  steps: readonly Step[]
  title: string
  guidance?: string
}

const KIND_LABEL: Record<StepKind, string> = {
  entry: '진입',
  condition: '조건',
  branch: '분기',
  merge: '합류',
  success: '결과',
  reject: '제외',
  note: '참고',
}

const KIND_STYLE: Record<StepKind, string> = {
  entry: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  condition: 'bg-[var(--bg)] text-[var(--muted)] border-[var(--border)]',
  branch: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
  merge: 'bg-slate-500/10 text-slate-300 border-slate-500/30',
  success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  reject: 'bg-red-500/10 text-red-300 border-red-500/30',
  note: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30',
}

// 동일한 id로 타겟되는 Step의 label lookup (분기 결과 표시용)
function buildLabelMap(steps: readonly Step[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const s of steps) map[s.id] = s.label
  return map
}

export default function ConditionStepTable({ steps, title, guidance }: ConditionStepTableProps) {
  const labelMap = buildLabelMap(steps)

  return (
    <div className="space-y-2" aria-label={`${title} 조건표`}>
      {guidance && (
        <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs text-indigo-300">
          {guidance}
        </div>
      )}
      <ol className="space-y-2 list-none p-0">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-3"
          >
            <div className="flex items-start gap-2">
              <span className="inline-flex items-center justify-center w-6 h-6 shrink-0 rounded-full bg-[var(--bg)] text-[var(--fg)] text-xs font-bold">
                {index + 1}
              </span>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border shrink-0 ${KIND_STYLE[step.kind]}`}
              >
                {KIND_LABEL[step.kind]}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[var(--fg)] leading-tight">{step.label}</p>
                {step.description && (
                  <p className="text-xs text-[var(--muted)] mt-1">{step.description}</p>
                )}
                {step.branches && step.branches.length > 0 && (
                  <ul className="mt-2 space-y-1 text-xs">
                    {step.branches.map((branch) => (
                      <li key={branch.targetId} className="flex gap-1.5">
                        <span className="text-[var(--muted)] shrink-0">└</span>
                        <span>
                          <span className="text-[var(--fg)]">{branch.label}</span>
                          <span className="text-[var(--muted)]"> → {labelMap[branch.targetId] ?? branch.targetId}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {step.note && (
                  <p className="text-xs text-indigo-300 mt-2">📝 {step.note}</p>
                )}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
