import type { Step } from '../../constants/conditions'
import FlowchartView from './FlowchartView'
import ConditionStepTable from './ConditionStepTable'

interface ConditionsSectionProps {
  title: string
  description?: string
  steps: readonly Step[]
  pcDiagram: string
  pcDiagramId: string
  guidance?: string
}

// PC(≥768px): Mermaid 플로우차트. 모바일(<768px): 카드형 조건표.
// md:hidden / hidden md:block 조건부 마운트로 모바일에서는 FlowchartView가 아예 렌더되지 않아
// mermaid 번들 로드도 발생하지 않는다.
export default function ConditionsSection({
  title,
  description,
  steps,
  pcDiagram,
  pcDiagramId,
  guidance,
}: ConditionsSectionProps) {
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-bold text-[var(--fg)]">{title}</h2>
        {description && <p className="text-xs text-[var(--muted)] mt-1">{description}</p>}
      </div>

      {/* PC: Mermaid 도표 */}
      <div className="hidden md:block">
        {guidance && (
          <div className="rounded-lg border border-indigo-500/30 bg-indigo-500/5 p-3 text-xs text-indigo-300 mb-3">
            {guidance}
          </div>
        )}
        <FlowchartView diagram={pcDiagram} id={pcDiagramId} />
      </div>

      {/* 모바일: 조건표 */}
      <div className="md:hidden">
        <ConditionStepTable steps={steps} title={title} guidance={guidance} />
      </div>
    </section>
  )
}
