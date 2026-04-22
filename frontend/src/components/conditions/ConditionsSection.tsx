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

// PC(≥1280px): Mermaid 플로우차트. 모바일/태블릿(<1280px): 카드형 조건표.
// xl:hidden / hidden xl:block 으로 SQZ Terminal 브레이크포인트(1280px) 적용.
export default function ConditionsSection({
  title,
  description,
  steps,
  pcDiagram,
  pcDiagramId,
  guidance,
}: ConditionsSectionProps) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div className="label" style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-0)', fontFamily: 'var(--font-sans)' }}>{title}</div>
        {description && (
          <p style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 4 }}>{description}</p>
        )}
      </div>

      {/* PC(1280px+): Mermaid 도표 */}
      <div className="hidden xl:block">
        {guidance && (
          <div className="panel" style={{ background: 'var(--accent-bg, #eff6ff)', borderColor: 'var(--accent)', padding: '10px 14px', marginBottom: 10 }}>
            <p style={{ fontSize: 11, color: 'var(--accent)', lineHeight: 1.6 }}>{guidance}</p>
          </div>
        )}
        <FlowchartView diagram={pcDiagram} id={pcDiagramId} />
      </div>

      {/* 모바일/태블릿(<1280px): 카드형 조건표 */}
      <div className="xl:hidden">
        <ConditionStepTable steps={steps} title={title} guidance={guidance} />
      </div>
    </section>
  )
}
